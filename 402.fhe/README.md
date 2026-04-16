# 402.fhe

A confidential API marketplace built on [Zama fhEVM](https://www.zama.ai). Merchants list APIs with public prices. Buyers pay per call using the x402 HTTP payment protocol. The operator is cryptographically blind to buyer balances, merchant revenues, and usage patterns — not a policy claim, a math claim.

**Live**

- Frontend: https://402-fhe.vercel.app
- Middleware: https://402fhe-production-3482.up.railway.app
- Contract: `0x34e412625DF16F8397B31CD122C8320f85b5c0A5` on Ethereum Sepolia

---

## The problem

HTTP-native micropayments (x402) are gaining traction for AI agent economies. But every existing payment system requires a trusted intermediary who can see everything: who paid, how much, for what. For autonomous AI agents transacting at scale, this is sensitive business intelligence leaking by design.

FHE removes the need for that trusted party — cryptographically, not just by policy. The operator runs the infrastructure but learns nothing about who is paying whom or for what. Operator blindness is enforced at the math layer, not the policy layer.

---

## How it works

```
buyer deposits USDC
  → balance wrapped as euint64 on-chain (ciphertext)

buyer calls API via HTTP
  → middleware issues 402 challenge with apiId + nonce
  → buyer signs nonce, retries with X-Payment header
  → middleware: verifies signature
               calls canAfford(apiId, buyer) as eth_call — no gas, ~50ms
               checks in-memory reserve (concurrent call guard)
               stores signed proof off-chain — no on-chain tx per call
  → API response returned immediately

buyer or merchant triggers settlement (anytime)
  → middleware calls batchSettle(apiIds, buyers, counts) — one tx for N calls
  → FHE mux settles all accumulated calls in a single transaction
  → buyer balance decremented, merchant revenue incremented — both stay encrypted
```

This is the state channel model: calls accumulate as signed proofs off-chain, settlement hits the chain only when either party wants it. N calls cost the same gas as a single `batchSettle` transaction.

---

## Architectural decisions

### Cleartext prices, encrypted everything else

API prices are public — merchants set them at listing time, buyers see them before depositing. What stays private is who called which API, how often, and what anyone earned. Overclaiming privacy on prices adds nothing and makes the system harder to reason about. The FHE budget is spent where it matters.

### Independent channels per party

Rather than bilateral buyer-merchant payment channels (which need cooperative close and dispute mechanisms), each party owns their own encrypted state:

- `balances[buyer]` — buyer's global encrypted balance, works across all merchants
- `revenue[merchant]` — merchant's global encrypted revenue, accumulates from all buyers

Either party settles independently at any time. No cooperative close, no dispute window, no counterparty dependency. The middleware holds a buyer-signed proof for every unsettled call — if the middleware misbehaves and inflates counts, the buyer can prove those calls never happened.

### FHE mux settlement

`batchSettle` never decrypts anything. For each call in the batch:

```solidity
ebool affordable = FHE.le(price, balances[buyer]);
balances[buyer]   = FHE.select(affordable, FHE.sub(bal, price), bal);
revenue[merchant] = FHE.select(affordable, FHE.add(rev, merchantCut), rev);
protocolFees      = FHE.add(protocolFees, FHE.select(affordable, protocolCut, 0));
```

All three state updates are gated on the same encrypted `affordable` bool. If the buyer can't pay, nothing changes — and the operator can't tell either way. The FHE VM operates on ciphertexts throughout.

### 90/10 revenue split in cleartext

The fee split (`merchantCut = price * 9 / 10`) is computed in cleartext arithmetic on the public price, before any FHE operation. The operator collects a predictable protocol fee on every call without ever needing to decrypt anything. The business model is designed around the privacy constraint, not despite it.

### Self-serve withdrawals — no operator required

Every balance and revenue update calls `FHE.makePubliclyDecryptable(handle)` on-chain. When a user wants to withdraw:

1. User calls `instance.publicDecrypt([handle])` from their browser — hits the Zama KMS gateway, returns `{ abiEncodedClearValues, decryptionProof }`
2. User submits `fulfillWithdrawal(address, abiEncodedClearValues, decryptionProof)` on-chain
3. Contract verifies via `FHE.checkSignatures(handles, cleartexts, proof)` then calls `usdc.transfer`

The proof is KMS-signed and tied to the specific on-chain handle — it cannot be fabricated, inflated, or redirected. A third party obtaining the proof gains nothing: `usdc.transfer` always pays the registered address, and only `msg.sender == merchant` (or `== buyer`) can call the fulfill function. No operator wallet, no relay, no trust assumption beyond the Zama KMS — the same assumption already present in the FHE operations themselves.

One critical detail: `FHE.checkSignatures` expects the raw `abiEncodedClearValues` bytes from the SDK, not `abi.encode(amount)`. The KMS signs over the SDK's encoding — re-encoding in Solidity produces different bytes and causes `InvalidKMSSignatures`.

### Two-layer fraud prevention

Pure optimistic settlement creates a fraud window: a buyer with zero balance could get free calls until the batch runs. Two layers close this:

- **Layer 1 (on-chain):** `canAfford(apiId, buyer)` as a gas-free `eth_call`. The contract computes `FHE.le(price, balance)` on ciphertexts and returns an encrypted bool. No transaction, no gas, ~50ms. Source of truth.
- **Layer 2 (in-memory):** middleware maintains a per-buyer reserve. Two simultaneous requests from the same buyer can both pass Layer 1 before either proof is stored — the reserve blocks the second for the duration of that narrow window, then releases immediately once the proof is stored.

Layer 1 catches the zero-balance case. Layer 2 guards the ~50ms concurrency window. Acknowledged limitation: the in-memory reserve is per-process. Horizontal scaling needs Redis atomic increment. Not MVP scope.

### `fhe-402` as a new x402 scheme

The x402 protocol is scheme-extensible. This project introduces `fhe-402` alongside the existing `exact` and `upfront` schemes. Any x402-compatible endpoint can opt into FHE-enforced privacy without changing its API surface — merchants register their backend URL through the middleware and list the API on the contract.

---

## Privacy guarantees

| What | Status |
|---|---|
| Buyer balance | Encrypted — only the buyer can decrypt via KMS |
| Merchant revenue | Encrypted — only the merchant can decrypt via KMS |
| Which buyer called which API | Hidden — settlement events emit `apiId` but no balance linkage |
| Call frequency per buyer | Hidden — aggregate event count visible, per-buyer breakdown is not |
| API prices | **Public** — set by merchant at listing time, visible to all |
| Operator visibility into balances / revenue | Zero — cryptographically enforced |

---

## Monorepo

```
contracts/    Solidity + Hardhat + fhEVM — FHE402Marketplace.sol
middleware/   Node.js / Express — fhe-402 payment handler + off-chain proof store
agent/        Python AI agent client demo
app/          Next.js frontend — marketplace, buyer, and merchant views
```

---

## Running locally

```bash
# contracts
cd contracts && npm install
npx hardhat test          # all tests passing

# middleware
cd middleware && npm install
cp .env.example .env      # MIDDLEWARE_PRIVATE_KEY, CONTRACT_ADDRESS, SEPOLIA_RPC_URL
npm run dev               # port 3001

# frontend
cd app && npm install
cp .env.example .env.local   # NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_MIDDLEWARE_URL
npm run dev               # port 3000

# agent
cd agent && pip install -r requirements.txt
cp .env.example .env      # AGENT_PRIVATE_KEY, CONTRACT_ADDRESS, MIDDLEWARE_URL, SEPOLIA_RPC_URL
python agent.py
```

**Deploying the contract**

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network sepolia
```

`hardhat.config.ts` must include `chainId: 11155111` in the sepolia network config — the fhEVM plugin uses this to skip Anvil probing and go straight to real-network mode. Use a public RPC (e.g. `https://ethereum-sepolia-rpc.publicnode.com`) — Alchemy returns non-standard error codes for `anvil_nodeInfo` which crash the plugin before `chainId` is checked.

After deploy: update `NEXT_PUBLIC_CONTRACT_ADDRESS` in Vercel and `CONTRACT_ADDRESS` in Railway, then redeploy both.

---

## Tech stack

| Component | What |
|---|---|
| FHE | [Zama fhEVM](https://docs.zama.ai/fhevm) — `@fhevm/solidity@0.11.1` |
| KMS / browser decrypt | `@zama-fhe/relayer-sdk` v0.4.1 |
| Payment protocol | [x402](https://x402.org) — `fhe-402` scheme |
| Wallet / contract interactions | wagmi + viem |
| Frontend | Next.js + Tailwind CSS |
| Agent client | Python — `eth-account` + `requests` |

---

## Roadmap

### Phase 2 — FHE state channels ✅
Independent encrypted channels per party. Calls accumulate as signed proofs off-chain, `batchSettle` commits N calls in one transaction. Either party settles unilaterally — no cooperative close, no dispute window.

### Phase 3 — protocol formalization
Formalize `fhe-402` as an x402 scheme extension (EIP or x402 spec PR). Privacy-preserving HTTP payments as a drop-in scheme for the broader x402 ecosystem — not just this marketplace.

### Phase 4 — horizontal scale
Replace the in-memory reserve map with Redis atomic increment for multi-instance middleware deployments. Required for production load; out of scope for the current single-instance setup.

---

## Core thesis

The novel value is not hiding data from observers. It's eliminating the need for a trusted intermediary who sees everything. FHE makes the marketplace operator cryptographically blind — not by policy, but by math.
