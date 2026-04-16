"use client";
import { useState, useEffect, Suspense } from "react";
import { useAccount, useWriteContract, useSignMessage, useReadContract, useReadContracts, usePublicClient } from "wagmi";
import { parseUnits, parseAbiItem } from "viem";
import { callApi } from "@/lib/middleware";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDC_ABI } from "@/lib/contract";
import { useUserDecrypt } from "@/lib/useUserDecrypt";
import { usePublicDecryptWithdraw } from "@/lib/usePublicDecrypt";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL || "http://localhost:3001";

interface ApiEntry {
  id: number;
  name: string;
  description: string;
  price: bigint;
  path: string | null;
}

interface CallRecord {
  apiId: string;
  blockNumber: string;
  txHash: string;
}

function CipherBadge() {
  return (
    <span className="inline-flex items-center gap-2 bg-violet-950/50 text-violet-400 text-xs font-mono px-2.5 py-1 rounded-full border border-violet-900/50">
      🔒 ••••••••••••••••
    </span>
  );
}

function DepositSteps({ status }: { status: "idle" | "approving" | "depositing" | "done" }) {
  const steps = ["Approve", "Deposit", "Encrypted", "Ready"];
  const activeIndex = { idle: -1, approving: 0, depositing: 1, done: 3 }[status];
  const displayIndex = status === "depositing" ? 2 : activeIndex;

  return (
    <div className="flex items-center gap-1 mb-5">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1 flex-1">
          <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
            i <= displayIndex ? "bg-violet-500" : "bg-[#1e1730]"
          }`} />
          <span className={`text-xs whitespace-nowrap transition-colors duration-300 ${
            i === displayIndex ? "text-violet-400 font-medium" : i < displayIndex ? "text-violet-600" : "text-[#5a4f6a]"
          }`}>
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

function BuyerPageInner() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [amount, setAmount] = useState("");
  const [depositStatus, setDepositStatus] = useState<"idle" | "approving" | "depositing" | "done">("idle");
  const [results, setResults] = useState<{ [key: number]: unknown }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: number]: string }>({});
  const [routes, setRoutes] = useState<Record<string, { path: string }>>({});
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [clearBalance, setClearBalance] = useState<bigint | null>(null);
  const [pendingCalls, setPendingCalls] = useState<Record<number, number>>({});
  const [pendingDeduction, setPendingDeduction] = useState<bigint>(0n);
  const [settleStatus, setSettleStatus] = useState<"idle" | "settling" | "done">("idle");
  const { decryptBalance, loading: decryptLoading, error: decryptError } = useUserDecrypt();
  const { withdrawBalance, status: withdrawStatus, error: withdrawError } = usePublicDecryptWithdraw();

  const focusedApiId = searchParams.get("apiId") ? Number(searchParams.get("apiId")) : null;

  // fetch route registry from middleware
  useEffect(() => {
    fetch(`${MIDDLEWARE_URL}/routes`)
      .then((r) => r.json())
      .then(setRoutes)
      .catch(() => {});
  }, []);

  // fetch pending unsettled call count for this buyer
  useEffect(() => {
    if (!address) return;
    fetch(`${MIDDLEWARE_URL}/pending/${address}`)
      .then((r) => r.json())
      .then((data) => {
        setPendingCalls(data.pending || {});
        setPendingDeduction(BigInt(data.pendingDeduction || "0"));
      })
      .catch(() => {});
  }, [address]);

  // fetch call history from CallSettled events for this buyer
  useEffect(() => {
    if (!publicClient || !address || !CONTRACT_ADDRESS) return;
    setHistoryLoading(true);
    publicClient.getLogs({
      address: CONTRACT_ADDRESS,
      event: parseAbiItem("event CallSettled(uint256 indexed apiId, address indexed buyer)"),
      args: { buyer: address },
      fromBlock: BigInt(10668000),
    }).then((logs) => {
      setCallHistory(logs.map((l) => ({
        apiId: String(l.args.apiId ?? "?"),
        blockNumber: String(l.blockNumber),
        txHash: l.transactionHash ?? "",
      })));
    }).catch(() => {}).finally(() => setHistoryLoading(false));
  }, [publicClient, address]);

  const { data: nextApiId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "nextApiId",
  });

  const count = nextApiId ? Number(nextApiId) : 0;

  const { data: listingResults, isLoading: apisLoading } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "listings" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0 },
  });

  const apis: ApiEntry[] = (listingResults ?? [])
    .map((result, i) => {
      if (result.status !== "success" || !result.result) return null;
      const [, name, description, price, active] = result.result as [string, string, string, bigint, boolean];
      if (!active) return null;
      const path = routes[String(i)]?.path ?? null;
      return { id: i, name, description, price, path };
    })
    .filter(Boolean) as ApiEntry[];

  const { writeContractAsync: approve } = useWriteContract();
  const { writeContractAsync: deposit } = useWriteContract();

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !isConnected) return;
    const units = parseUnits(amount, 6);
    try {
      setDepositStatus("approving");
      await approve({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, units],
      });
      setDepositStatus("depositing");
      await deposit({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "deposit",
        args: [units],
      });
      setDepositStatus("done");
    } catch {
      setDepositStatus("idle");
    }
  };

  const handleCallApi = async (path: string, apiId: number) => {
    if (!isConnected || !address) return;
    setLoading((p) => ({ ...p, [apiId]: true }));
    setErrors((p) => ({ ...p, [apiId]: "" }));
    try {
      const res = await callApi(path, apiId, address, signMessageAsync);
      setResults((p) => ({ ...p, [apiId]: res }));
      // refresh pending counts after call
      fetch(`${MIDDLEWARE_URL}/pending/${address}`)
        .then((r) => r.json())
        .then((data) => {
          setPendingCalls(data.pending || {});
          setPendingDeduction(BigInt(data.pendingDeduction || "0"));
        })
        .catch(() => {});
    } catch (err: unknown) {
      setErrors((p) => ({ ...p, [apiId]: err instanceof Error ? err.message : "request failed" }));
    } finally {
      setLoading((p) => ({ ...p, [apiId]: false }));
    }
  };

  const totalPending = Object.values(pendingCalls).reduce((a, b) => a + b, 0);

  const handleSettle = async () => {
    if (!address) return;
    setSettleStatus("settling");
    try {
      await fetch(`${MIDDLEWARE_URL}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setPendingCalls({});
      setSettleStatus("done");
    } catch {
      setSettleStatus("idle");
    }
  };

  const depositLabel = {
    idle: "Deposit",
    approving: "Approving...",
    depositing: "Depositing...",
    done: "Deposited ✓",
  }[depositStatus];

  return (
    <main className="min-h-screen bg-[#0f0d1a] text-white">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex justify-between items-center">
        <Link href="/marketplace" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← marketplace
        </Link>
        <ConnectButton />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-[10px] font-mono text-violet-500 tracking-widest uppercase mb-2 block">agent / user</span>
          <h1 className="text-3xl font-bold text-white">Buyer</h1>
        </div>

        {/* encrypted balance */}
        {mounted && isConnected && (
          <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">Your Balance</h2>
              <span className="text-[10px] font-mono text-violet-600 uppercase tracking-widest">fhe-encrypted</span>
            </div>
            <p className="text-xs text-[#5a4f6a] mb-5">
              Stored as a ciphertext on-chain. Only you can decrypt it — the operator never sees your balance.
            </p>

            {clearBalance !== null ? (
              <div className="rounded-xl border border-[#1e1730] bg-[#0f0d1a] mb-4 divide-y divide-[#1e1730]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-[#5a4f6a]">On-chain balance</span>
                  <span className="text-sm font-mono text-emerald-400">${(Number(clearBalance) / 1_000_000).toFixed(2)} USDC</span>
                </div>
                {pendingDeduction > 0n && (
                  <>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[#5a4f6a]">Pending settlement</span>
                      <span className="text-sm font-mono text-amber-500">−${(Number(pendingDeduction) / 1_000_000).toFixed(2)} USDC</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-white font-medium">Available</span>
                      <span className="text-sm font-mono text-white font-medium">${(Number(clearBalance - pendingDeduction) / 1_000_000).toFixed(2)} USDC</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-[#0f0d1a] rounded-xl border border-[#1e1730] mb-4">
                <span className="text-xs text-[#5a4f6a]">Balance</span>
                <CipherBadge />
              </div>
            )}

            <div className="flex gap-3 mb-3">
              <button
                onClick={async () => {
                  if (address) {
                    const val = await decryptBalance(address);
                    if (val !== null) setClearBalance(val);
                  }
                }}
                disabled={decryptLoading}
                className="flex-1 border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
              >
                {decryptLoading ? "Signing..." : clearBalance !== null ? "Refresh" : "Reveal Balance"}
              </button>
              <button
                onClick={() => address && withdrawBalance(address)}
                disabled={withdrawStatus === "requesting" || withdrawStatus === "decrypting" || withdrawStatus === "submitting" || withdrawStatus === "done"}
                className="flex-1 border border-[#1e1730] text-[#5a4f6a] hover:text-violet-400 hover:border-violet-800/60 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
              >
                {withdrawStatus === "requesting" ? "Requesting..." : withdrawStatus === "decrypting" ? "Decrypting..." : withdrawStatus === "submitting" ? "Submitting..." : withdrawStatus === "done" ? "Withdrawn ✓" : "Withdraw"}
              </button>
            </div>
            {totalPending > 0 && (
              <button
                onClick={handleSettle}
                disabled={settleStatus === "settling"}
                className="w-full border border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/30 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
              >
                {settleStatus === "settling" ? "Settling..." : settleStatus === "done" ? "Settled ✓" : `Settle Now — ${totalPending} unsettled call${totalPending > 1 ? "s" : ""}`}
              </button>
            )}
            {decryptError && <p className="mt-2 text-xs text-red-400">{decryptError}</p>}
            {withdrawError && <p className="mt-2 text-xs text-red-400">{withdrawError}</p>}
          </div>
        )}

        {/* deposit */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-2">Deposit USDC</h2>
          <p className="text-sm text-[#5a4f6a] mb-5">
            Deposit once — your balance is encrypted on-chain. Each API call deducts from it with no extra gas.
          </p>
          {depositStatus !== "idle" && <DepositSteps status={depositStatus} />}
          <form onSubmit={handleDeposit} className="flex gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (e.g. 10)"
              className="flex-1 bg-[#0f0d1a] border border-[#1e1730] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#3a2f4a] focus:outline-none focus:ring-2 focus:ring-violet-700 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={depositStatus !== "idle" || !isConnected}
              className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-30"
            >
              {depositLabel}
            </button>
          </form>
          {depositStatus === "done" && (
            <p className="mt-3 text-sm text-emerald-400">Deposit confirmed. Your balance is now encrypted on-chain.</p>
          )}
          {!isConnected && (
            <p className="mt-3 text-sm text-[#5a4f6a]">Connect your wallet to deposit.</p>
          )}
        </div>

        {/* call APIs */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-2">Call APIs</h2>
          <p className="text-sm text-[#5a4f6a] mb-6">
            Each call signs a payment proof — no gas. Settlement happens on-chain in the background.
          </p>

          {apisLoading && (
            <p className="text-sm text-[#5a4f6a]">loading APIs from chain...</p>
          )}

          {!apisLoading && apis.length === 0 && (
            <p className="text-sm text-[#5a4f6a]">
              No APIs available yet. <Link href="/marketplace" className="text-violet-400 hover:underline">Browse marketplace →</Link>
            </p>
          )}

          <div className="flex flex-col gap-4">
            {apis.map((api) => (
              <div
                key={api.id}
                className={`border rounded-xl p-5 transition-colors ${
                  focusedApiId === api.id ? "border-violet-700/60 bg-violet-950/20" : "border-[#1e1730]"
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono text-[#3a2f4a]">#{api.id}</span>
                      <h3 className="font-medium text-white">{api.name}</h3>
                    </div>
                    <p className="text-sm text-[#5a4f6a]">{api.description}</p>
                    <span className="text-xs font-mono text-[#5a4f6a] mt-1 inline-block">{api.path}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                    <span className="text-sm font-mono text-violet-400">
                      ${(Number(api.price) / 1_000_000).toFixed(2)}
                    </span>
                    <button
                      onClick={() => api.path && handleCallApi(api.path, api.id)}
                      disabled={loading[api.id] || !isConnected || !api.path}
                      title={!api.path ? "Not yet registered with middleware" : undefined}
                      className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
                    >
                      {loading[api.id] ? "Calling..." : !api.path ? "Unregistered" : "Call API"}
                    </button>
                  </div>
                </div>
                {!!results[api.id] && (
                  <div className="mt-4 bg-[#0f0d1a] border border-[#1e1730] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      <span className="text-xs text-emerald-400 font-medium">Response received · payment settled</span>
                    </div>
                    <pre className="text-xs font-mono text-[#9d8fae] overflow-auto max-h-48 leading-relaxed scrollbar-none" style={{ scrollbarWidth: "none" }}>
                      {JSON.stringify(results[api.id], null, 2)}
                    </pre>
                  </div>
                )}
                {errors[api.id] && (
                  <p className="text-sm text-red-400 mt-2">{errors[api.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* call history */}
        {mounted && isConnected && (
          <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e1730] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse inline-block" />
              <h2 className="text-sm font-medium text-white">Call History</h2>
              <span className="ml-auto text-xs text-[#3a2f4a] font-mono">{callHistory.length} total</span>
            </div>
            {historyLoading && (
              <p className="px-6 py-6 text-sm text-[#3a2f4a] text-center">Loading from chain...</p>
            )}
            {!historyLoading && callHistory.length === 0 && (
              <p className="px-6 py-6 text-sm text-[#3a2f4a] text-center">No settled calls yet.</p>
            )}
            <div className="divide-y divide-[#1e1730] max-h-64 overflow-y-auto">
              {callHistory.map((c, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-4 text-xs">
                  <span className="text-[#3a2f4a] font-mono">block {c.blockNumber}</span>
                  <span className="text-[#5a4f6a]">API #{c.apiId}</span>
                  {c.txHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${c.txHash}`}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto font-mono text-violet-500 hover:text-violet-400 text-[10px] transition-colors"
                    >
                      {c.txHash.slice(0, 8)}... ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function BuyerPage() {
  return (
    <Suspense>
      <BuyerPageInner />
    </Suspense>
  );
}
