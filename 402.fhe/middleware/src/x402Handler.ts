import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const ABI = [
  "function canAfford(uint256 apiId, address buyer) returns (bool)",
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
const reserved = new Map<string, bigint>();

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

function clearProofs(buyer: string, apiId: number): number {
  const key = proofKey(buyer, apiId);
  const count = (proofStore.get(key) || []).length;
  proofStore.delete(key);
  return count;
}

async function settleByKey(key: string): Promise<number> {
  const proofs = proofStore.get(key) || [];
  if (proofs.length === 0) return 0;

  const { buyerAddress, apiId } = proofs[0];
  const count = proofs.length;
  proofStore.delete(key);

  console.log(`settling ${count} calls for buyer ${buyerAddress} on api ${apiId}`);
  const tx = await contract.batchSettle([apiId], [buyerAddress], [count]);
  await tx.wait();
  console.log(`settled: ${count} calls`);

  releaseReserve(buyerAddress);
  return count;
}

// settle all proofs where the caller is either the buyer or the merchant
// if no address given, settles everything
export async function settleAll(callerAddress?: string): Promise<number> {
  const keys = Array.from(proofStore.keys());
  let total = 0;

  const apiIds: number[] = [];
  const buyers: string[] = [];
  const counts: number[] = [];
  const buyersToRelease = new Set<string>();

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

    const count = proofs.length;
    proofStore.delete(key);

    apiIds.push(apiId);
    buyers.push(buyerAddress);
    counts.push(count);
    buyersToRelease.add(buyerAddress.toLowerCase());
    total += count;
  }

  if (apiIds.length === 0) return 0;

  console.log(`batch settling ${total} calls across ${apiIds.length} pairs`);
  const tx = await contract.batchSettle(apiIds, buyers, counts);
  await tx.wait();
  console.log(`settled ${total} calls in one tx`);

  // release reserves for all buyers whose calls were settled
  for (const buyer of buyersToRelease) {
    releaseReserve(buyer);
  }

  return total;
}

function getReserved(buyer: string): bigint {
  return reserved.get(buyer.toLowerCase()) || 0n;
}

function addReserve(buyer: string, amount: bigint): void {
  const current = getReserved(buyer);
  reserved.set(buyer.toLowerCase(), current + amount);
}

function releaseReserve(buyer: string): void {
  reserved.delete(buyer.toLowerCase());
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

const fhe402Middleware = (apiId: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentRaw = req.header("X-Payment");

    if (!paymentRaw) {
      return res.status(402).json({
        scheme: "fhe-402",
        version: 1,
        contract: contractAddress,
        network: "sepolia",
        apiId,
        nonce: ethers.hexlify(ethers.randomBytes(16))
      });
    }

    try {
      const payment: PaymentHeader = JSON.parse(Buffer.from(paymentRaw, "base64").toString());

      if (!verifySignature(payment)) {
        return res.status(401).json({ error: "invalid signature" });
      }

      const listing = await contract.listings(apiId);
      const price = BigInt(listing.price);
      const merchantAddress: string = listing.merchant;

      // layer 1: onchain FHE balance check — eth_call, no gas
      const affordable = await contract.canAfford(apiId, payment.buyerAddress);
      if (!affordable) {
        return res.status(402).json({ error: "insufficient balance" });
      }

      // layer 2: reserve check — guards against concurrent calls before settlement
      if (getReserved(payment.buyerAddress) > 0n) {
        return res.status(402).json({ error: "balance reserved" });
      }

      addReserve(payment.buyerAddress, price);

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
      return res.status(400).json({ error: "malformed payment header" });
    }
  };
};

export { fhe402Middleware, getPendingCount, getPendingDeduction, settleByKey };
