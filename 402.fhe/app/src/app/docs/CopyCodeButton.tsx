"use client";

import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copyCode}
      className="rounded border border-white/[0.09] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#8b8395] transition-colors hover:border-white/[0.18] hover:text-white"
      aria-label="Copy code"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
