import type { Address } from "viem";

/**
 * Matches `PredictionMarket.sol` / `IPredictionMarket.Market`.
 * Enum slots decode as numeric codes (MARKET_TYPES / MARKET_STATUS on the frontend align by index).
 */
export type PredictionMarketStruct = {
  id: bigint;
  question: string;
  /** `MarketType` enum */
  marketType: number;
  dataSource: string;
  resolutionTime: bigint;
  createdAt: bigint;
  creator: Address;
  yesPool: bigint;
  noPool: bigint;
  /** `MarketStatus` enum */
  status: number;
  outcome: boolean;
  totalBets: bigint;
  platformFeePool: bigint;
};

/**
 * Consolidated ABI for wagmi viem hooks (keep aligned with `@contracts/PredictionMarket.sol`).
 */
export const predictionMarketAbi = [
  {
    type: "function",
    name: "createMarket",
    stateMutability: "payable",
    inputs: [
      { name: "question", type: "string" },
      { name: "marketType", type: "uint8" },
      { name: "dataSource", type: "string" },
      { name: "resolutionTime", type: "uint256" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
  },
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
  {
    type: "function",
    name: "claimReward",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "disputeMarket",
    stateMutability: "payable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelMarket",
    stateMutability: "nonpayable",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveMarket",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcome", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMarket",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "question", type: "string" },
          { name: "marketType", type: "uint8" },
          { name: "dataSource", type: "string" },
          { name: "resolutionTime", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "yesPool", type: "uint256" },
          { name: "noPool", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "outcome", type: "bool" },
          { name: "totalBets", type: "uint256" },
          { name: "platformFeePool", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getUserBet",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "yesBet", type: "uint256" },
      { name: "noBet", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "calculatePayout",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalMarkets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "CREATION_FEE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MIN_BET", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "DISPUTE_BOND", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "DISPUTE_PERIOD", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export function getPredictionMarketAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS;
  if (!raw || !raw.startsWith("0x") || raw.length < 42) return undefined;
  return raw as Address;
}
