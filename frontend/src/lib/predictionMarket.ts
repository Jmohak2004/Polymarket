import type { Address } from "viem";

/** Minimal ABI for `placeBet` / UI wiring (keep in sync with contracts). */
export const predictionMarketAbi = [
  {
    type: "function",
    name: "placeBet",
    stateMutability: "payable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "isYes", type: "bool" },
    ],
    outputs: [],
  },
] as const;

export function getPredictionMarketAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS;
  if (!raw || !raw.startsWith("0x") || raw.length < 42) return undefined;
  return raw as Address;
}
