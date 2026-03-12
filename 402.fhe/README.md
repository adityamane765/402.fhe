# 402.fhe

A confidential API marketplace built on [Zama fhEVM](https://www.zama.ai). Merchants list APIs with public prices. Buyers pay per call using the x402 HTTP payment protocol. The operator is cryptographically blind to buyer balances, merchant revenues, and usage patterns — not a policy claim, a math claim.

## Live

- **Frontend:** https://402-fhe.vercel.app
- **Middleware:** https://four02-fhe.onrender.com
- **Contract:** `0x4Ff4a147f6e052398B8C0962c6cd4Fa4f34d2826` on Ethereum Sepolia

## How it works

```
buyer deposits USDC
  → balance encrypted as euint64 on-chain

buyer calls API via HTTP
  → middleware intercepts, calls canAfford(apiId, buyer) on-chain
  → if affordable: settles payment via FHE mux (no plaintext ever leaves the VM)
  → API response returned to buyer

merchant receives revenue
  → stored as euint64 on-chain, only merchant can decrypt it
```

The middleware settles payments on every API call automatically — no operator action needed for the core flow.

## Monorepo

```
contracts/    Solidity + Hardhat + fhEVM
middleware/   Node.js/Express x402 fhe-402 scheme handler
agent/        Python AI agent client demo
app/          Next.js frontend
```

## Withdrawal design and the operator requirement

Withdrawals work differently from settlements and require operator involvement. Here is why.

### Why settlements need no operator

When a buyer calls an API, the middleware calls `settleCall(apiId, buyer)` on the contract. Inside that function, the contract computes:

```solidity
ebool affordable = FHE.le(price, balances[buyer]);
balances[buyer] = FHE.select(affordable, FHE.sub(balances[buyer], price), balances[buyer]);
revenue[merchant] = FHE.select(affordable, FHE.add(revenue[merchant], merchantCut), revenue[merchant]);
```

This is pure FHE arithmetic. The contract never decrypts anything — it operates directly on ciphertexts. No operator sees any plaintext. This is the core of 402.fhe and it works fully automatically.

### Why withdrawals require operator assistance

When a buyer or merchant wants to withdraw USDC out of the contract, the contract needs to know the plaintext amount to call `usdc.transfer(user, amount)`. There is no way to call ERC-20 transfer with an encrypted amount — ERC-20 is a standard contract that expects a uint256.

To get the plaintext amount, the contract uses `FHE.checkSignatures()`:

```solidity
function fulfillWithdrawal(address merchant, uint256 amount, bytes calldata decryptionProof) external {
    require(msg.sender == owner, "not owner");
    FHE.checkSignatures(handles, abi.encode(amount), decryptionProof);
    usdc.transfer(merchant, amount);
}
```

`FHE.checkSignatures` verifies that the Zama KMS signed a proof attesting that the ciphertext handle decrypts to `amount`. This proof can only be produced by the Zama KMS gateway — it has root decryption authority. The proof is then verified on-chain before any transfer happens.

The operator is the only party who can request this proof from the KMS gateway and submit the `fulfillWithdrawal` transaction. The buyer or merchant cannot do this themselves with the current SDK — `userDecrypt` (which buyers/merchants use to view their own balance) decrypts client-side and returns a plaintext bigint, not a KMS-signed proof that the contract can verify.

### Why not just trust the user's claimed amount?

If `fulfillWithdrawal` accepted a user-supplied amount without a KMS proof, a malicious user could claim any amount and drain the contract. The proof is what makes it trustless.

### Why `FHE.requestDecryption()` would solve this

`FHE.requestDecryption()` triggers an asynchronous on-chain decryption callback — the contract itself requests decryption and receives the plaintext via a callback, with no external operator needed. This is the clean solution. However, `FHE.requestDecryption()` is not available in fhEVM v0.11.1 on Sepolia testnet. It is expected in a future version.

### Current state

Withdrawals require the operator to run a KMS relay script that:
1. Watches for `WithdrawalRequested` events
2. Calls the Zama KMS gateway to get a signed decryption proof for the handle
3. Submits `fulfillWithdrawal(user, amount, proof)` with the owner wallet

The core value proposition — confidential per-call settlements with no operator visibility — works fully without this. Withdrawal is an off-ramp concern, not a payment concern.

## Running locally

```bash
# contracts
cd contracts && npm install
npx hardhat test

# middleware
cd middleware && npm install
cp .env.example .env  # add PRIVATE_KEY, CONTRACT_ADDRESS, USDC_ADDRESS
npm run dev

# frontend
cd app && npm install
cp .env.example .env.local  # add NEXT_PUBLIC_CONTRACT_ADDRESS, NEXT_PUBLIC_MIDDLEWARE_URL
npm run dev
```

## Tech

- [Zama fhEVM](https://docs.zama.ai/fhevm) v0.11.1 — FHE operations on Solidity
- [@zama-fhe/relayer-sdk](https://www.npmjs.com/package/@zama-fhe/relayer-sdk) v0.4.1 — user-decrypt in browser
- [x402](https://x402.org) — HTTP 402 payment protocol
- wagmi + viem — wallet and contract interaction
- Next.js 16 + Tailwind CSS v4
