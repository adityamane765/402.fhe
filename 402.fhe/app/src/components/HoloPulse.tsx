"use client";
import React from "react";
import { PlusIcon } from "lucide-react";

interface HoloPulseProps {
  label?: string;
}

export function HoloPulse({ label = "confirming" }: HoloPulseProps) {
  const [dots, setDots] = React.useState("");

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 bg-violet-500/10 blur-xl rounded-full scale-150 animate-pulse" />

        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="absolute w-px h-16 bg-violet-500" />
          <div className="absolute w-16 h-px bg-violet-500" />
        </div>

        <div className="relative p-2 border border-dashed border-violet-500/20 rounded-full animate-[spin_2s_linear_infinite]">
          <div className="w-14 h-14 border border-dashed border-violet-400/40 rounded-full flex justify-center items-center animate-[spin_1.2s_linear_infinite_reverse]">
            <div className="relative z-10 p-1 bg-[#0f0d1a] rounded-full border border-violet-500/30 shadow-[0_0_15px_-5px_#7c3aed]">
              <PlusIcon size={16} className="text-violet-500 animate-[pulse_2s_ease-in-out_infinite]" />
            </div>
          </div>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-violet-500 rounded-full shadow-[0_0_8px_#7c3aed]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_8px_#7c3aed]" />
          <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-violet-400 rounded-full shadow-[0_0_8px_#7c3aed]" />
          <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-violet-500 rounded-full shadow-[0_0_8px_#7c3aed]" />
        </div>
      </div>

      <p className="text-[10px] font-mono tracking-[0.3em] text-violet-500 uppercase">
        {label}{dots}
      </p>
    </div>
  );
}
