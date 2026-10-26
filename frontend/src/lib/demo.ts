import type { Market } from "./api";

export const DEMO_MODE = !process.env.NEXT_PUBLIC_API_URL?.trim();
export const DEMO_EVENT = "polyoracle-demo-change";
const KEY = "polyoracle-demo-v1";
export const INITIAL_BALANCE = 10000;
export type Category = "Crypto" | "Sports" | "Politics" | "Tech & AI" | "Culture" | "Economy";
export type Side = "yes" | "no";
export interface MarketMeta { category: Category; symbol: string; color: string; change: number; volume: number; tag?: string }
export const marketMeta: Record<number, MarketMeta> = {
  1: { category: "Crypto", symbol: "₿", color: "orange", change: 5.2, volume: 1420000, tag: "HOT" },
  2: { category: "Sports", symbol: "⚽", color: "blue", change: 2.8, volume: 842000 },
  3: { category: "Politics", symbol: "US", color: "red", change: -1.4, volume: 2370000 },
  4: { category: "Tech & AI", symbol: "✳", color: "mint", change: 8.3, volume: 628000, tag: "TRENDING" },
  5: { category: "Crypto", symbol: "Ξ", color: "purple", change: 3.7, volume: 956000 },
  6: { category: "Sports", symbol: "🏀", color: "gold", change: -2.1, volume: 517000 },
  7: { category: "Economy", symbol: "↗", color: "blue", change: 1.6, volume: 1890000 },
  8: { category: "Culture", symbol: "♫", color: "pink", change: 4.2, volume: 284000 },
  9: { category: "Tech & AI", symbol: "N", color: "lime", change: 6.5, volume: 763000 },
  10: { category: "Politics", symbol: "EU", color: "blue", change: -0.8, volume: 413000 },
  11: { category: "Sports", symbol: "🏏", color: "mint", change: 2.3, volume: 687000 },
  12: { category: "Crypto", symbol: "◎", color: "purple", change: 7.1, volume: 539000 },
};

const seeds: [string, number, number][] = [
  ["Will Bitcoin hit $150,000 before the end of 2026?", 67, 65],
  ["Will Arsenal win the 2026–27 Premier League?", 42, 205],
  ["Will Democrats win the House in the 2026 midterms?", 58, 10],
  ["Will OpenAI announce a new flagship model this year?", 81, 65],
  ["Will Ethereum reach $5,000 by December?", 54, 65],
  ["Will the Lakers win the 2027 NBA championship?", 24, 240],
  ["Will the Fed cut interest rates at its next meeting?", 72, 18],
  ["Will Taylor Swift announce a new tour in 2026?", 38, 65],
  ["Will NVIDIA become the most valuable company in 2026?", 63, 65],
  ["Will the EU pass a new AI regulation by year end?", 46, 65],
  ["Will India win the next Cricket World Cup?", 61, 390],
  ["Will Solana reach $300 before the end of 2026?", 35, 65],
];

export function seedMarkets(): Market[] {
  return seeds.map(([question, probability, days], i) => ({
    id: i + 1, question, chain_market_id: null, market_type: 4,
    data_source: "https://example.com/demo-resolution-rules", creator_address: null,
    created_at: "2026-10-26T00:00:00Z", resolution_time: new Date(Date.UTC(2026, 9, 26 + days)).toISOString(),
    yes_pool: probability * 10, no_pool: (100 - probability) * 10,
    status: 0, outcome: null, oracle_confidence: null, tx_hash: null,
  }));
}

export interface Position { marketId: number; side: Side; shares: number; cost: number }
export interface Trade { id: string; marketId: number; side: Side; action: "buy" | "sell"; amount: number; shares: number; at: string }
export interface DemoState { version: 1; balance: number; funded: number; positions: Position[]; trades: Trade[]; markets: Market[] }
function initial(): DemoState { return { version: 1, balance: INITIAL_BALANCE, funded: INITIAL_BALANCE, positions: [], trades: [], markets: seedMarkets() }; }

export function readDemo(): DemoState {
  if (typeof window === "undefined") return initial();
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null") as DemoState | null;
    if (value?.version === 1 && Number.isFinite(value.balance) && value.balance >= 0 && Number.isFinite(value.funded) && Array.isArray(value.markets) && Array.isArray(value.positions) && Array.isArray(value.trades)) return value;
  } catch { /* A fresh session remains usable if storage is corrupted. */ }
  return initial();
}

