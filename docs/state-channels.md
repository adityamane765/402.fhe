# FHE State Channels

## What makes this different from regular state channels

Traditional state channels (Lightning, Plasma, etc.) hide transactions from the base layer but the channel counterparties see everything. A Lightning node knows exactly who paid, how much, and when. The privacy boundary is the public chain — not the channel participants.

FHE state channels flip this. The counterparties — including the operator who runs the infrastructure — see nothing. Balances and revenues are encrypted on-chain at rest. Settlement updates those encrypted values without ever decrypting them. The operator processes the batch and learns nothing about what changed.

The threat model isn't "hide from the blockchain." It's "hide from the operator."

---

## How the channel works

Each party owns independent encrypted state:

- `balances[buyer]` — `euint64` ciphertext, global across all merchants
- `revenue[merchant]` — `euint64` ciphertext, global across all buyers

There are no bilateral channels. No cooperative open, no cooperative close. A buyer deposits once and can call any listed API. A merchant lists once and receives revenue from any buyer. Settlement is unilateral — either party triggers it at any time without the other's cooperation.

**Off-chain accumulation:**

Every API call produces a buyer-signed proof: `{ apiId, buyer, nonce, signature }`. The middleware stores these proofs in memory. Nothing hits the chain. Gas cost per call: zero.

**On-chain settlement:**

When either party wants to settle, the middleware submits a single `batchSettle(apiIds, buyers, counts)` transaction. One transaction settles N accumulated calls. 100 calls cost the same gas as 1.

---

## The FHE mux

`batchSettle` loops over each (apiId, buyer, count) tuple. For each call:

```solidity
euint64 price    = apis[apiId].price;           // cleartext, cast to euint64
euint64 bal      = balances[buyer];
euint64 rev      = revenue[merchant];

ebool affordable = FHE.le(price, bal);

balances[buyer]   = FHE.select(affordable, FHE.sub(bal, price),        bal);
revenue[merchant] = FHE.select(affordable, FHE.add(rev, merchantCut),  rev);
protocolFees      = FHE.add(protocolFees, FHE.select(affordable, protocolCut, ZERO));
```

`FHE.select(cond, a, b)` is a homomorphic multiplexer — it returns `a` if `cond` is true, `b` otherwise, without decrypting `cond`. All three state updates are gated on the same encrypted `affordable` boolean. If the buyer can't pay, nothing changes — and the operator processing the transaction cannot tell which branch executed.

Prices are cleartext (`uint64` set at listing time). The FHE budget is spent only on the values that matter: balances and revenues. `merchantCut = price * 9 / 10` is cleartext arithmetic computed before any FHE operation.

---

## Fraud prevention

Pure optimistic settlement has a fraud window: a buyer with zero balance could call an API, get a response, and the fraud only surfaces at settlement time. Two layers close this:

**Layer 1 — on-chain affordability check (pre-call):**

Before serving any API response, the middleware calls `canAfford(apiId, buyer)` as a gas-free `eth_call`. This returns an encrypted `ebool` — the middleware can't read the value, but the call throws if the buyer's on-chain balance is insufficient. Zero-balance buyers are rejected before the call is served.

**Layer 2 — in-memory reserve map (concurrency guard):**

`canAfford` checks the committed on-chain balance, not the in-flight balance. Without a second layer, a buyer could fire concurrent calls — all pass `canAfford`, all get served, but only one call's worth of balance exists. The middleware maintains a per-buyer in-memory reserve: the moment a call is accepted, the price is reserved. The reserve is released only after the signed proof is stored. Concurrent calls that exceed the reserved balance are rejected with 402.

Acknowledged limitation: the reserve map is per-process. Horizontal middleware scaling needs a Redis atomic increment to share reserve state across instances. This is the only non-cryptographic trust assumption in the current implementation.

**Buyer fraud proof:**

The middleware holds a signed proof for every unsettled call. If the middleware inflates call counts at settlement, the buyer can prove those calls never happened — the middleware's claimed proofs won't match the buyer's signing key. The buyer can always reconstruct which calls they signed and challenge an inflated batch.

---

## Withdrawal — no operator in the loop

Every `batchSettle` call invokes `FHE.makePubliclyDecryptable(handle)` on the updated balance and revenue handles. This registers the handle with the Zama KMS as decryptable by the owner.

To withdraw:

1. User calls `instance.publicDecrypt([handle])` in their browser — this hits the Zama KMS gateway directly, no operator involved
2. KMS returns `{ abiEncodedClearValues, decryptionProof }` — the proof is signed over the specific handle and cannot be fabricated or redirected to a different handle
3. User submits `fulfillWithdrawal(address, abiEncodedClearValues, decryptionProof)` — contract verifies via `FHE.checkSignatures`, then calls `usdc.transfer`

The operator never touches a withdrawal. There is no operator wallet in the withdrawal path. The only trust assumption is the Zama KMS — the same trust assumption that underpins the entire fhEVM.

**Critical implementation note:** `FHE.checkSignatures` expects the raw `abiEncodedClearValues` bytes returned by the SDK. Re-encoding the amount in Solidity (`abi.encode(amount)`) produces different bytes and causes `InvalidKMSSignatures`. The SDK's encoding must be passed through unmodified.

---

## Comparison to existing channel designs

| Property | Lightning / Payment Channels | Plasma | 402.fhe FHE Channels |
|---|---|---|---|
| Counterparty sees amounts | Yes | Yes | No — encrypted |
| Operator sees amounts | Yes | Yes | No — encrypted |
| Cooperative close required | Yes | Yes | No — unilateral |
| Per-call on-chain tx | No | No | No |
| Dispute window | Yes | Yes | No |
| Bilateral setup per merchant | Yes | Yes | No — global balance |
| Fraud proof | Yes (HTLC) | Yes (exit game) | Yes (signed proofs) |

The key departure: no bilateral setup. A buyer deposits once and pays any merchant. A merchant lists once and receives from any buyer. The encrypted global state replaces the per-channel state of traditional designs.

---

## Scaling path

The current implementation is single-process. To scale horizontally:

- Replace the in-memory reserve map with a Redis `INCRBY` / `DECRBY` atomic operation — the reserve check becomes a distributed atomic counter
- The on-chain settlement path is unchanged — `batchSettle` is already batch-optimized
- The signed proof store needs a shared backend (Redis, Postgres) so any middleware instance can submit the full batch at settlement time

The FHE settlement itself scales independently of the middleware — it's bounded by fhEVM throughput, not operator infrastructure.
