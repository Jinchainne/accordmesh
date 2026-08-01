const defaultContractAddress = "0xA9066B5C4effDC9700791E07AFeD4b56149973A3";

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? defaultContractAddress;

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "AccordMesh",
  mode: "live",
  rpcUrl: process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api",
  contractAddress,
  networkName: process.env.NEXT_PUBLIC_GENLAYER_NETWORK ?? "studionet",
};

export const isMockMode = false;
