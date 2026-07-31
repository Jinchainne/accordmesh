const defaultContractAddress = "0x4f4EdcAf1d8Fe65523aB0FEb92F79D17Cc9140FE";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? defaultContractAddress;

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: "live",
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
  contractAddress,
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = false;
