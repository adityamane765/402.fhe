"use client";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#6b5e7a] font-mono">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-[#e8e0d8] text-[#6b5e7a] rounded-lg px-4 py-2 text-sm hover:border-[#7c3aed] hover:text-[#7c3aed] transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="bg-[#7c3aed] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#6d28d9] transition-colors"
    >
      Connect Wallet
    </button>
  );
}
