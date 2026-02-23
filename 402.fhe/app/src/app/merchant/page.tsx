"use client";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDC_ABI } from "@/lib/contract";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";

function CipherBadge() {
  const chars = "0123456789abcdef";
  const [text, setText] = useState("a3f8b2c1d9e4f0a7");

  useEffect(() => {
    const id = setInterval(() => {
      setText(
        Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
      );
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 bg-violet-950/50 text-violet-400 text-xs font-mono px-3 py-1.5 rounded-full border border-violet-900/50 animate-cipher">
      🔒 0x{text}
    </span>
  );
}

export default function MerchantPage() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listed, setListed] = useState(false);
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);

  // registration state
  const [newApiId, setNewApiId] = useState<number | null>(null);
  const [regEndpoint, setRegEndpoint] = useState("");
  const [regPath, setRegPath] = useState("");
  const [regStatus, setRegStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [regError, setRegError] = useState("");

  const { writeContractAsync: listApi, isPending: isListing } = useWriteContract();
  const { writeContractAsync: requestWithdrawal, isPending: isWithdrawing } = useWriteContract();

  const handleListApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !price || !isConnected) return;
    const priceUnits = BigInt(Math.round(Number(price) * 1_000_000));
    try {
      const txHash = await listApi({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "listApi",
        args: [name, description, priceUnits],
      });

      // wait for tx and read ApiListed event to get apiId
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      const logs = await publicClient!.getLogs({
        address: CONTRACT_ADDRESS,
        event: parseAbiItem("event ApiListed(uint256 indexed id, address indexed merchant, string name, uint64 price)"),
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
      });

      if (logs.length > 0 && logs[0].args.id !== undefined) {
        setNewApiId(Number(logs[0].args.id));
      }

      setListed(true);
      setName(""); setDescription(""); setPrice("");
    } catch (err) {
      console.error("listApi error:", err);
    }
  };

  const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL || "http://localhost:3001";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newApiId === null || !regEndpoint || !regPath) return;
    setRegStatus("loading");
    setRegError("");
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: newApiId, path: regPath, endpoint: regEndpoint }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "registration failed");
      }
      setRegStatus("done");
    } catch (err: unknown) {
      setRegStatus("error");
      setRegError(err instanceof Error ? err.message : "registration failed");
    }
  };

  const handleWithdrawal = async () => {
    await requestWithdrawal({
      address: CONTRACT_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "requestWithdrawal",
    });
    setWithdrawalRequested(true);
  };

  const inputCls = "w-full bg-[#0f0d1a] border border-[#1e1730] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#3a2f4a] focus:outline-none focus:ring-2 focus:ring-violet-700 focus:border-transparent";

  return (
    <main className="min-h-screen bg-[#0f0d1a] text-white">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <ConnectButton />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-[10px] font-mono text-emerald-500 tracking-widest uppercase mb-2 block">API provider</span>
          <h1 className="text-3xl font-bold text-white">Merchant</h1>
        </div>

        {/* list API */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold text-white mb-2">List an API</h2>
          <p className="text-sm text-[#5a4f6a] mb-5">
            Set your price per call in USDC. Buyers see the price — only your earnings stay private.
          </p>
          <form onSubmit={handleListApi} className="flex flex-col gap-4">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="API name (e.g. Weather API)" className={inputCls} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={3} className={`${inputCls} resize-none`} />
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price per call in USDC (e.g. 2.00)" step="0.01" className={inputCls} />
            <button
              type="submit"
              disabled={isListing || !isConnected}
              className="border border-emerald-800/60 text-emerald-400 hover:bg-emerald-950/30 rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-30"
            >
              {isListing ? "Listing..." : "List API"}
            </button>
          </form>
          
          {listed && (
            <p className="mt-3 text-sm text-emerald-400">API listed. It is now live on the marketplace.</p>
          )}

          {listed && newApiId !== null && regStatus !== "done" && (
            <div className="mt-5 border border-[#1e1730] rounded-xl p-5">
              <h3 className="text-sm font-medium text-white mb-1">Register your backend URL</h3>
              <p className="text-xs text-[#5a4f6a] mb-4">
                Your API was assigned ID <code className="text-violet-400 font-mono">#{newApiId}</code>.
                Tell the middleware where to proxy requests.
              </p>
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={regPath}
                  onChange={(e) => setRegPath(e.target.value)}
                  placeholder="Path slug (e.g. /api/myweather)"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={regEndpoint}
                  onChange={(e) => setRegEndpoint(e.target.value)}
                  placeholder="Backend URL (e.g. https://myapi.com/weather)"
                  className={inputCls}
                />
                <button
                  type="submit"
                  disabled={regStatus === "loading"}
                  className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-30"
                >
                  {regStatus === "loading" ? "Registering..." : "Register URL"}
                </button>
              </form>
              {regError && <p className="mt-2 text-sm text-red-400">{regError}</p>}
            </div>
          )}
          
          {regStatus === "done" && (
            <p className="mt-3 text-sm text-emerald-400">
              Registered. Your API is now live at <code className="font-mono">{regPath}</code>.
            </p>
          )}
        </div>

        {/* revenue */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Revenue</h2>
          <div className="flex items-center justify-between p-4 bg-[#0f0d1a] rounded-xl border border-[#1e1730] mb-5">
            <span className="text-sm text-[#5a4f6a]">Your earnings</span>
            <CipherBadge />
          </div>
          <p className="text-xs text-[#3a2f4a] mb-5">
            Revenue is stored as an encrypted euint64 on-chain. Only you can decrypt it via reencryption — coming in v2.
          </p>
          <button
            onClick={handleWithdrawal}
            disabled={isWithdrawing || !isConnected || withdrawalRequested}
            className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-30 w-full"
          >
            {isWithdrawing ? "Requesting..." : withdrawalRequested ? "Withdrawal Requested ✓" : "Request Withdrawal"}
          </button>
          {withdrawalRequested && (
            <p className="mt-3 text-sm text-[#5a4f6a]">
              Request submitted. The operator will process your withdrawal within 24 hours.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
