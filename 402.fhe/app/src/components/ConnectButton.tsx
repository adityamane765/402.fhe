"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useState, useEffect, useRef } from "react";

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isNightly?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  [key: string]: unknown;
};

type WindowWithProviders = {
  ethereum?: InjectedProvider & { providers?: InjectedProvider[] };
};

function getWalletName(p: InjectedProvider): string {
  if (p.isNightly) return "Nightly";
  if (p.isCoinbaseWallet) return "Coinbase Wallet";
  if (p.isRabby) return "Rabby";
  if (p.isBraveWallet) return "Brave Wallet";
  if (p.isMetaMask) return "MetaMask";
  return "Browser Wallet";
}

function getAvailableProviders(): { name: string; provider: InjectedProvider }[] {
  const win = window as unknown as WindowWithProviders;
  if (!win.ethereum) return [];
  const list = win.ethereum.providers ?? [win.ethereum];
  const seen = new Set<string>();
  return list
    .map((p) => ({ name: getWalletName(p), provider: p }))
    .filter(({ name }) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [providers, setProviders] = useState<{ name: string; provider: InjectedProvider }[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    const scan = () => setProviders(getAvailableProviders());

    // initial scan after a short delay so late-injecting wallets (e.g. Nightly) are present
    const t = setTimeout(scan, 300);

    // re-scan whenever any wallet announces itself
    window.addEventListener("eip6963:announceProvider", scan);

    return () => {
      clearTimeout(t);
      window.removeEventListener("eip6963:announceProvider", scan);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  if (!mounted) return null;

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-[#5a4f6a]">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-[#1e1730] hover:border-violet-800 text-[#5a4f6a] hover:text-violet-400 rounded-lg px-3 py-1.5 text-xs transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  const handleConnect = async (provider: InjectedProvider) => {
    setShowPicker(false);
    // request accounts directly on the chosen provider first,
    // then connect wagmi using that provider as the injected target
    try {
      await provider.request({ method: "eth_requestAccounts" });
    } catch {
      return;
    }
    connect({
      connector: injected({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        target: () => ({
          id: getWalletName(provider).toLowerCase().replace(/\s+/g, "-"),
          name: getWalletName(provider),
          provider: provider as any,
        }),
      }),
    });
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => {
          if (providers.length === 0) {
            connect({ connector: injected() });
          } else if (providers.length === 1) {
            handleConnect(providers[0].provider);
          } else {
            setShowPicker((v) => !v);
          }
        }}
        className="bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        Connect Wallet
      </button>

      {showPicker && (
        <div className="absolute right-0 mt-2 w-52 bg-[#12102a] border border-[#1e1730] rounded-xl overflow-hidden shadow-xl z-50">
          <p className="px-4 py-2.5 text-[10px] font-mono text-[#3a2f4a] uppercase tracking-widest border-b border-[#1e1730]">
            Select wallet
          </p>
          {providers.map(({ name, provider }) => (
            <button
              key={name}
              onClick={() => handleConnect(provider)}
              className="w-full text-left px-4 py-3 text-sm text-[#9d8fae] hover:text-white hover:bg-violet-950/40 transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
