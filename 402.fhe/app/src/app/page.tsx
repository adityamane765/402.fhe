import Link from "next/link";

const roles = [
  {
    title: "Buyer",
    description: "Deposit USDC and call APIs. Pay per request — your balance stays encrypted on-chain.",
    href: "/buyer",
    cta: "Enter as Buyer",
  },
  {
    title: "Merchant",
    description: "List your API, set a price per call, and earn USDC. Your revenue stays encrypted.",
    href: "/merchant",
    cta: "Enter as Merchant",
  },
  {
    title: "Operator",
    description: "See what we see. All balances are encrypted — cryptographically, not by policy.",
    href: "/operator",
    cta: "View Operator Dashboard",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fffaf7] flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-5xl font-bold text-[#1a1523] mb-4 tracking-tight">402.fhe</h1>
        <p className="text-[#6b5e7a] text-lg max-w-lg mx-auto leading-relaxed">
          The confidential API marketplace. Pay per call, settle on-chain.
          Balances encrypted with{" "}
          <a
            href="https://www.zama.ai"
            className="text-[#7c3aed] hover:underline"
            target="_blank"
            rel="noopener"
          >
            Zama fhEVM
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {roles.map((role) => (
          <Link key={role.href} href={role.href}>
            <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-7 h-full flex flex-col hover:border-[#7c3aed] hover:shadow-md transition-all cursor-pointer group">
              <h2 className="text-xl font-semibold text-[#1a1523] mb-2 group-hover:text-[#7c3aed] transition-colors">
                {role.title}
              </h2>
              <p className="text-[#6b5e7a] text-sm flex-1 mb-6 leading-relaxed">
                {role.description}
              </p>
              <span className="text-[#7c3aed] text-sm font-medium">
                {role.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-16 text-xs text-[#6b5e7a]">
        Built for the{" "}
        <a href="https://www.zama.ai/builders" className="hover:underline" target="_blank" rel="noopener">
          Zama Builder Program
        </a>
      </p>
    </main>
  );
}
