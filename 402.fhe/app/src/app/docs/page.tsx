import Link from "next/link";

const stats = [
  { label: "calls settled", value: "on-chain" },
  { label: "operator visibility", value: "zero" },
  { label: "gas per API call", value: "none" },
  { label: "encryption", value: "FHE" },
];

const steps = [
  { step: "01", title: "Deposit", body: "Buyer deposits USDC. Balance is wrapped as an encrypted euint64 — only the buyer can decrypt it." },
  { step: "02", title: "Request", body: "Buyer hits the API endpoint. Middleware issues a 402 challenge with a nonce." },
  { step: "03", title: "Sign", body: "Buyer signs the nonce with their wallet. No gas. No transaction. Just a signature." },
  { step: "04", title: "Settle", body: "Middleware verifies, proxies to merchant, then queues an on-chain settleCall — FHE mux deducts only if affordable." },
];

const sections = [
  {
    id: "intro",
    label: "The problem",
  },
  {
    id: "overview",
    label: "Overview",
  },
  {
    id: "how-it-works",
    label: "How it works",
  },
  {
    id: "fhe-guarantee",
    label: "FHE guarantee",
  },
  {
    id: "contract",
    label: "Contract",
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0f0d1a] text-white">
      <nav className="border-b border-[#1e1730] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-mono text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
          ← 402.fhe
        </Link>
        <Link href="/dapp" className="text-xs font-mono text-[#3a2f4a]">dApp</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16 flex gap-16">

        {/* sidebar */}
        <aside className="hidden md:block w-44 shrink-0">
          <div className="sticky top-10">
            <p className="text-[10px] font-mono text-[#3a2f4a] uppercase tracking-widest mb-4">On this page</p>
            <ul className="flex flex-col gap-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-sm text-[#5a4f6a] hover:text-violet-400 transition-colors">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* content */}
        <div className="flex-1 min-w-0">

          {/* page title */}
          <div id="intro" className="mb-14">
            <span className="text-[10px] font-mono text-violet-500 tracking-widest uppercase mb-2 block">documentation</span>
            <h1 className="text-4xl font-bold text-white mb-4">How 402.fhe works</h1>
            <div className="text-[#5a4f6a] leading-relaxed max-w-2xl space-y-4">
              <p>
                API marketplaces today require trust in the operator. The platform can see how much every buyer has deposited, how much every merchant has earned, and which APIs are being called most. That data is valuable and it shouldn't be visible to anyone who doesn't need it.
              </p>
              <p>
                402.fhe fixes this with{" "}
                <a href="https://www.zama.ai" className="text-violet-400 hover:text-violet-300 transition-colors" target="_blank" rel="noopener">Zama fhEVM</a>
                . 
                <br></br>
                Buyer balances and merchant revenues are stored as ciphertexts on-chain. Payments settle automatically via the middleware — no operator action needed. The operator's only active role is processing withdrawal requests, and even then they never see a plaintext amount. Cryptographically enforced, not a policy claim.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {[
                  "Merchants list APIs with cleartext prices.",
                  "AI agents pay per call via x402 HTTP payments — no gas, just a wallet signature.",
                  "The middleware verifies the signature and proxies the request to the merchant.",
                  "Settlement happens on-chain via an FHE mux that deducts from the buyer's encrypted balance only if they can afford it.",
                ].map((line, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="text-[#3a2f4a] font-mono text-xs mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* overview */}
          <section id="overview" className="mb-16 scroll-mt-8">
            <h2 className="text-xl font-semibold text-white mb-6">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1e1730] rounded-2xl overflow-hidden mb-8">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#12102a] px-6 py-8 flex flex-col gap-1">
                  <span
                    className="text-2xl font-bold"
                    style={{ background: "linear-gradient(135deg, #a78bfa, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                  >
                    {s.value}
                  </span>
                  <span className="text-xs text-[#3a2f4a] uppercase tracking-widest">{s.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* how it works */}
          <section id="how-it-works" className="mb-16 scroll-mt-8">
            <h2 className="text-xl font-semibold text-white mb-6">How a call happens</h2>
            <div className="flex flex-col gap-px bg-[#1e1730] rounded-2xl overflow-hidden">
              {steps.map((item) => (
                <div key={item.step} className="bg-[#12102a] px-6 py-6 flex gap-6 items-start">
                  <span className="text-xs font-mono text-violet-800 mt-0.5 shrink-0">{item.step}</span>
                  <div>
                    <h3 className="text-white font-semibold mb-1">{item.title}</h3>
                    <p className="text-[#5a4f6a] text-sm leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* fhe guarantee */}
          <section id="fhe-guarantee" className="mb-16 scroll-mt-8">
            <h2 className="text-xl font-semibold text-white mb-6">FHE guarantee</h2>
            <div className="bg-[#12102a] border border-[#1e1730] rounded-2xl p-8 flex flex-col md:flex-row gap-10 items-start">
              <div className="flex-1 text-sm text-[#5a4f6a] leading-relaxed space-y-3">
                <p>
                  Balances and revenues live on-chain as{" "}
                  <code className="text-violet-400 font-mono text-xs bg-violet-950/60 px-1.5 py-0.5 rounded">euint64</code>{" "}
                  ciphertexts. The operator cannot run a query that returns plaintext values.
                </p>
                <p>
                  The FHE mux inside{" "}
                  <code className="text-violet-400 font-mono text-xs bg-violet-950/60 px-1.5 py-0.5 rounded">settleCall</code>{" "}
                  deducts from the buyer balance and adds to merchant revenue — all without decrypting either value. The deduction only happens if an encrypted{" "}
                  <code className="text-violet-400 font-mono text-xs bg-violet-950/60 px-1.5 py-0.5 rounded">ebool</code>{" "}
                  (affordable flag) is true.
                </p>
                <p>
                  Withdrawals use a two-step event relay: the merchant emits a{" "}
                  <code className="text-violet-400 font-mono text-xs bg-violet-950/60 px-1.5 py-0.5 rounded">requestWithdrawal</code>{" "}
                  event, the operator decrypts off-chain via the KMS, then calls{" "}
                  <code className="text-violet-400 font-mono text-xs bg-violet-950/60 px-1.5 py-0.5 rounded">fulfillWithdrawal</code>{" "}
                  with a KMS proof.
                </p>
              </div>
              <div className="shrink-0 font-mono text-xs leading-7 bg-[#0f0d1a] border border-[#1e1730] rounded-xl p-6">
                <div className="text-[#3a2f4a] mb-1">{"// what the operator sees"}</div>
                <div><span className="text-violet-500">buyer</span><span className="text-[#5a4f6a]">.balance  = </span><span className="text-pink-400">0x7f3a9c...</span></div>
                <div><span className="text-violet-500">merchant</span><span className="text-[#5a4f6a]">.revenue = </span><span className="text-pink-400">0xc2d18e...</span></div>
                <div><span className="text-violet-500">protocol</span><span className="text-[#5a4f6a]">.fees    = </span><span className="text-pink-400">0x09ef31...</span></div>
                <div className="mt-2 text-[#3a2f4a]">{"// no usage data leakage"}</div>
              </div>
            </div>
          </section>

          {/* contract */}
          <section id="contract" className="mb-16 scroll-mt-8">
            <h2 className="text-xl font-semibold text-white mb-6">Contract</h2>
            <div className="space-y-4">
              {/* addresses */}
              <div className="bg-[#12102a] border border-[#1e1730] rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-[#1e1730]">
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-mono text-[#3a2f4a] uppercase tracking-widest shrink-0">Contract · Sepolia</span>
                    <code className="text-violet-400 font-mono text-xs">0x4Ff4a147f6e052398B8C0962c6cd4Fa4f34d2826</code>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-mono text-[#3a2f4a] uppercase tracking-widest shrink-0">Payment token</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#3a2f4a] text-xs shrink-0">USDC</span>
                      <code className="text-violet-400 font-mono text-xs">0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* functions */}
              <div className="bg-[#12102a] border border-[#1e1730] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#1e1730]">
                  <span className="text-xs font-mono text-[#3a2f4a] uppercase tracking-widest">Key functions</span>
                </div>
                <div className="divide-y divide-[#1e1730]">
                  {[
                    { fn: "listApi(name, description, price)", desc: "Merchant lists an API with a cleartext USDC price per call." },
                    { fn: "deposit(amount)", desc: "Buyer deposits USDC. Balance is encrypted as euint64 on-chain." },
                    { fn: "canAfford(apiId, buyer)", desc: "Middleware-only eth_call. Returns encrypted ebool — no plaintext." },
                    { fn: "settleCall(apiId, buyer)", desc: "Middleware-only. FHE mux deducts from buyer, credits merchant and protocol — all encrypted." },
                    { fn: "requestWithdrawal()", desc: "Merchant signals intent to withdraw. Starts the two-step off-chain relay." },
                    { fn: "fulfillWithdrawal(merchant, amount, proof)", desc: "Owner submits KMS proof to release funds." },
                  ].map((item) => (
                    <div key={item.fn} className="px-5 py-3.5 flex flex-col md:flex-row md:items-center gap-1 md:gap-6">
                      <code className="text-violet-400 font-mono text-xs shrink-0">{item.fn}</code>
                      <span className="text-[#5a4f6a] text-xs">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
