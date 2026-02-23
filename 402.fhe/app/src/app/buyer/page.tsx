"use client";
import { useState } from "react";
import { useAccount, useWriteContract, useSignMessage } from "wagmi";
import { parseUnits } from "viem";
import { callApi } from "@/lib/middleware";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDC_ABI } from "@/lib/contract";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";

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
    { id: 0, path: "/api/weather", name: "Weather API", description: "Real-time weather stub." },
    { id: 1, path: "/api/inference", name: "Inference API", description: "AI model inference stub." },
  ];

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <nav className="flex justify-between items-center mb-10">
          <Link href="/" className="text-[#1a1523] font-semibold hover:text-[#7c3aed] transition-colors">
            ← 402.fhe
          </Link>
          <ConnectButton />
        </nav>

        <h1 className="text-2xl font-bold text-[#1a1523] mb-8">Buyer</h1>

        {/* deposit section */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1a1523] mb-4">Deposit USDC</h2>
          <p className="text-sm text-[#6b5e7a] mb-4">
            Deposit once — your balance is encrypted on-chain. Each API call deducts from it with no extra gas.
          </p>
          <form onSubmit={handleDeposit} className="flex gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (e.g. 10)"
              className="flex-1 border border-[#e8e0d8] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
            />
            <button
              type="submit"
              disabled={depositStatus !== "idle" || !isConnected}
              className="bg-[#7c3aed] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
            >
              {depositLabel}
            </button>
          </form>
          {depositStatus === "done" && (
            <p className="mt-3 text-sm text-[#059669]">Deposit confirmed. Your balance is now encrypted on-chain.</p>
          )}
          {!isConnected && (
            <p className="mt-3 text-sm text-[#6b5e7a]">Connect your wallet to deposit.</p>
          )}
        </div>

        {/* call api section */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#1a1523] mb-4">Call APIs</h2>
          <p className="text-sm text-[#6b5e7a] mb-6">
            Each call signs a payment proof with your wallet — no gas required. Settlement happens on-chain in the background.
          </p>
          <div className="flex flex-col gap-4">
            {apis.map((api) => (
              <div key={api.id} className="border border-[#e8e0d8] rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium text-[#1a1523]">{api.name}</h3>
                    <p className="text-sm text-[#6b5e7a]">{api.description}</p>
                  </div>
                  <button
                    onClick={() => handleCallApi(api.path, api.id)}
                    disabled={loading[api.id] || !isConnected}
                    className="bg-[#7c3aed] text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-50 shrink-0 ml-4"
                  >
                    {loading[api.id] ? "Calling..." : "Call API"}
                  </button>
                </div>
                {!!results[api.id] && (
                  <pre className="bg-[#f3eeff] rounded-lg p-4 text-sm font-mono text-[#1a1523] overflow-auto">
                    {JSON.stringify(results[api.id], null, 2)}
                  </pre>
                )}
                {errors[api.id] && (
                  <p className="text-sm text-red-600 mt-2">{errors[api.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