export function saveDemo(state: DemoState) {
  // Save before announcing success. Storage failure must not appear as a completed trade.
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

export function probability(m: Market) { const total = m.yes_pool + m.no_pool; return total > 0 ? Math.max(1, Math.min(99, Math.round(m.yes_pool / total * 100))) : 50; }
export function metaFor(m: Market): MarketMeta { return marketMeta[m.id] ?? { category: m.market_type === 2 ? "Economy" : "Culture", symbol: "P", color: "mint", change: 0, volume: m.yes_pool + m.no_pool }; }
export function usd(n: number, decimals = 2) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n); }
export function compact(n: number) { return n >= 1000000 ? `$${(n / 1000000).toFixed(2)}m` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : usd(n, 0); }

export function executeDemoTrade(marketId: number, side: Side, action: "buy" | "sell", amount: number): Trade {
  if (!DEMO_MODE) throw new Error("Demo trading is unavailable in connected mode.");
  if (!Number.isFinite(amount) || amount < 1 || Math.round(amount * 100) !== amount * 100 && Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001) throw new Error("Enter an amount of at least $1, with up to two decimal places.");
  const state = readDemo();
  const market = state.markets.find(m => m.id === marketId);
  if (!market || market.status !== 0 || Date.parse(market.resolution_time) <= Date.now()) throw new Error("This market is closed for trading.");
  const price = (side === "yes" ? probability(market) : 100 - probability(market)) / 100;
  const shares = amount / price;
  let position = state.positions.find(p => p.marketId === marketId && p.side === side);
  if (action === "buy") {
    if (amount > state.balance) throw new Error("Insufficient demo balance. Add demo funds to continue.");
    if (!position) { position = { marketId, side, shares: 0, cost: 0 }; state.positions.push(position); }
    position.shares += shares; position.cost += amount; state.balance -= amount;
  } else {
    if (!position || shares > position.shares + 0.0000001) throw new Error("You do not hold enough shares to sell this amount.");
    position.cost *= Math.max(0, (position.shares - shares) / position.shares);
    position.shares = Math.max(0, position.shares - shares); state.balance += amount;
    state.positions = state.positions.filter(p => p.shares > 0.0000001);
  }
  state.balance = Math.round(state.balance * 100) / 100;
  const trade: Trade = { id: crypto.randomUUID(), marketId, side, action, amount, shares, at: new Date().toISOString() };
  state.trades.unshift(trade);
  saveDemo(state);
  return trade;
}

export function addDemoFunds(amount: number) {
  if (!DEMO_MODE || !Number.isFinite(amount) || amount < 1 || amount > 100000) throw new Error("Choose between $1 and $100,000 in demo funds.");
  const state = readDemo(); state.balance += amount; state.funded += amount; saveDemo(state);
}

export async function demoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const state = readDemo();
  const url = new URL(path, "https://demo.local");
  let result: unknown;
  if (url.pathname === "/markets/summary") {
    const by_status: Record<string, number> = {};
    state.markets.forEach(m => { by_status[String(m.status)] = (by_status[String(m.status)] || 0) + 1; });
    result = { total: state.markets.length, by_status };
  } else if (url.pathname === "/markets/" && init?.method === "POST") {
    const body = JSON.parse(String(init.body));
    if (!body.question?.trim() || body.question.trim().length < 5) throw new Error("Write a question of at least 5 characters.");
    if (!Number.isFinite(Date.parse(body.resolution_time)) || Date.parse(body.resolution_time) <= Date.now()) throw new Error("Choose a future resolution date.");
    const market: Market = { ...seedMarkets()[0], ...body, id: Math.max(0, ...state.markets.map(m => m.id)) + 1, created_at: new Date().toISOString(), yes_pool: 0, no_pool: 0, data_source: body.data_source || "Demo market — manually specified resolution", chain_market_id: null };
    state.markets.unshift(market); saveDemo(state); result = market;
  } else if (url.pathname === "/markets/") {
    const rows = state.markets.filter(m => !url.searchParams.has("status_filter") || m.status === Number(url.searchParams.get("status_filter")));
    const limit = Number(url.searchParams.get("limit") || 40), offset = Number(url.searchParams.get("offset") || 0);
    result = { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
  } else if (/^\/markets\/\d+$/.test(url.pathname)) {
    result = state.markets.find(m => m.id === Number(url.pathname.split("/").pop()));
    if (!result) throw new Error("Market not found.");
  } else if (url.pathname === "/oracle/jobs") result = [];
  else if (url.pathname.startsWith("/oracle/")) throw new Error("AI resolution requires a connected backend and oracle credentials. Demo markets are practice markets.");
  else if (url.pathname.startsWith("/sources/")) throw new Error("Source discovery requires a connected backend. Paste a public evidence URL instead.");
  else throw new Error("This action requires a connected backend.");
  return result as T;
}
