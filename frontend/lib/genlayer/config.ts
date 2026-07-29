export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: process.env.NEXT_PUBLIC_APP_MODE ?? "mock",
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
  contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "",
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = appConfig.mode === "mock";

