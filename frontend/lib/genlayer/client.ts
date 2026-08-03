import { createClient } from "genlayer-js";
import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import { appConfig } from "./config";
import type { EthereumProvider } from "./wallet";

const chains = {
  localnet,
  studionet,
  testnetAsimov,
  testnetBradbury,
} as const;

export function getConfiguredChain() {
  return chains[appConfig.networkName as keyof typeof chains] ?? studionet;
}

export function createReadClient() {
  return createClient({
    chain: getConfiguredChain(),
    endpoint: appConfig.rpcUrl,
  });
}

export function createWriteClient(address: `0x${string}`, provider: EthereumProvider) {
  return createClient({
    chain: getConfiguredChain(),
    endpoint: appConfig.rpcUrl,
    account: address,
    provider,
  });
}

// Timeout wrapper for RPC calls (15s default)
export async function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`RPC request timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// Retry with exponential backoff for rate-limited requests
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 5000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn());
    } catch (err) {
      const msg = (err as Error).message?.toLowerCase() || "";
      const isRateLimit = msg.includes("rate limit") || msg.includes("429") || msg.includes("too many requests");
      const isRetryable = isRateLimit || msg.includes("timeout") || msg.includes("failed to fetch") || msg.includes("server busy");

      if (!isRetryable || attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[retry ${attempt}/${maxRetries}] ${msg.slice(0, 80)}… waiting ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

