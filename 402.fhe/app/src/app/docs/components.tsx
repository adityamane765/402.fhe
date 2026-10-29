import type { ReactNode } from "react";
import { CopyCodeButton } from "./CopyCodeButton";

export function Eyebrow({children,tone="violet"}:{children:ReactNode;tone?:"violet"|"cyan"|"amber"}) { const color=tone==="cyan"?"text-cyan-300":tone==="amber"?"text-amber-300":"text-violet-300"; const dot=tone==="cyan"?"bg-cyan-300":tone==="amber"?"bg-amber-300":"bg-violet-400"; return <p className={`flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em] ${color}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`}/>{children}</p>; }

export function SectionHeading({eyebrow,title,body,tone="violet"}:{eyebrow:string;title:string;body?:ReactNode;tone?:"violet"|"cyan"|"amber"}) { return <div className="mb-9 max-w-3xl"><Eyebrow tone={tone}>{eyebrow}</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[42px] sm:leading-[1.08]">{title}</h2>{body&&<p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#9d96aa]">{body}</p>}</div>; }

export function CodeBlock({label,children}:{label:string;children:string}) { return <div className="overflow-hidden rounded-xl border border-white/[0.09] bg-[#08070c] shadow-[0_18px_60px_rgba(0,0,0,.25)]"><div className="flex h-10 items-center border-b border-white/[0.07] px-4"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#ff6b72]"/><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[#eab35c]"/><span className="h-1.5 w-1.5 rounded-full bg-[#5bc8a8]"/><span className="ml-auto mr-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#635b70]">{label}</span><CopyCodeButton code={children}/></div><pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-[#cfc8d8]"><code>{children}</code></pre></div>; }

export function Note({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"violet"|"amber"}) { const cls=tone==="amber"?"border-amber-300/15 bg-amber-300/[0.035] text-[#b7aa91]":tone==="violet"?"border-violet-400/20 bg-violet-400/[0.05] text-[#aaa0b9]":"border-white/[0.08] bg-white/[0.02] text-[#91899d]"; return <div className={`rounded-lg border px-4 py-3 text-xs leading-6 ${cls}`}>{children}</div>; }

