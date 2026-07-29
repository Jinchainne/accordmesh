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

