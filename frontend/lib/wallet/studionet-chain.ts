import { defineChain } from "viem";

export const studionetChain = defineChain({
  id: 61999,
  name: "GenLayer Studio Network",
  nativeCurrency: {
    name: "GEN Token",
    symbol: "GEN",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://studio.genlayer.com/api"],
    },
  },
  blockExplorers: {
    default: {
      name: "GenLayer Explorer",
      url: "https://explorer.genlayer.com",
    },
  },
  testnet: true,
});
