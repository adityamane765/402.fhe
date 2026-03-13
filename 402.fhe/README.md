# 402.fhe

A confidential API marketplace built on [Zama fhEVM](https://www.zama.ai). Merchants list APIs with public prices. Buyers pay per call using the x402 HTTP payment protocol. The operator is cryptographically blind to buyer balances, merchant revenues, and usage patterns — not a policy claim, a math claim.

## Live

- **Frontend:** https://402-fhe.vercel.app
- **Middleware:** https://four02-fhe.onrender.com
- **Contract:** `0x674182eaA4d180619d99f914E33028e1D6483785` on Ethereum Sepolia

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

## Withdrawal design

Withdrawals are fully self-serve — no operator or relayer required.

### Why settlements need no operator

When a buyer calls an API, the middleware calls `settleCall(apiId, buyer)` on the contract. Inside that function, the contract computes:

```solidity
ebool affordable = FHE.le(price, balances[buyer]);
balances[buyer] = FHE.select(affordable, FHE.sub(balances[buyer], price), balances[buyer]);
revenue[merchant] = FHE.select(affordable, FHE.add(revenue[merchant], merchantCut), revenue[merchant]);
```

This is pure FHE arithmetic. The contract never decrypts anything — it operates directly on ciphertexts. No operator sees any plaintext.

### Why withdrawals can be self-serve

When a merchant or buyer withdraws, the contract needs a plaintext amount for the ERC-20 transfer. The amount comes from `publicDecrypt` — a call to the Zama KMS gateway that returns a KMS-signed decryption proof. This is a public API call that anyone can make from the browser.

The contract marks ciphertext handles as `makePubliclyDecryptable` during settlement so the KMS can decrypt them. The contract then verifies the proof on-chain via `FHE.checkSignatures` before transferring.

```solidity
function fulfillWithdrawal(address merchant, uint256 amount, bytes calldata decryptionProof) external {
    require(msg.sender == merchant, "only merchant");
    FHE.checkSignatures(handles, abi.encode(amount), decryptionProof);
    usdc.transfer(merchant, amount);
}
```

The merchant calls `publicDecrypt` in their browser, gets `(clearAmount, decryptionProof)` back from the KMS, and submits `fulfillWithdrawal` themselves. No operator involved.

### Why this is safe

- The proof is signed by the Zama KMS — the amount cannot be fabricated
- `FHE.checkSignatures` verifies the proof matches the current on-chain handle — stale proofs revert
- `usdc.transfer` always pays the merchant address from the contract — a third party obtaining the proof gains nothing
- Only the merchant can call `fulfillWithdrawal` for their own account (`msg.sender == merchant`)

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
