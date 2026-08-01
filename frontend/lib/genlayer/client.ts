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
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`RPC request timed out after ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

