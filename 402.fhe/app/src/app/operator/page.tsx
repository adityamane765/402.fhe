"use client";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { CONTRACT_ADDRESS } from "@/lib/contract";
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

interface WithdrawalEvent {
  address: string;
  txHash: string;
  blockNumber: string;
  fulfilled: boolean;
}

function CipherBadge() {
  return (
    <span className="inline-flex items-center gap-2 bg-violet-950/50 text-violet-400 text-xs font-mono px-3 py-1.5 rounded-full border border-violet-900/50">
      🔒 ••••••••
    </span>
  );
}

export default function OperatorPage() {
  const publicClient = usePublicClient();

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [settleEvents, setSettleEvents] = useState<SettleEvent[]>([]);
  const [withdrawalEvents, setWithdrawalEvents] = useState<WithdrawalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !CONTRACT_ADDRESS) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const fromBlock = BigInt(10668000);
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

        const fulfilledAddresses = new Set(withdrawnLogs.map((l) => (l.args.merchant as string).toLowerCase()));
        setWithdrawalEvents(withdrawalRequestedLogs.map((l) => ({
          address: l.args.merchant as string,
          txHash: l.transactionHash ?? "",
          blockNumber: String(l.blockNumber),
          fulfilled: fulfilledAddresses.has((l.args.merchant as string).toLowerCase()),
        })));
      } catch {
        // empty state if contract not reachable
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [publicClient]);

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
            Withdrawals are now self-serve: merchants and buyers fulfill their own withdrawals via KMS decryption in their browser.
          </p>
        </div>

        {/* withdrawal activity */}
        <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1730] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
            <h2 className="text-sm font-medium text-white">Withdrawal Activity</h2>
            <span className="ml-auto text-xs text-[#3a2f4a] font-mono">
              {withdrawalEvents.filter(w => !w.fulfilled).length} pending · {withdrawalEvents.filter(w => w.fulfilled).length} fulfilled
            </span>
          </div>

          {loading && (
            <p className="px-6 py-8 text-center text-[#3a2f4a] text-sm">Loading...</p>
          )}
          {!loading && withdrawalEvents.length === 0 && (
            <p className="px-6 py-8 text-center text-[#3a2f4a] text-sm">No withdrawal activity yet.</p>
          )}

          <div className="divide-y divide-[#1e1730]">
            {withdrawalEvents.map((w, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1">
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
                {w.fulfilled ? (
                  <span className="text-xs text-emerald-400 font-mono">fulfilled ✓</span>
                ) : (
                  <span className="text-xs text-orange-400 font-mono">pending</span>
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
