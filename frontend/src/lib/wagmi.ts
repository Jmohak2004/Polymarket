import { createConfig, http } from "wagmi";
import { hardhat, polygon, polygonAmoy, baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";

export const config = createConfig({
  chains: [hardhat, polygonAmoy, polygon, baseSepolia],
  connectors: [injected(), metaMask()],
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [polygonAmoy.id]: http(),
    [polygon.id]: http(),
    [baseSepolia.id]: http(),
  },
});

export const MARKET_TYPES = [
  { value: 0, label: "Speech Event", icon: "🎙️" },
  { value: 1, label: "Image / Video", icon: "📷" },
  { value: 2, label: "Weather", icon: "🌦️" },
  { value: 3, label: "Social Media", icon: "📱" },
  { value: 4, label: "Custom", icon: "⚡" },
] as const;

export const MARKET_STATUS = ["Open", "Closed", "Resolved", "Disputed", "Cancelled"] as const;
