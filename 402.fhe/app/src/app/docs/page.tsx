import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock, Eyebrow, Note, SectionHeading } from "./components";
import {
  boundaries,
  callerExample,
  callerOutput,
  callerSetup,
  endpoints,
  lifecycle,
  mcpConfig,
  mcpSetup,
  mcpTools,
  navItems,
  providerCommands,
  tasks,
  troubleshooting,
} from "./content";

export const metadata: Metadata = {
  title: "Developer guide | 402.fhe",
  description: "Call metered HTTP APIs, meter a JSON endpoint, and settle usage against FHE contract state.",
};

const sectionClass = "scroll-mt-24 border-t border-white/[0.08] py-20 sm:py-28";

export default function DevelopersPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0b0910] text-white selection:bg-violet-400/25">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_at_top,rgba(119,72,190,.13),transparent_66%)]" />
      <Header />

      <main className="relative mx-auto max-w-[1280px] px-5 sm:px-8">
        <section className="grid min-h-[calc(100vh-64px)] items-center gap-12 py-16 lg:grid-cols-[.9fr_1.1fr] lg:py-24">
          <div>
            <Eyebrow>402.fhe for developers</Eyebrow>
            <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[1.03] tracking-[-0.055em] sm:text-6xl">
              <span className="block">Private API calls.</span><span className="block text-[#aaa0ba]">Settled with FHE.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#a19aaa]">
              <span className="block">402.fhe enables confidential, pay-per-call API access.</span><span className="block">Clients use HTTP 402 for authorization, then settle usage against FHE-encrypted buyer balances and provider revenue.</span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#caller" className="rounded-md bg-violet-300 px-4 py-2.5 font-mono text-[10px] font-bold text-[#160f1d] hover:-translate-y-0.5">Call an API</Link>
              <Link href="#provider" className="rounded-md border border-white/[0.12] px-4 py-2.5 font-mono text-[10px] text-[#c2bacd] hover:border-white/25">Meter an endpoint</Link>
              <Link href="/docs/guide" className="rounded-md border border-white/[0.12] px-4 py-2.5 font-mono text-[10px] text-[#c2bacd] hover:border-white/25">Full docs</Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#100d17] p-5 shadow-[0_35px_110px_rgba(0,0,0,.42)] sm:p-7">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(167,139,250,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(167,139,250,.035)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="relative space-y-5">
              <LaneLabel label="Request" value="HTTP" />
              <div className="grid grid-cols-1 items-center gap-2 text-center sm:grid-cols-[1fr_26px_1fr_26px_1fr]">
                <FlowBox label="CALLER" value="GET + X-Payment" tone="violet" />
                <Arrow />
                <FlowBox label="MIDDLEWARE" value="verify · record" tone="neutral" />
                <Arrow />
                <FlowBox label="UPSTREAM" value="JSON response" tone="cyan" />
              </div>
              <div className="mx-auto flex w-[72%] items-center gap-3 py-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-violet-400/35" />
                <span className="font-mono text-[8px] text-[#655c70]">pending calls ↓</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-violet-400/35" />
              </div>
              <LaneLabel label="Bilateral settlement" value="FHE" />
              <div className="grid grid-cols-1 items-center gap-2 text-center sm:grid-cols-[1fr_26px_1fr_26px_1fr]">
                <FlowBox label="CHANNEL" value="buyer ↔ API · N calls" tone="violet" />
                <Arrow />
                <FlowBox label="CONTRACT" value="batchSettle()" tone="neutral" />
                <Arrow />
                <FlowBox label="STATE" value="balance · revenue" tone="cyan" />
              </div>
              <p className="pt-1 text-center font-mono text-[9px] leading-5 text-[#5e5668]">The API response does not wait for on-chain settlement.</p>
            </div>
          </div>
        </section>

        <section id="start" className={sectionClass}>
          <SectionHeading eyebrow="Start" title="Choose an integration." body="You can use the Python client, connect through MCP, or meter your API." />
          <div className="grid gap-4 lg:grid-cols-3">
            {tasks.map((task) => (
              <Link key={task.number} href={task.href} className="group relative overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.018] p-6 transition-all hover:-translate-y-1 hover:border-white/[0.18]">
                <span className="absolute right-4 top-1 font-mono text-7xl font-bold text-white/[0.025]">{task.number}</span>
                <p className={`font-mono text-[9px] uppercase tracking-[.18em] ${task.tone === "cyan" ? "text-cyan-300" : task.tone === "amber" ? "text-amber-300" : "text-violet-300"}`}>{task.label}</p>
                <h3 className="mt-5 text-xl font-semibold tracking-[-.025em]">{task.title}</h3>
                <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#8f879a]">{task.description}</p>
                <p className="mt-7 border-t border-white/[0.07] pt-4 font-mono text-[9px] text-[#9b92a7]">{task.link} →</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="caller" className={sectionClass}>
          <SectionHeading eyebrow="Caller" title="Call a metered API from Python." body="FHE402Client requests the route, signs the returned challenge, and retries with X-Payment." />
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <CodeBlock label="terminal · setup">{callerSetup}</CodeBlock>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-6">
              <p className="font-mono text-[9px] uppercase tracking-[.18em] text-violet-300">Before you call</p>
              <p className="mt-4 text-sm leading-6 text-[#91899d]">Use a dedicated wallet. Deposit USDC into its 402.fhe balance so a later settlement can deduct the call price.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/buyer" className="rounded-md bg-violet-300 px-3 py-2 font-mono text-[10px] font-bold text-[#160f1d]">Fund caller wallet →</Link>
                <Link href="/marketplace" className="rounded-md border border-white/[0.12] px-3 py-2 font-mono text-[10px] text-[#bbb2c6]">View APIs →</Link>
              </div>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
            <div className="space-y-3">
              {[
                ["01", "Fund a dedicated wallet", "Approve USDC and deposit it from the buyer screen."],
                ["02", "Install the client", "Create a Python environment and install agent/requirements.txt."],
                ["03", "Set the environment", "Provide AGENT_PRIVATE_KEY and MIDDLEWARE_URL."],
                ["04", "Call and settle", "Call a registered path, then request settlement separately."],
              ].map(([number, title, body]) => (
                <div key={number} className="grid grid-cols-[34px_1fr] gap-3 rounded-lg border border-white/[0.07] bg-white/[0.015] p-4">
                  <span className="font-mono text-[9px] text-violet-300">{number}</span>
                  <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#81798c]">{body}</p></div>
                </div>
              ))}
            </div>
            <CodeBlock label="python">{callerExample}</CodeBlock>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <CodeBlock label="example output">{callerOutput}</CodeBlock>
            <div className="rounded-xl border border-white/[0.08] bg-[#100d17] p-6">
              <p className="font-mono text-[9px] uppercase tracking-[.18em] text-violet-300">Client flow</p>
              <ol className="mt-5 space-y-4 text-sm leading-6 text-[#948b9f]">
                {["Request the middleware path.", "Receive the API ID and nonce in a 402 response.", "Sign apiId:nonce with the caller wallet.", "Retry with the encoded payment header.", "Request settlement when you are ready."].map((item, index) => <li key={item} className="flex gap-3"><span className="font-mono text-[9px] text-[#61586c]">0{index + 1}</span>{item}</li>)}
              </ol>
            </div>
          </div>
        </section>

        <section id="agents" className={sectionClass}>
          <SectionHeading eyebrow="MCP" title="Expose four tools to an agent." body={<><span className="block">The MCP process owns the wallet key.</span><span className="block">Before calling an API, it compares the public price with MAX_CALL_PRICE_USDC.</span></>} tone="cyan" />
          <div className="mb-6 grid gap-6 lg:grid-cols-2"><CodeBlock label="terminal · setup">{mcpSetup}</CodeBlock><CodeBlock label="MCP client config">{mcpConfig}</CodeBlock></div>
          <div className="grid gap-3 sm:grid-cols-2">{mcpTools.map(([tool, description]) => <div key={tool} className="rounded-lg border border-cyan-300/10 bg-cyan-300/[0.025] p-4"><code className="font-mono text-[11px] text-cyan-200">{tool}</code><p className="mt-2 text-xs leading-5 text-[#898293]">{description}</p></div>)}</div>
          <div className="mt-5"><Note><strong className="text-[#d7cfdf]">Wallet boundary:</strong> use a dedicated key. It remains in the MCP process and is not returned by a tool. The configured cap applies to one call, not the whole session.</Note></div>
        </section>

        <section id="provider" className={sectionClass}>
          <SectionHeading eyebrow="Provider" title="Meter a JSON endpoint." body="Create an on-chain listing for the price and API ID. Then register a middleware path for that ID and its upstream URL." tone="amber" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Create a listing", "Set the name, description, and per-call USDC price in the merchant screen."],
              ["02", "Copy the API ID", "Use the numeric ID returned by the listing transaction."],
              ["03", "Register the route", "Map the API ID to a public middleware path and upstream URL."],
              ["04", "Verify the flow", "Check the 402 response, make an authorized call, and inspect pending usage."],
            ].map(([number, title, body]) => <div key={number} className="rounded-xl border border-white/[0.08] bg-white/[0.015] p-5"><span className="font-mono text-[9px] text-amber-300">{number}</span><h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-5 text-[#837b8d]">{body}</p></div>)}
          </div>
          <Link href="/merchant" className="mt-5 inline-block font-mono text-[10px] text-amber-200">Open merchant setup →</Link>
          <div className="mt-7 grid gap-6 lg:grid-cols-2"><CodeBlock label="register route · replace apiId">{providerCommands.register}</CodeBlock><CodeBlock label="check challenge">{providerCommands.verify}</CodeBlock></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[.9fr_1.1fr]"><CodeBlock label="inspect and settle">{providerCommands.settle}</CodeBlock><div className="flex items-center"><Note><strong className="text-[#d7cfdf]">Route storage:</strong> POST /register writes to routes.json. Protect the upstream separately if requests must pass through the middleware.</Note></div></div>
        </section>

        <section id="lifecycle" className={sectionClass}>
          <SectionHeading eyebrow="Request flow" title="From challenge to channel settlement." body="Each buyer and API pair has its own pending channel. The buyer, the provider, or the 50-call threshold can trigger settlement without a cooperative close." />
          <div className="relative grid gap-3 lg:grid-cols-6"><div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-violet-400/0 via-violet-400/30 to-cyan-300/0 lg:block" />{lifecycle.map(([number, title, body], index) => <div key={number} className="relative rounded-xl border border-white/[0.08] bg-[#100d17] p-4"><span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[9px] ${index < 5 ? "border-violet-400/25 bg-violet-400/[0.08] text-violet-300" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-200"}`}>{number}</span><h3 className="mt-5 text-sm font-semibold">{title}</h3><p className="mt-2 text-[11px] leading-5 text-[#81798c]">{body}</p></div>)}</div>
          <div className="mt-8 grid gap-4 md:grid-cols-3"><Metric value="0" label="on-chain transactions before the API response" /><Metric value="50" label="pending calls that trigger settlement for one buyer and API pair" /><Metric value="90 / 10" label="merchant and protocol share of each settled price" /></div>
        </section>

        <section id="reference" className={sectionClass}>
          <SectionHeading eyebrow="Reference" title="Middleware endpoints." body="These are the HTTP routes exposed by the current middleware." />
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0f0c16]">{endpoints.map(([method, path, description]) => <div key={path} className="grid gap-3 border-t border-white/[0.07] px-5 py-4 first:border-t-0 sm:grid-cols-[60px_220px_1fr]"><span className={`w-fit rounded px-2 py-1 font-mono text-[9px] ${method === "POST" ? "bg-cyan-300/10 text-cyan-200" : "bg-violet-400/10 text-violet-300"}`}>{method}</span><code className="font-mono text-xs text-[#d7cfdf]">{path}</code><p className="text-xs leading-5 text-[#898191]">{description}</p></div>)}</div>
          <details className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5"><summary className="cursor-pointer text-sm font-semibold text-[#d8d0e0]">Contract functions used by the app</summary><div className="mt-5 grid gap-3 text-xs leading-5 text-[#898191] sm:grid-cols-2"><p><code className="text-violet-300">listApi · deposit</code><br />Create a listing and fund a caller balance.</p><p><code className="text-violet-300">batchSettle</code><br />Apply pending call counts to FHE state.</p><p><code className="text-cyan-200">getBalance · getRevenue</code><br />Return the caller or merchant ciphertext handle.</p><p><code className="text-cyan-200">requestWithdrawal · fulfill*</code><br />Run the public-decryption withdrawal flow.</p></div></details>
        </section>

        <section id="troubleshooting" className={sectionClass}>
          <SectionHeading eyebrow="Help" title="Troubleshooting." body="Start with the HTTP status, then check the boundary that returned it." />
          <div className="overflow-hidden rounded-xl border border-white/[0.08]">{troubleshooting.map(([symptom, cause, fix]) => <div key={symptom} className="grid gap-3 border-t border-white/[0.07] bg-white/[0.012] p-5 first:border-t-0 lg:grid-cols-[190px_1fr_1fr]"><p className="font-mono text-[10px] text-[#d4ccdc]">{symptom}</p><p className="text-xs leading-5 text-[#81798c]">{cause}</p><p className="text-xs leading-5 text-[#a299ae]">{fix}</p></div>)}</div>
        </section>

        <section id="boundaries" className={`${sectionClass} mb-12`}>
          <SectionHeading eyebrow="Limits" title="Current implementation limits." body="These details affect how you test and integrate the project." />
          <div className="grid gap-3 sm:grid-cols-2">{boundaries.map((item, index) => <div key={item} className="flex gap-4 rounded-lg border border-white/[0.07] bg-white/[0.012] p-4"><span className="font-mono text-[9px] text-[#5f566a]">0{index + 1}</span><p className="text-xs leading-5 text-[#8d8597]">{item}</p></div>)}</div>
          <div className="mt-12 flex flex-col items-start justify-between gap-5 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-center"><div><p className="text-lg font-semibold">Start with a caller request.</p><p className="mt-1 text-xs text-[#756d80]">Then inspect pending usage and submit it for settlement.</p></div><div className="flex gap-3"><Link href="#caller" className="rounded-md bg-violet-300 px-4 py-2.5 font-mono text-[10px] font-bold text-[#160f1d]">Caller quickstart ↑</Link><Link href="/marketplace" className="rounded-md border border-white/[0.12] px-4 py-2.5 font-mono text-[10px] text-[#bbb2c6]">View APIs →</Link></div></div>
        </section>
      </main>
    </div>
  );
}

function Header() {
  return <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#0b0910]/88 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-[1380px] items-center px-5 sm:px-8"><Link href="/" className="flex items-center gap-2 font-mono text-sm font-bold text-violet-300"><span className="h-2 w-2 rounded-sm bg-violet-400 shadow-[0_0_14px_#a78bfa]" />402.fhe</Link><span className="mx-4 h-4 w-px bg-white/10" /><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6f687a]">Developers</span><nav className="ml-auto hidden gap-5 lg:flex">{navItems.map(([id, label]) => <Link key={id} href={`#${id}`} className="text-[11px] text-[#756e80] hover:text-white">{label}</Link>)}</nav><Link href="/docs/guide" className="ml-auto mr-2 rounded-md border border-white/[0.1] px-3 py-2 font-mono text-[10px] text-[#aaa1b5] lg:ml-6">Full docs →</Link><Link href="/marketplace" className="rounded-md border border-violet-400/25 bg-violet-400/[0.08] px-3 py-2 font-mono text-[10px] text-violet-200">Open app →</Link></div><nav className="flex gap-5 overflow-x-auto border-t border-white/[0.05] px-5 py-2.5 lg:hidden">{navItems.map(([id, label]) => <Link key={id} href={`#${id}`} className="shrink-0 font-mono text-[9px] text-[#756e80]">{label}</Link>)}</nav></header>;
}

function LaneLabel({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-3"><span className="font-mono text-[9px] uppercase tracking-[.18em] text-[#6e6579]">{label}</span><span className="h-px flex-1 bg-white/[0.07]" /><span className="font-mono text-[9px] text-violet-300">{value}</span></div>; }
function FlowBox({ label, value, tone }: { label: string; value: string; tone: "violet" | "cyan" | "neutral" }) { const classes = tone === "violet" ? "border-violet-400/20 bg-violet-400/[0.06]" : tone === "cyan" ? "border-cyan-300/15 bg-cyan-300/[0.04]" : "border-white/[0.09] bg-white/[0.025]"; return <div className={`min-w-0 rounded-lg border px-1.5 py-4 sm:px-2 ${classes}`}><span className="font-mono text-[7px] tracking-[.12em] text-[#756d80] sm:text-[8px] sm:tracking-[.16em]">{label}</span><code className="mt-2 block break-words font-mono text-[8px] leading-4 text-[#d4ccdc] sm:text-[10px]">{value}</code></div>; }
function Arrow() { return <span className="block rotate-90 font-mono text-xs text-[#554c61] sm:rotate-0">→</span>; }
function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-lg border border-white/[0.07] bg-white/[0.012] px-5 py-4"><p className="font-mono text-lg text-white">{value}</p><p className="mt-1 text-[10px] leading-4 text-[#716979]">{label}</p></div>; }
