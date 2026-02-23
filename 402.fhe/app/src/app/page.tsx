import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0f0d1a] text-white overflow-x-hidden">

      {/* nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
        <span className="font-mono text-sm text-[#5a4f6a]">402.fhe</span>
        <div className="flex items-center gap-6 text-sm text-[#5a4f6a]">
          <Link href="/docs" className="hover:text-violet-400 transition-colors">docs</Link>
          <Link href="/dapp" className="hover:text-violet-400 transition-colors">dApp</Link>
        </div>
      </nav>

      {/* hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pb-24 pt-16">

        {/* background grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(167,139,250,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(167,139,250,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        {/* radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 65%)",
          }}
        />

        {/* SVG encryption ring */}
        <div className="relative mb-12">
          <svg width="220" height="220" viewBox="0 0 220 220" className="animate-spin-slow">
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(167,139,250,0.15)" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="110" cy="110" r="72" fill="none" stroke="rgba(167,139,250,0.3)" strokeWidth="1.5" />
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="2" strokeDasharray="40 591" strokeLinecap="round" />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x = 110 + 100 * Math.cos(rad);
              const y = 110 + 100 * Math.sin(rad);
              return <circle key={deg} cx={x} cy={y} r="3.5" fill="rgba(167,139,250,0.75)" />;
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-violet-400">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[9px] font-mono text-violet-400 tracking-widest opacity-80">x402</span>
            </div>
          </div>
        </div>

        {/* headline */}
        <div className="text-center max-w-3xl mx-auto relative z-10">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            <span className="text-white">402.fhe</span>
          </h1>

          <p
            className="text-lg max-w-xl mx-auto leading-relaxed mb-10 font-medium"
            style={{ background: "linear-gradient(90deg, #c4b5fd 0%, #a78bfa 40%, #7c3aed 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            private payments for public APIs
          </p>

        </div>
      </section>

    </div>
  );
}
