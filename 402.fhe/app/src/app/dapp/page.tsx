"use client";
import Link from "next/link";
import { useState } from "react";

const roles = [
  { index: 1, label: "buyer", hint: "agent / user", href: "/buyer" },
  { index: 2, label: "merchant", hint: "api provider", href: "/merchant" },
  { index: 3, label: "operator", hint: "marketplace", href: "/operator" },
];

export default function DappPage() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0f0d1a] text-white flex flex-col">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <Link href="/docs" className="text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          docs
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl overflow-hidden border border-[#1e1730]" style={{ background: "#0d0d0f" }}>

            {/* title bar */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#1a1a1f]">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>

            {/* terminal body */}
            <div className="px-5 py-6 font-mono text-sm leading-7">

              {/* command */}
              <div className="flex items-center gap-2 text-[#555]">
                <span className="text-[#3a3a3a]">402.fhe</span>
                <span className="text-[#3a3a3a]">~</span>
                <span className="text-[#4a7c59]">$</span>
                <span className="text-[#666]">select --role</span>
              </div>

              {/* output header */}
              <div className="mt-4 mb-2 text-[#3a3a3a] text-xs tracking-widest uppercase">
                available roles:
              </div>

              {/* role list */}
              <div className="flex flex-col">
                {roles.map((role) => (
                  <Link key={role.href} href={role.href}>
                    <div
                      className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded cursor-pointer transition-all duration-100 group"
                      onMouseEnter={() => setHovered(role.index)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <span className="text-[#3a3a3a] w-5 shrink-0">
                        {hovered === role.index ? "›" : `[${role.index}]`}
                      </span>
                      <span
                        className="transition-colors duration-100"
                        style={{ color: hovered === role.index ? "#e2e2e2" : "#888" }}
                      >
                        {role.label}
                      </span>
                      <span className="text-[#3a3a3a] text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                        # {role.hint}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* blinking cursor
              <div className="mt-4 flex items-center gap-2 text-[#4a7c59]">
                <span>›</span>
                <span className="inline-block w-2 h-4 bg-[#4a7c59] opacity-60 animate-pulse" />
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
