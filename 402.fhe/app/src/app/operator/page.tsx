"use client";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseAbiItem } from "viem";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI } from "@/lib/contract";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";

interface Participant {
  role: "Buyer" | "Merchant";
  address: string;
}

interface SettleEvent {
  apiId: string;
  buyer: string;
  blockNumber: string;
}

interface PendingWithdrawal {
  address: string;
  txHash: string;
  blockNumber: string;
}

function CipherBadge() {
  return (
    <span className="inline-flex items-center gap-2 bg-violet-950/50 text-violet-400 text-xs font-mono px-3 py-1.5 rounded-full border border-violet-900/50">
      🔒 ••••••••
    </span>
  );
}

export default function OperatorPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settleEvents, setSettleEvents] = useState<SettleEvent[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // per-withdrawal form state: address → {amount, proof}
  const [fulfillInputs, setFulfillInputs] = useState<Record<string, { amount: string; proof: string }>>({});
  const [fulfillStatus, setFulfillStatus] = useState<Record<string, "idle" | "pending" | "done" | "error">>({});
  const [fulfillErrors, setFulfillErrors] = useState<Record<string, string>>({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!publicClient || !CONTRACT_ADDRESS) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const fromBlock = BigInt(10425000);
        const [depositLogs, listLogs, settleLogs, withdrawalRequestedLogs, withdrawnLogs] = await Promise.all([
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event Deposited(address indexed buyer, uint64 amount)"),
            fromBlock,
          }),
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event ApiListed(uint256 indexed id, address indexed merchant, string name, uint64 price)"),
            fromBlock,
          }),
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event CallSettled(uint256 indexed apiId, address indexed buyer)"),
            fromBlock,
          }),
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event WithdrawalRequested(address indexed merchant)"),
            fromBlock,
          }),
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event Withdrawn(address indexed merchant, uint256 amount)"),
            fromBlock,
          }),
        ]);

        const buyers = [...new Set(depositLogs.map((l) => l.args.buyer as string))];
        const merchants = [...new Set(listLogs.map((l) => l.args.merchant as string))];

        setParticipants([
          ...buyers.map((a) => ({ role: "Buyer" as const, address: a })),
          ...merchants.map((a) => ({ role: "Merchant" as const, address: a })),
        ]);

        setSettleEvents(settleLogs.map((l) => ({
          apiId: String(l.args.apiId ?? "?"),
          buyer: l.args.buyer as string,
          blockNumber: String(l.blockNumber),
        })));

        // pending = requested but not yet fulfilled
        const fulfilledAddresses = new Set(withdrawnLogs.map((l) => (l.args.merchant as string).toLowerCase()));
        const pending = withdrawalRequestedLogs
          .filter((l) => !fulfilledAddresses.has((l.args.merchant as string).toLowerCase()))
          .map((l) => ({
            address: l.args.merchant as string,
            txHash: l.transactionHash ?? "",
            blockNumber: String(l.blockNumber),
          }));
        setPendingWithdrawals(pending);
      } catch {
        // empty state if contract not reachable
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [publicClient]);

  const handleFulfill = async (addr: string) => {
    const inputs = fulfillInputs[addr];
    if (!inputs?.amount || !inputs?.proof) return;

    setFulfillStatus((p) => ({ ...p, [addr]: "pending" }));
    setFulfillErrors((p) => ({ ...p, [addr]: "" }));

    try {
      const amountBigInt = BigInt(Math.round(parseFloat(inputs.amount) * 1_000_000));
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "fulfillWithdrawal",
        args: [addr as `0x${string}`, amountBigInt, inputs.proof as `0x${string}`],
      });
      setFulfillStatus((p) => ({ ...p, [addr]: "done" }));
      setPendingWithdrawals((p) => p.filter((w) => w.address.toLowerCase() !== addr.toLowerCase()));
    } catch (err) {
      setFulfillStatus((p) => ({ ...p, [addr]: "error" }));
      setFulfillErrors((p) => ({ ...p, [addr]: err instanceof Error ? err.message : "tx failed" }));
    }
  };

  const isOwner = mounted && isConnected && address;

  return (
    <main className="min-h-screen bg-[#0f0d1a] text-white">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <ConnectButton />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-[10px] font-mono text-pink-500 tracking-widest uppercase mb-2 block">operator</span>
          <h1 className="text-3xl font-bold text-white mb-3">Operator Dashboard</h1>
          <p className="text-[#5a4f6a] leading-relaxed max-w-xl">
            All balances and revenues are encrypted — this view shows participation and settlement activity.
            Withdrawal fulfillment requires the owner wallet and a KMS decryption proof.
          </p>
        </div>

        {/* pending withdrawals */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1730] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            <h2 className="text-sm font-medium text-white">Pending Withdrawals</h2>
            <span className="ml-auto text-xs text-[#3a2f4a] font-mono">{pendingWithdrawals.length} pending</span>
          </div>

          {loading && (
            <p className="px-6 py-8 text-center text-[#3a2f4a] text-sm">Loading...</p>
          )}
          {!loading && pendingWithdrawals.length === 0 && (
            <p className="px-6 py-8 text-center text-[#3a2f4a] text-sm">No pending withdrawal requests.</p>
          )}

          <div className="divide-y divide-[#1e1730]">
            {pendingWithdrawals.map((w) => (
              <div key={w.address} className="px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-mono text-[#9d8fae]">{w.address}</p>
                    <p className="text-[10px] text-[#3a2f4a] mt-0.5">
                      requested at block {w.blockNumber}
                      {w.txHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${w.txHash}`}
                          target="_blank"
                          rel="noopener"
                          className="ml-2 text-violet-500 hover:text-violet-400"
                        >
                          {w.txHash.slice(0, 8)}... ↗
                        </a>
                      )}
                    </p>
                  </div>
                  {fulfillStatus[w.address] === "done" && (
                    <span className="text-xs text-emerald-400 font-mono">fulfilled ✓</span>
                  )}
                </div>

                {fulfillStatus[w.address] !== "done" && (
                  <div className="space-y-3">
                    <p className="text-[10px] text-[#5a4f6a]">
                      Run the KMS relay script to get the cleartext amount and proof for this address, then paste below.
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        placeholder="Amount (USDC, e.g. 10.5)"
                        value={fulfillInputs[w.address]?.amount ?? ""}
                        onChange={(e) => setFulfillInputs((p) => ({
                          ...p,
                          [w.address]: { ...p[w.address], amount: e.target.value }
                        }))}
                        className="flex-1 bg-[#0f0d1a] border border-[#1e1730] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a2f4a] focus:outline-none focus:ring-1 focus:ring-violet-700"
                      />
                    </div>
                    <textarea
                      placeholder="Decryption proof (0x...)"
                      value={fulfillInputs[w.address]?.proof ?? ""}
                      onChange={(e) => setFulfillInputs((p) => ({
                        ...p,
                        [w.address]: { ...p[w.address], proof: e.target.value }
                      }))}
                      rows={2}
                      className="w-full bg-[#0f0d1a] border border-[#1e1730] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-[#3a2f4a] focus:outline-none focus:ring-1 focus:ring-violet-700 resize-none"
                    />
                    <button
                      onClick={() => handleFulfill(w.address)}
                      disabled={
                        !isOwner ||
                        !fulfillInputs[w.address]?.amount ||
                        !fulfillInputs[w.address]?.proof ||
                        fulfillStatus[w.address] === "pending"
                      }
                      className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30"
                    >
                      {fulfillStatus[w.address] === "pending" ? "Submitting..." : "Fulfill Withdrawal"}
                    </button>
                    {!isOwner && (
                      <p className="text-[10px] text-[#5a4f6a]">Connect the owner wallet to fulfill.</p>
                    )}
                    {fulfillErrors[w.address] && (
                      <p className="text-xs text-red-400">{fulfillErrors[w.address]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* participants table */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1730]">
            <h2 className="text-sm font-medium text-white">What the operator sees</h2>
            <p className="text-[10px] text-[#3a2f4a] mt-0.5">all financial data is encrypted — operator is blind</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1730]">
                <th className="text-left px-6 py-4 font-medium text-[#3a2f4a] uppercase tracking-widest text-xs">Role</th>
                <th className="text-left px-6 py-4 font-medium text-[#3a2f4a] uppercase tracking-widest text-xs">Address</th>
                <th className="text-left px-6 py-4 font-medium text-[#3a2f4a] uppercase tracking-widest text-xs">Balance / Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1730]">
              {loading && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#3a2f4a] text-sm">Loading on-chain data...</td>
                </tr>
              )}
              {!loading && participants.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#3a2f4a] text-sm">No activity yet.</td>
                </tr>
              )}
              {participants.map((p) => (
                <tr key={p.address + p.role}>
                  <td className="px-6 py-4 text-[#5a4f6a] text-xs font-mono">{p.role}</td>
                  <td className="px-6 py-4 font-mono text-[#9d8fae] text-xs">{p.address}</td>
                  <td className="px-6 py-4"><CipherBadge /></td>
                </tr>
              ))}
              {!loading && (
                <tr className="bg-[#0f0d1a]">
                  <td className="px-6 py-4 text-[#5a4f6a] text-xs font-mono">Protocol</td>
                  <td className="px-6 py-4 text-xs text-[#3a2f4a]">Protocol fees</td>
                  <td className="px-6 py-4"><CipherBadge /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* settled calls feed */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1730] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse inline-block" />
            <h2 className="text-sm font-medium text-white">Settled Calls</h2>
            <span className="ml-auto text-xs text-[#3a2f4a] font-mono">{settleEvents.length} total</span>
          </div>
          {settleEvents.length === 0 && !loading && (
            <p className="px-6 py-6 text-sm text-[#3a2f4a] text-center">No settled calls yet.</p>
          )}
          <div className="divide-y divide-[#1e1730] max-h-64 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {settleEvents.map((e, i) => (
              <div key={i} className="px-6 py-3 flex items-center gap-4 text-xs">
                <span className="text-[#3a2f4a] font-mono">block {e.blockNumber}</span>
                <span className="font-mono text-[#9d8fae]">{e.buyer.slice(0, 8)}...{e.buyer.slice(-4)}</span>
                <span className="text-[#5a4f6a]">→ API #{e.apiId}</span>
                <span className="ml-auto font-mono text-pink-500 text-[10px]">[ENCRYPTED]</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-[#3a2f4a] text-center font-mono">
          addresses from <code>Deposited</code> + <code>ApiListed</code> events · live
        </p>
      </div>
    </main>
  );
}
