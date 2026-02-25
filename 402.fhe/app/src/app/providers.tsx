"use client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { useState, useEffect } from "react";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "").toLowerCase();

// fhEVM's eth_estimateGas returns 21M for our contract, exceeding MetaMask's 16.7M block gas cap.
// we patch window.ethereum.request directly so MetaMask's own pre-flight estimation gets intercepted
// before it has a chance to override the tx gas limit.
function patchWindowEthereum() {
  if (typeof window === "undefined" || !window.ethereum) return;
  const provider = window.ethereum as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  const original = provider.request.bind(provider);
  provider.request = async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (method === "eth_estimateGas" && Array.isArray(params) && params.length > 0) {
      const tx = params[0] as { to?: string };
      if (tx?.to?.toLowerCase() === CONTRACT_ADDRESS) {
        return "0x989680"; // 10M — under the 16.7M cap, enough for fhEVM ops
      }
    }
    return original({ method, params });
  };
}

const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http() },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => { patchWindowEthereum(); }, []);
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}