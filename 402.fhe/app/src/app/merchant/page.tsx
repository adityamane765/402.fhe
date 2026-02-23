"use client";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI } from "@/lib/contract";
import ConnectButton from "@/components/ConnectButton";
import Link from "next/link";

export default function MerchantPage() {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listed, setListed] = useState(false);
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);

  const { writeContractAsync: listApi, isPending: isListing } = useWriteContract();
  const { writeContractAsync: requestWithdrawal, isPending: isWithdrawing } = useWriteContract();

  const handleListApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || !price || !isConnected) return;
    const priceUnits = BigInt(Math.round(Number(price) * 1_000_000));
    await listApi({
      address: CONTRACT_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "listApi",
      args: [name, description, priceUnits],
    });
    setListed(true);
    setName(""); setDescription(""); setPrice("");
  };

  const handleWithdrawal = async () => {
    await requestWithdrawal({
      address: CONTRACT_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "requestWithdrawal",
    });
    setWithdrawalRequested(true);
  };

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <nav className="flex justify-between items-center mb-10">
          <Link href="/" className="text-[#1a1523] font-semibold hover:text-[#7c3aed] transition-colors">
            ← 402.fhe
          </Link>
          <ConnectButton />
        </nav>

        <h1 className="text-2xl font-bold text-[#1a1523] mb-8">Merchant</h1>

        {/* list api */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#1a1523] mb-4">List an API</h2>
          <p className="text-sm text-[#6b5e7a] mb-5">
            Set your price per call in USDC. Buyers see the price — only your earnings stay private.
          </p>
          <form onSubmit={handleListApi} className="flex flex-col gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="API name (e.g. Weather API)"
              className="border border-[#e8e0d8] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              rows={3}
              className="border border-[#e8e0d8] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent resize-none"
            />
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price per call in USDC (e.g. 2.00)"
              step="0.01"
              className="border border-[#e8e0d8] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isListing || !isConnected}
              className="bg-[#7c3aed] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
            >
              {isListing ? "Listing..." : "List API"}
            </button>
          </form>
          {listed && (
            <p className="mt-3 text-sm text-[#059669]">API listed successfully. It is now live on the marketplace.</p>
          )}
        </div>

        {/* revenue */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#1a1523] mb-4">Revenue</h2>
          <div className="flex items-center justify-between p-4 bg-[#fffaf7] rounded-xl border border-[#e8e0d8] mb-5">
            <span className="text-sm text-[#6b5e7a]">Your earnings</span>
            <span className="inline-flex items-center gap-1.5 bg-[#f3eeff] text-[#7c3aed] text-xs font-mono px-3 py-1.5 rounded-full">
              🔒 encrypted
            </span>
          </div>
          <p className="text-xs text-[#6b5e7a] mb-5">
            Merchant revenue is stored as an encrypted value on-chain. Only you can decrypt it via reencryption — coming in v2.
          </p>
          <button
            onClick={handleWithdrawal}
            disabled={isWithdrawing || !isConnected || withdrawalRequested}
            className="border border-[#7c3aed] text-[#7c3aed] rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#f3eeff] transition-colors disabled:opacity-50 w-full"
          >
            {isWithdrawing ? "Requesting..." : withdrawalRequested ? "Withdrawal Requested ✓" : "Request Withdrawal"}
          </button>
          {withdrawalRequested && (
            <p className="mt-3 text-sm text-[#6b5e7a]">
              Request submitted. The operator will process your withdrawal within 24 hours.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
