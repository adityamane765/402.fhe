"use client";
import { useState, useCallback } from "react";
import { useSignTypedData, usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, MARKETPLACE_ABI } from "./contract";

async function getFhevmInstance(ethereum: unknown) {
  // dynamic import so WASM is never loaded at build time
  const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
  await initSDK();
  return createInstance({
    ...SepoliaConfig,
    network: ethereum as Parameters<typeof createInstance>[0]["network"],
  });
}

export function useUserDecrypt() {
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decryptBalance = useCallback(async (userAddress: string): Promise<bigint | null> => {
    if (!publicClient) return null;
    setLoading(true);
    setError(null);

    try {
      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getBalance",
        args: [userAddress as `0x${string}`],
        account: userAddress as `0x${string}`,
      }) as bigint;

      if (!handle || handle === 0n) return 0n;

      const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
      const instance = await getFhevmInstance(ethereum);
      const { privateKey, publicKey } = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;

      const eip712 = instance.createEIP712(publicKey, [CONTRACT_ADDRESS], startTimestamp, durationDays);

      const signature = await signTypedDataAsync({
        domain: eip712.domain as Parameters<typeof signTypedDataAsync>[0]["domain"],
        types: eip712.types as Parameters<typeof signTypedDataAsync>[0]["types"],
        primaryType: eip712.primaryType,
        message: eip712.message as Record<string, unknown>,
      });

      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;
      const results = await instance.userDecrypt(
        [{ handle: handleHex, contractAddress: CONTRACT_ADDRESS }],
        privateKey,
        publicKey,
        signature,
        [CONTRACT_ADDRESS],
        userAddress,
        startTimestamp,
        durationDays,
      );

      const clearValue = Object.values(results)[0];
      return typeof clearValue === "bigint" ? clearValue : BigInt(String(clearValue));
    } catch (err) {
      setError(err instanceof Error ? err.message : "decryption failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicClient, signTypedDataAsync]);

  const decryptRevenue = useCallback(async (merchantAddress: string): Promise<bigint | null> => {
    if (!publicClient) return null;
    setLoading(true);
    setError(null);

    try {
      const handle = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "getRevenue",
        args: [merchantAddress as `0x${string}`],
        account: merchantAddress as `0x${string}`,
      }) as bigint;

      if (!handle || handle === 0n) return 0n;


      const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
      const instance = await getFhevmInstance(ethereum);
      const { privateKey, publicKey } = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;

      const eip712 = instance.createEIP712(publicKey, [CONTRACT_ADDRESS], startTimestamp, durationDays);

      const signature = await signTypedDataAsync({
        domain: eip712.domain as Parameters<typeof signTypedDataAsync>[0]["domain"],
        types: eip712.types as Parameters<typeof signTypedDataAsync>[0]["types"],
        primaryType: eip712.primaryType,
        message: eip712.message as Record<string, unknown>,
      });

      const handleHex = `0x${handle.toString(16).padStart(64, "0")}` as `0x${string}`;
      const results = await instance.userDecrypt(
        [{ handle: handleHex, contractAddress: CONTRACT_ADDRESS }],
        privateKey,
        publicKey,
        signature,
        [CONTRACT_ADDRESS],
        merchantAddress,
        startTimestamp,
        durationDays,
      );

      const clearValue = Object.values(results)[0];
      return typeof clearValue === "bigint" ? clearValue : BigInt(String(clearValue));
    } catch (err) {
      setError(err instanceof Error ? err.message : "decryption failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [publicClient, signTypedDataAsync]);

  return { decryptBalance, decryptRevenue, loading, error };
}
