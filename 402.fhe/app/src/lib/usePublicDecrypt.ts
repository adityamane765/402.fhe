"use client";
import { useState, useCallback } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI } from "./contract";

async function getFhevmInstance(ethereum: unknown) {
  const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
  await initSDK();
  return createInstance({
    ...SepoliaConfig,
    network: ethereum as Parameters<typeof createInstance>[0]["network"],
  });
}

export type WithdrawStatus = "idle" | "requesting" | "decrypting" | "submitting" | "done" | "error";

export function usePublicDecryptWithdraw() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<WithdrawStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const withdrawRevenue = useCallback(async (merchantAddress: string) => {
    if (!publicClient) return;
    setStatus("requesting");
    setError(null);

    try {
      // skip requestWithdrawal if already pending
      const alreadyPending = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "withdrawalPending",
        args: [merchantAddress as `0x${string}`],
      }) as boolean;

      if (!alreadyPending) {
        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "requestWithdrawal",
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      setStatus("decrypting");

      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getRevenue",
        args: [merchantAddress as `0x${string}`],
        account: merchantAddress as `0x${string}`,
      }) as bigint;

      if (!handle || handle === 0n) {
        setError("No revenue to withdraw");
        setStatus("error");
        return;
      }

      const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
      const instance = await getFhevmInstance(ethereum);

      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;
      const results = await instance.publicDecrypt([handleHex]);

      // pass abiEncodedClearValues directly — this is exactly what the KMS signed
      const abiEncodedCleartexts = results.abiEncodedClearValues;
      const proof = results.decryptionProof;

      setStatus("submitting");
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "fulfillWithdrawal",
        args: [merchantAddress as `0x${string}`, abiEncodedCleartexts, proof],
      });

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "withdrawal failed");
      setStatus("error");
    }
  }, [publicClient, writeContractAsync]);

  const withdrawBalance = useCallback(async (buyerAddress: string) => {
    if (!publicClient) return;
    setStatus("requesting");
    setError(null);

    try {
      const alreadyPending = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "withdrawalPending",
        args: [buyerAddress as `0x${string}`],
      }) as boolean;

      if (!alreadyPending) {
        const txHash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "requestWithdrawal",
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      setStatus("decrypting");

      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getBalance",
        args: [buyerAddress as `0x${string}`],
        account: buyerAddress as `0x${string}`,
      }) as bigint;

      if (!handle || handle === 0n) {
        setError("No balance to withdraw");
        setStatus("error");
        return;
      }

      const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
      const instance = await getFhevmInstance(ethereum);

      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;
      const results = await instance.publicDecrypt([handleHex]);

      const abiEncodedCleartexts = results.abiEncodedClearValues;
      const proof = results.decryptionProof;

      setStatus("submitting");
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "fulfillBuyerWithdrawal",
        args: [buyerAddress as `0x${string}`, abiEncodedCleartexts, proof],
      });

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "withdrawal failed");
      setStatus("error");
    }
  }, [publicClient, writeContractAsync]);

  return { withdrawRevenue, withdrawBalance, status, error };
}
