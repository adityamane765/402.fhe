"use client";
import { useState, useEffect } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI } from "@/lib/contract";
import Link from "next/link";

const MIDDLEWARE_URL = process.env.NEXT_PUBLIC_MIDDLEWARE_URL || "http://localhost:3001";

interface Listing {
  id: number;
  merchant: string;
  name: string;
  description: string;
  price: bigint;
  active: boolean;
  path?: string;
}

export default function MarketplacePage() {
  const [routes, setRoutes] = useState<Record<string, { path: string; endpoint: string }>>({});

  // fetch route registry from middleware
  useEffect(() => {
    fetch(`${MIDDLEWARE_URL}/routes`)
      .then((r) => r.json())
      .then(setRoutes)
      .catch(() => {});
  }, []);

  const { data: nextApiId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "nextApiId",
  });

  const count = nextApiId ? Number(nextApiId) : 0;

  const { data: listingResults, isLoading } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: CONTRACT_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "listings" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0 },
  });

  const listings: Listing[] = (listingResults ?? [])
    .map((result, i) => {
      if (result.status !== "success" || !result.result) return null;
      const [merchant, name, description, price, active] = result.result as [string, string, string, bigint, boolean];
      if (!active) return null;
      return {
        id: i,
        merchant,
        name,
        description,
        price,
        active,
        path: routes[String(i)]?.path,
      };
    })
    .filter(Boolean) as Listing[];

  return (
    <main className="min-h-screen bg-[#0f0d1a] text-white">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex justify-between items-center">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <Link href="/buyer" className="border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-4 py-1.5 text-sm transition-colors">
          Buy access →
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-[10px] font-mono text-violet-500 tracking-widest uppercase mb-2 block">live on sepolia</span>
          <h1 className="text-3xl font-bold text-white">API Marketplace</h1>
          <p className="text-sm text-[#5a4f6a] mt-2">
            {count > 0 ? `${listings.length} active API${listings.length !== 1 ? "s" : ""}` : "loading..."}
          </p>
        </div>

        {isLoading && (
          <div className="text-sm text-[#5a4f6a]">fetching listings from chain...</div>
        )}

        {!isLoading && listings.length === 0 && count > 0 && (
          <div className="text-sm text-[#5a4f6a]">no active listings found.</div>
        )}

        {!isLoading && count === 0 && !isLoading && (
          <div className="text-sm text-[#5a4f6a]">no APIs listed yet. <Link href="/merchant" className="text-violet-400 hover:underline">List yours →</Link></div>
        )}

        <div className="flex flex-col gap-4">
          {listings.map((api) => (
            <div key={api.id} className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-[#3a2f4a]">#{api.id}</span>
                    <h2 className="font-semibold text-white">{api.name}</h2>
                  </div>
                  <p className="text-sm text-[#5a4f6a]">{api.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-mono font-semibold text-violet-400">
                    ${(Number(api.price) / 1_000_000).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#3a2f4a] font-mono">per call</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#1e1730]">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#3a2f4a] font-mono">
                    {api.merchant.slice(0, 6)}...{api.merchant.slice(-4)}
                  </span>
                  {api.path && (
                    <span className="text-xs font-mono text-[#5a4f6a] bg-[#0f0d1a] px-2 py-0.5 rounded border border-[#1e1730]">
                      {api.path}
                    </span>
                  )}
                </div>
                <Link
                  href={`/buyer?apiId=${api.id}`}
                  className="text-xs border border-violet-800/60 text-violet-400 hover:bg-violet-950/40 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Call API →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}