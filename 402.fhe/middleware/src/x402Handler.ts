import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const ABI = [
  "function canAfford(uint256 apiId, address buyer) returns (bool)",
  "function settleCall(uint256 apiId, address buyer)",
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

const reserved = new Map<string, bigint>();

function getReserved(buyer: string): bigint {
  return reserved.get(buyer.toLowerCase()) || 0n;
}

function addReserve(buyer: string, amount: bigint): void {
  const current = getReserved(buyer);
  reserved.set(buyer.toLowerCase(), current + amount);
}

function releaseReserve(buyer: string, amount: bigint): void {
  const current = getReserved(buyer);
  const next = current - amount;
  if (next <= 0n) {
    reserved.delete(buyer.toLowerCase());
  } else {
    reserved.set(buyer.toLowerCase(), next);
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

interface QueueItem {
  apiId: number;
  buyer: string;
  price: bigint;
}

const settlementQueue: QueueItem[] = [];

function queueSettlement(apiId: number, buyer: string, price: bigint): void {
  settlementQueue.push({ apiId, buyer, price });
}

setInterval(async () => {
  if (settlementQueue.length === 0) return;

  const batch = settlementQueue.splice(0);
  console.log(`processing batch of ${batch.length} settlements`);

  for (const item of batch) {
    try {
      const tx = await contract.settleCall(item.apiId, item.buyer);
      await tx.wait();
      console.log(`settled call for ${item.buyer} on api ${item.apiId}`);
      releaseReserve(item.buyer, item.price);
    } catch (err) {
      console.error("settleCall failed:", err);
      releaseReserve(item.buyer, item.price);
    }
  }
}, 10_000);

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

      // layer 1: onchain FHE balance check ->eth_call from middleware wallet, no gas
      const affordable = await contract.canAfford(apiId, payment.buyerAddress);
      if (!affordable) {
        return res.status(402).json({ error: "insufficient balance" });
      }

      // layer 2: reserve check (for mvp simplification: max 1 inflight call)
      // we check if they already have a pending reservation for this buyer
      if (getReserved(payment.buyerAddress) > 0n) {
        return res.status(402).json({ error: "balance reserved" });
      }

      addReserve(payment.buyerAddress, price);
      queueSettlement(apiId, payment.buyerAddress, price);

      next();
    } catch (err) {
      console.error("middleware error:", err);
      return res.status(400).json({ error: "malformed payment header" });
    }
  };
};

export { fhe402Middleware };
