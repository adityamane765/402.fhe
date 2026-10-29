import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { ChallengeStore } from "./challengeStore";
import { SettlementLock } from "./settlementLock";
import { settlementBatchSize } from "./settlementBatch";
import { RouteConfig, toPublicApi } from "./catalog";

dotenv.config();

const ABI = [
  "function batchSettle(uint256[] apiIds, address[] buyers, uint256[] counts)",
  "function listings(uint256 id) view returns (address merchant, string name, string description, uint64 price, bool active)",
];

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || "");
const wallet = new ethers.Wallet(process.env.MIDDLEWARE_PRIVATE_KEY || ethers.ZeroHash, provider);
const contractAddress = process.env.CONTRACT_ADDRESS || ethers.ZeroAddress;
const contract = new ethers.Contract(contractAddress, ABI, wallet);

interface PaymentHeader {
  buyerAddress: string;
  apiId: number;
  nonce: string;
  signature: string;
}

function isPaymentHeader(value: unknown): value is PaymentHeader {
  if (!value || typeof value !== "object") return false;
  const payment = value as Record<string, unknown>;
  return (
    typeof payment.buyerAddress === "string" &&
    typeof payment.apiId === "number" &&
    Number.isSafeInteger(payment.apiId) &&
    typeof payment.nonce === "string" &&
    typeof payment.signature === "string"
  );
}

interface Proof {
  buyerAddress: string;
  merchantAddress: string;  // stored so merchant can trigger settle
  apiId: number;
  price: bigint;            // stored so we can report pending deductions
  nonce: string;
  signature: string;
  timestamp: number;
}

const proofStore = new Map<string, Proof[]>();
const challengeStore = new ChallengeStore();
const settlementLock = new SettlementLock();

function proofKey(buyer: string, apiId: number): string {
  return `${buyer.toLowerCase()}:${apiId}`;
}

function addProof(proof: Proof): void {
  const key = proofKey(proof.buyerAddress, proof.apiId);
  const existing = proofStore.get(key) || [];
  existing.push(proof);
  proofStore.set(key, existing);

  // auto-settle if this buyer-api pair hits 50 pending calls
  if (existing.length >= 50) {
    settleByKey(key).catch((err) => {
      console.error(`auto-settle failed for ${key}:`, err);
    });
  }
}

function getPendingCount(buyer: string, apiId: number): number {
  return (proofStore.get(proofKey(buyer, apiId)) || []).length;
}

// count unsettled calls for an address, matching as buyer OR merchant
// returns a map of apiId → count so the frontend can show per-api breakdowns
function getPendingForAddress(address: string): Record<number, number> {
  const addr = address.toLowerCase();
  const result: Record<number, number> = {};
  for (const [, proofs] of proofStore.entries()) {
    if (proofs.length === 0) continue;
    const { buyerAddress, merchantAddress, apiId } = proofs[0];
    if (buyerAddress.toLowerCase() === addr || merchantAddress.toLowerCase() === addr) {
      result[apiId] = (result[apiId] || 0) + proofs.length;
    }
  }
  return result;
}

// returns total pending deduction for a buyer across all apis
function getPendingDeduction(buyer: string): bigint {
  let total = 0n;
  for (const [key, proofs] of proofStore.entries()) {
    if (key.startsWith(buyer.toLowerCase() + ":")) {
      for (const p of proofs) total += p.price;
    }
  }
  return total;
}


async function settleByKey(key: string): Promise<number> {
  const proofs = proofStore.get(key) || [];
  if (proofs.length === 0) return 0;
  if (!settlementLock.tryAcquire([key])) return 0;

  try {
    const { buyerAddress, apiId } = proofs[0];
    const count = settlementBatchSize(proofs.length);

    console.log(`settling ${count} calls for buyer ${buyerAddress} on api ${apiId}`);
    const tx = await contract.batchSettle([apiId], [buyerAddress], [count]);
    await tx.wait();
    const remaining = (proofStore.get(key) || []).slice(count);
    if (remaining.length > 0) proofStore.set(key, remaining);
    else proofStore.delete(key);
    console.log(`settled: ${count} calls`);

    return count;
  } finally {
    settlementLock.release([key]);
  }
}

