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
type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function patchWindowEthereum() {
  const win = window as unknown as { ethereum?: EthProvider };
  if (typeof window === "undefined" || !win.ethereum) return;
  const provider = win.ethereum;
  const original = provider.request.bind(provider);
  win.ethereum!.request = async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (Array.isArray(params) && params.length > 0) {
      const tx = params[0] as { to?: string; gas?: string };
      if (tx?.to?.toLowerCase() === CONTRACT_ADDRESS) {
        if (method === "eth_estimateGas") {
          return "0x989680"; // 10M — under the 16.7M cap, enough for fhEVM ops
        }
        if (method === "eth_sendTransaction") {
          // always override — viem estimates via its own RPC transport, bypassing our eth_estimateGas intercept
          params = [{ ...tx, gas: "0x989680" }, ...params.slice(1)];
        }
      }
    }
    return original({ method, params });
  };
}

const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: { [sepolia.id]: http("https://ethereum-sepolia-rpc.publicnode.com") },
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