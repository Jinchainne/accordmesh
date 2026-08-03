const defaultContractAddress = "0x7a31F66E3EE60AB37bD39B8572B3344aE23f467b";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? defaultContractAddress;

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: "live",
  rpcUrl: typeof window !== "undefined" ? "/api/rpc" : (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api"),
  contractAddress,
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = false;
