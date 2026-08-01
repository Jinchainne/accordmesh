const defaultContractAddress = "0xf7F8b355543cE3730264e338039da1bA148420C3";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? defaultContractAddress;

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: "live",
  rpcUrl: typeof window !== "undefined" ? "/api/rpc" : (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api"),
  contractAddress,
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = false;
