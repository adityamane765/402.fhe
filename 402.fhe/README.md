# 402.fhe

A confidential API marketplace built on [Zama fhEVM](https://www.zama.ai). Merchants list APIs with public prices. Buyers pay per call using the x402 HTTP payment protocol. The operator is cryptographically blind to buyer balances, merchant revenues, and usage patterns — not a policy claim, a math claim.

**Live**

- Frontend: https://402-fhe.vercel.app
- Middleware: https://four02-fhe.onrender.com
- Contract: `0x674182eaA4d180619d99f914E33028e1D6483785` on Ethereum Sepolia

---

## The problem

HTTP-native micropayments (x402) are gaining traction for AI agent economies. But every existing payment system requires a trusted intermediary who can see everything: who paid, how much, for what. For autonomous AI agents transacting at scale, this is sensitive business intelligence leaking by design.

FHE removes the need for that trusted party — cryptographically, not just by policy. The operator runs the infrastructure but learns nothing about who is paying whom or for what. Operator blindness is enforced at the math layer, not the policy layer.

---

## How it works

```
buyer deposits USDC
  → balance wrapped as euint64 on-chain (ciphertext, ~128 bytes)

buyer calls API via HTTP (GET /your/api)
  → middleware issues 402 challenge with apiId + nonce
  → buyer signs nonce, retries with X-Payment header
  → middleware: verifies signature
               calls canAfford(apiId, buyer) as eth_call — ~50ms, no gas
               checks local in-memory reserve (race condition guard)
               reserves price locally
  → API response returned immediately
  → [background] settleCall(apiId, buyer) on-chain — FHE mux updates balances

merchant accumulates revenue
  → stored as euint64 on-chain, encrypted per-merchant
  → merchant decrypts in browser using Zama KMS
  → merchant withdraws — no operator involvement
```

---

## Architectural decisions

### Cleartext prices, encrypted everything else

API prices are public — merchants set them at listing time, buyers see them before depositing. What's private is who called which API, how often, and what anyone earned. This was a deliberate scope decision: overclaiming privacy on prices adds nothing and makes the system harder to reason about. The FHE budget is spent where it matters.

### FHE mux settlement

`settleCall` never decrypts anything. It computes:

```solidity
ebool affordable = FHE.le(price, balances[buyer]);
balances[buyer]   = FHE.select(affordable, FHE.sub(bal, price), bal);
revenue[merchant] = FHE.select(affordable, FHE.add(rev, merchantCut), rev);
protocolFees      = FHE.add(protocolFees, FHE.select(affordable, protocolCut, 0));
```

All three state updates are gated on the same encrypted `affordable` bool. If the buyer can't pay, nothing changes — but the operator can't tell. The FHE VM operates directly on ciphertexts throughout.

### 90/10 revenue split in cleartext

The fee split (`merchantCut = price * 9 / 10`) is computed in cleartext arithmetic on the public price, before any FHE operation. This means the operator collects a predictable fee on every call without ever needing to decrypt anything. Business model designed around the privacy constraint, not despite it.

### Self-serve withdrawals — no operator required

The original design had an operator-run relay for withdrawals. The final implementation eliminated this entirely using `publicDecrypt`:

1. Contract calls `FHE.makePubliclyDecryptable(handle)` on every balance/revenue update
2. When withdrawing, user calls `instance.publicDecrypt([handle])` from their browser — this hits the Zama KMS gateway and returns `{ abiEncodedClearValues, decryptionProof }`
3. User submits `fulfillWithdrawal(merchant, abiEncodedClearValues, decryptionProof)` on-chain
4. Contract verifies via `FHE.checkSignatures(handles, abiEncodedCleartexts, proof)` then transfers

The proof is KMS-signed and tied to the specific on-chain handle — it cannot be fabricated, inflated, or redirected to a different address. A third party obtaining the proof gains nothing: `usdc.transfer` always pays `merchant`, and only `msg.sender == merchant` can call `fulfillWithdrawal`. No operator wallet, no relay, no trust assumption beyond the Zama KMS (same trust assumption as the FHE operations themselves).

One critical implementation detail: `FHE.checkSignatures` expects the raw `abiEncodedClearValues` bytes from the SDK — not `abi.encode(amount)`. The KMS signs over the SDK's encoding; re-encoding in Solidity produces different bytes and causes `InvalidKMSSignatures`.

### Two-layer fraud prevention

Pure optimistic settlement creates a fraud window — a buyer with zero balance could get free calls until the settlement batch runs. Two layers close this:

- **Layer 1 (on-chain):** `canAfford(apiId, buyer)` as a gas-free `eth_call`. Contract computes `FHE.le(price, balance)` and returns an ebool. No transaction, no gas, ~50ms. Source of truth for balance correctness.
- **Layer 2 (in-memory):** middleware maintains `Map<buyerAddress, reservedAmount>`. Two simultaneous requests from the same buyer can both pass Layer 1 before either settles — the reserve map blocks the second. Reserve is released after on-chain settlement confirms.

Layer 1 handles the zero-balance case. Layer 2 handles the race condition. Acknowledged limitation: the in-memory reserve is per-process. Horizontal scaling needs Redis (atomic increment). For MVP with a single middleware instance, this is not an issue.

### `fhe-402` as a new x402 scheme

The x402 protocol is scheme-extensible. This project introduces `fhe-402` alongside the existing `exact` and `upfront` schemes. Any x402-compatible endpoint can opt into FHE privacy without changing its API surface — just register your endpoint through the middleware and list it on the contract.

---

## Privacy guarantees (honest)

| What | Status |
|---|---|
| Buyer balance | Encrypted — only buyer can decrypt via KMS |
| Merchant revenue | Encrypted — only merchant can decrypt via KMS |
| Which buyer called which API | Hidden — settlement events show apiId but not balance linkage |
| Call frequency per buyer | Hidden — aggregate event count visible, per-buyer breakdown not |
| API prices | **Public** — set by merchant, visible to all |
| Operator visibility into balances/revenue | Zero — cryptographically enforced |

---

## Monorepo

```
contracts/    Solidity + Hardhat + fhEVM — FHE402Marketplace.sol
middleware/   Node.js/Express x402 fhe-402 scheme handler + route proxy
agent/        Python AI agent client demo
app/          Next.js frontend (marketplace, buyer, merchant, operator views)
```

---

## Running locally

```bash
# contracts
cd contracts && npm install
npx hardhat test          # 8 tests, all passing

# middleware
cd middleware && npm install
cp .env.example .env      # PRIVATE_KEY, CONTRACT_ADDRESS, SEPOLIA_RPC_URL
npm run dev               # port 3001

# frontend
cd app && npm install
cp .env.example .env.local   # NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_MIDDLEWARE_URL
npm run dev               # port 3000
```

**Deploying the contract**

```bash
cd contracts
# hardhat.config.ts must include chainId: 11155111 in sepolia network config
# use a public RPC — Alchemy returns non-standard errors for anvil probes
npx hardhat run scripts/deploy.ts --network sepolia
```

After deploy: update `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel dashboard and `CONTRACT_ADDRESS` in Render env vars, then redeploy both.

---

## Tech

| Component | What |
|---|---|
| FHE | [Zama fhEVM](https://docs.zama.ai/fhevm) `@fhevm/solidity@0.11.1` |
| KMS / browser decrypt | `@zama-fhe/relayer-sdk` v0.4.1 |
| Payment protocol | [x402](https://x402.org) — `fhe-402` scheme |
| Wallet / contract | wagmi + viem |
| Frontend | Next.js + Tailwind CSS |
| Agent client | Python — `eth-account` + `requests` |

---

## Roadmap

### Phase 2 — economics
- Listing fees for merchants (flat monthly, fully public transaction)
- Float yield on deposited USDC between deposit and withdrawal — protocol earns on idle capital

### Phase 3 — FHE state channels
Open an encrypted payment channel once, exchange signed proofs off-chain per request, batch settle to L1. Eliminates per-call settlement gas while preserving the FHE privacy guarantees. Enables high-frequency micropayments (thousands of calls/minute) without on-chain overhead.

### Phase 4 — protocol
Formalize `fhe-channel` as an x402 scheme extension proposal (EIP or x402 spec PR). Privacy-preserving HTTP payments as a drop-in scheme for the entire x402 ecosystem — not just this marketplace.

### Phase 5 — horizontal scale
Replace in-memory reserve map with Redis atomic increment for multi-instance middleware deployments. Required for production load — not MVP scope.

---

## Core thesis

The novel value is not hiding data from observers. It's eliminating the need for a trusted intermediary who sees everything. FHE makes the marketplace operator cryptographically blind — not by policy, but by math.