// settle all proofs where the caller is either the buyer or the merchant
// if no address given, settles everything
export async function settleAll(callerAddress?: string): Promise<number> {
  const keys = Array.from(proofStore.keys());
  let total = 0;

  const apiIds: number[] = [];
  const buyers: string[] = [];
  const counts: number[] = [];
  const selected: Array<{ key: string; count: number }> = [];

  for (const key of keys) {
    const proofs = proofStore.get(key) || [];
    if (proofs.length === 0) continue;

    const { buyerAddress, merchantAddress, apiId } = proofs[0];

    // if caller specified, only settle proofs they're involved in
    if (callerAddress) {
      const caller = callerAddress.toLowerCase();
      const isBuyer = buyerAddress.toLowerCase() === caller;
      const isMerchant = merchantAddress.toLowerCase() === caller;
      if (!isBuyer && !isMerchant) continue;
    }

    const count = settlementBatchSize(proofs.length);

    apiIds.push(apiId);
    buyers.push(buyerAddress);
    counts.push(count);
    selected.push({ key, count });
    total += count;
  }

  if (apiIds.length === 0) return 0;
  const selectedKeys = selected.map(({ key }) => key);
  if (!settlementLock.tryAcquire(selectedKeys)) {
    throw new Error("settlement already in progress");
  }

  try {
    console.log(`batch settling ${total} calls across ${apiIds.length} pairs`);
    const tx = await contract.batchSettle(apiIds, buyers, counts);
    await tx.wait();
    for (const { key, count } of selected) {
      const remaining = (proofStore.get(key) || []).slice(count);
      if (remaining.length > 0) proofStore.set(key, remaining);
      else proofStore.delete(key);
    }
    console.log(`settled ${total} calls in one tx`);

    return total;
  } finally {
    settlementLock.release(selectedKeys);
  }
}

function verifySignature(payment: PaymentHeader): boolean {
  try {
    const message = `${payment.apiId}:${payment.nonce}`;
    const recovered = ethers.verifyMessage(message, payment.signature);
    return recovered.toLowerCase() === payment.buyerAddress.toLowerCase();
  } catch {
    return false;
  }
}

export async function getPublicCatalog(routes: Record<string, RouteConfig>) {
  const records = await Promise.all(
    Object.entries(routes).map(async ([id, route]) => {
      const apiId = Number(id);
      const listing = await contract.listings(apiId);
      return toPublicApi(apiId, route, {
        merchant: listing.merchant,
        name: listing.name,
        description: listing.description,
        price: BigInt(listing.price),
        active: listing.active,
      });
    }),
  );
  return records.filter((record) => record.available);
}

const fhe402Middleware = (apiId: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentRaw = req.header("X-Payment");

    if (!paymentRaw) {
      const nonce = ethers.hexlify(ethers.randomBytes(16));
      challengeStore.remember(nonce, apiId);
      return res.status(402).json({
        scheme: "fhe-402",
        version: 1,
        contract: contractAddress,
        network: "sepolia",
        apiId,
        nonce,
      });
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(paymentRaw, "base64").toString());
    } catch {
      return res.status(400).json({ error: "malformed payment header" });
    }

    if (!isPaymentHeader(decoded)) {
      return res.status(400).json({ error: "malformed payment header" });
    }
    const payment = decoded;

    if (payment.apiId !== apiId) {
      return res.status(401).json({ error: "payment challenge does not match route" });
    }

    if (!verifySignature(payment)) {
      return res.status(401).json({ error: "invalid signature" });
    }

    if (!challengeStore.consume(payment.nonce, apiId)) {
      return res.status(401).json({ error: "payment challenge expired or already used" });
    }

    try {
      const listing = await contract.listings(apiId);
      if (!listing.active) {
        return res.status(410).json({ error: "API listing is inactive" });
      }
      const price = BigInt(listing.price);
      const merchantAddress: string = listing.merchant;

      addProof({
        buyerAddress: payment.buyerAddress,
        merchantAddress,
        apiId,
        price,
        nonce: payment.nonce,
        signature: payment.signature,
        timestamp: Date.now(),
      });

      next();
    } catch (err) {
      console.error("middleware error:", err);
      return res.status(502).json({ error: "payment authorization unavailable" });
    }
  };
};

export { fhe402Middleware, getPendingCount, getPendingDeduction, getPendingForAddress, settleByKey };
