"use client";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { CONTRACT_ADDRESS } from "@/lib/contract";
import Link from "next/link";

interface Participant {
  role: "Buyer" | "Merchant";
  address: string;
}

export default function OperatorPage() {
  const publicClient = usePublicClient();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !CONTRACT_ADDRESS) {
      setLoading(false);
      return;
    }

    async function fetchParticipants() {
      try {
        const [depositLogs, listLogs] = await Promise.all([
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event Deposited(address indexed buyer, uint64 amount)"),
            fromBlock: BigInt(0),
          }),
          publicClient!.getLogs({
            address: CONTRACT_ADDRESS,
            event: parseAbiItem("event ApiListed(uint256 indexed id, address indexed merchant, string name, uint64 price)"),
            fromBlock: BigInt(0),
          }),
        ]);

        const buyers = [...new Set(depositLogs.map((l) => l.args.buyer as string))];
        const merchants = [...new Set(listLogs.map((l) => l.args.merchant as string))];

        const all: Participant[] = [
          ...buyers.map((a) => ({ role: "Buyer" as const, address: a })),
          ...merchants.map((a) => ({ role: "Merchant" as const, address: a })),
        ];

        setParticipants(all);
      } catch {
        // if no contract deployed yet, show empty state
      } finally {
        setLoading(false);
      }
    }

    fetchParticipants();
  }, [publicClient]);

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-10">
          <Link href="/" className="text-[#1a1523] font-semibold hover:text-[#7c3aed] transition-colors">
            ← 402.fhe
          </Link>
        </nav>

        {/* header card */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-7 mb-6">
          <h1 className="text-2xl font-bold text-[#1a1523] mb-2">Operator View</h1>
          <p className="text-[#6b5e7a] leading-relaxed">
            This is everything the marketplace operator can see. All balances and revenues are
            encrypted using{" "}
            <a href="https://www.zama.ai" className="text-[#7c3aed] hover:underline" target="_blank" rel="noopener">
              Zama fhEVM
            </a>
            {" "}— cryptographically enforced, not a policy claim.
          </p>
        </div>

        {/* participants table */}
        <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8e0d8] bg-[#fffaf7]">
                <th className="text-left px-6 py-4 font-medium text-[#6b5e7a]">Role</th>
                <th className="text-left px-6 py-4 font-medium text-[#6b5e7a]">Address</th>
                <th className="text-left px-6 py-4 font-medium text-[#6b5e7a]">Balance / Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e0d8]">
              {loading && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#6b5e7a] text-sm">
                    Loading on-chain data...
                  </td>
                </tr>
              )}
              {!loading && participants.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#6b5e7a] text-sm">
                    No activity yet. Deploy the contract and make some deposits.
                  </td>
                </tr>
              )}
              {participants.map((p) => (
                <tr key={p.address + p.role}>
                  <td className="px-6 py-4 text-[#6b5e7a]">{p.role}</td>
                  <td className="px-6 py-4 font-mono text-[#1a1523] text-xs">{p.address}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 bg-[#f3eeff] text-[#7c3aed] text-xs font-mono px-2.5 py-1 rounded-full">
                      🔒 encrypted
                    </span>
                  </td>
                </tr>
              ))}
              {/* protocol fees row always shown */}
              {!loading && (
                <tr className="bg-[#fffaf7]">
                  <td className="px-6 py-4 text-[#6b5e7a]">Protocol</td>
                  <td className="px-6 py-4 text-xs text-[#6b5e7a]">Protocol fees</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 bg-[#f3eeff] text-[#7c3aed] text-xs font-mono px-2.5 py-1 rounded-full">
                      🔒 encrypted
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-[#6b5e7a] text-center">
          Addresses loaded from on-chain <code className="font-mono">Deposited</code> and <code className="font-mono">ApiListed</code> events in real time.
        </p>
      </div>
    </main>
  );
}
