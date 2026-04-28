"use client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { useState, useEffect } from "react";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "").toLowerCase();

// fhEVM's eth_estimateGas returns 21M for our contract, exceeding wallet block gas caps.
// patch all injected providers so whichever wallet the user picks gets the override.
type EthProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; _fhePatchedGas?: boolean };
type WindowWithProviders = { ethereum?: EthProvider & { providers?: EthProvider[] } };

function patchProvider(provider: EthProvider) {
  if (provider._fhePatchedGas) return;
  provider._fhePatchedGas = true;
  const original = provider.request.bind(provider);
  provider.request = async ({ method, params }: { method: string; params?: unknown[] }) => {
    if (Array.isArray(params) && params.length > 0) {
      const tx = params[0] as { to?: string; gas?: string };
      if (tx?.to?.toLowerCase() === CONTRACT_ADDRESS) {
        if (method === "eth_estimateGas") {
          return "0x989680"; // 10M — under the 16.7M cap, enough for fhEVM ops
        }
        if (method === "eth_sendTransaction") {
          params = [{ ...tx, gas: "0x989680" }, ...params.slice(1)];
        }
      }
    }
    return original({ method, params });
  };
}

function patchWindowEthereum() {
  const win = window as unknown as WindowWithProviders;
  if (typeof window === "undefined" || !win.ethereum) return;
  const all = win.ethereum.providers ?? [win.ethereum];
  all.forEach(patchProvider);
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