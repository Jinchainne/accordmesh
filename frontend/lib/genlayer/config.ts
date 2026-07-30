const defaultContractAddress = "0x5187c794213c17Ab3E3e4Aa1EB9E7d9DD19BEC2b";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? defaultContractAddress;
const configuredMode = process.env.NEXT_PUBLIC_APP_MODE;
const resolvedMode = configuredMode ?? (contractAddress ? "live" : "mock");

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: resolvedMode,
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
  contractAddress,
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = appConfig.mode === "mock";
