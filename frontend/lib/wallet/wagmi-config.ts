import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { studionetChain } from "./studionet-chain";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

export const wagmiConfig = getDefaultConfig({
  appName: "AccordMesh",
  projectId: walletConnectProjectId,
  chains: [studionetChain],
  ssr: false,
  transports: {
    [studionetChain.id]: http("https://studio.genlayer.com/api"),
  },
});
