"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useSignMessage } from "wagmi";
import { parseUnits } from "viem";
import { callApi } from "@/lib/middleware";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDC_ABI } from "@/lib/contract";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";

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

export default function BuyerPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [amount, setAmount] = useState("");
  const [depositStatus, setDepositStatus] = useState<"idle" | "approving" | "depositing" | "done">("idle");
  const [results, setResults] = useState<{ [key: number]: unknown }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [errors, setErrors] = useState<{ [key: number]: string }>({});

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
    } catch (err: unknown) {
      setErrors((p) => ({ ...p, [apiId]: err instanceof Error ? err.message : "request failed" }));
    } finally {
      setLoading((p) => ({ ...p, [apiId]: false }));
    }
  };

  const depositLabel = {
    idle: "Deposit",
    approving: "Approving...",
    depositing: "Depositing...",
    done: "Deposited ✓",
  }[depositStatus];

  const apis = [
    { id: 0, path: "/api/weather", name: "Weather API", description: "Real-time weather data." },
    { id: 1, path: "/api/inference", name: "Inference API", description: "AI model inference." },
  ];

  return (
    <main className="min-h-screen bg-[#0f0d1a] text-white">
      {/* nav */}
      <nav className="border-b border-[#1e1730] px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <ConnectButton />
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-[10px] font-mono text-violet-500 tracking-widest uppercase mb-2 block">agent / user</span>
          <h1 className="text-3xl font-bold text-white">Buyer</h1>
        </div>

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
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white mb-2">Call APIs</h2>
          <p className="text-sm text-[#5a4f6a] mb-6">
            Each call signs a payment proof — no gas. Settlement happens on-chain in the background.
          </p>
          <div className="flex flex-col gap-4">
            {apis.map((api) => (
              <div key={api.id} className="border border-[#1e1730] rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-white">{api.name}</h3>
                    <p className="text-sm text-[#5a4f6a]">{api.description}</p>
                  </div>
                  <button
                    onClick={() => handleCallApi(api.path, api.id)}
                    disabled={loading[api.id] || !isConnected}
                    className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-30 shrink-0 ml-4"
                  >
                    {loading[api.id] ? "Calling..." : "Call API"}
                  </button>
                </div>
                {!!results[api.id] && (
                  <div className="mt-4 bg-[#0f0d1a] border border-[#1e1730] rounded-xl p-4 animate-fadein">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      <span className="text-xs text-emerald-400 font-medium">Response received · payment settled</span>
                    </div>
                    <pre className="text-xs font-mono text-[#9d8fae] overflow-auto max-h-48 leading-relaxed">
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
      </div>
    </main>
  );
}
