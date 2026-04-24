"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { api, Market } from "@/lib/api";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

const STATUS_COLORS: Record<number, string> = {
  0: "text-green-400",
  1: "text-yellow-400",
  2: "text-blue-400",
  3: "text-orange-400",
  4: "text-red-400",
};

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [betSide, setBetSide] = useState<"yes" | "no">("yes");
  const [betAmount, setBetAmount] = useState("0.01");
  const [triggering, setTriggering] = useState(false);
  const [oracleMsg, setOracleMsg] = useState<string | null>(null);

  useEffect(() => {
    api.markets
      .get(Number(id))
      .then(setMarket)
      .finally(() => setLoading(false));
  }, [id]);

  const triggerOracle = async () => {
    setTriggering(true);
    setOracleMsg(null);
    try {
      const job = await api.oracle.trigger(Number(id));
      setOracleMsg(`Oracle job #${job.id} started (${job.job_type}). Status: ${job.status}`);
    } catch (e: unknown) {
      setOracleMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading market…</div>;
  }

  if (!market) {
    return <div className="text-center py-20 text-red-400">Market not found.</div>;
  }

  const totalPool = market.yes_pool + market.no_pool;
  const yesPercent = totalPool > 0 ? Math.round((market.yes_pool / totalPool) * 100) : 50;
  const marketType = MARKET_TYPES.find((t) => t.value === market.market_type);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <a href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-6 inline-block">
        ← All Markets
      </a>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{marketType?.icon}</span>
          <span className="text-xs text-gray-500">{marketType?.label}</span>
          <span className={`ml-auto text-xs font-medium ${STATUS_COLORS[market.status]}`}>
            {MARKET_STATUS[market.status]}
          </span>
        </div>

        <h1 className="text-xl font-bold mb-4 leading-snug">{market.question}</h1>

        {/* Pool bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-green-400 font-semibold">YES — {yesPercent}%</span>
            <span className="text-red-400 font-semibold">NO — {100 - yesPercent}%</span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-gray-500 text-xs mb-1">Total Pool</div>
            <div className="font-semibold">{totalPool.toFixed(4)} ETH</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="text-gray-500 text-xs mb-1">Closes</div>
            <div className="font-semibold">
              {new Date(market.resolution_time).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Outcome */}
        {market.status === 2 && market.outcome !== null && (
          <div
            className={`mt-4 py-3 rounded-xl text-center text-lg font-bold ${
              market.outcome
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {market.outcome ? "✓ YES" : "✗ NO"}
            {market.oracle_confidence && (
              <span className="text-sm ml-2 opacity-70">
                AI Confidence: {market.oracle_confidence}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Place Bet */}
      {market.status === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Place Bet</h2>
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setBetSide("yes")}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                betSide === "yes"
                  ? "bg-green-500/20 border border-green-500 text-green-400"
                  : "bg-gray-800 border border-gray-700 text-gray-400"
              }`}
            >
              YES
            </button>
            <button
              onClick={() => setBetSide("no")}
              className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                betSide === "no"
                  ? "bg-red-500/20 border border-red-500 text-red-400"
                  : "bg-gray-800 border border-gray-700 text-gray-400"
              }`}
            >
              NO
            </button>
          </div>
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-1 block">Amount (ETH)</label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <p className="text-xs text-gray-500 mb-4">
            On-chain betting requires MetaMask. Connect wallet and call{" "}
            <code className="bg-gray-800 px-1 rounded">placeBet({market.chain_market_id ?? "?"})</code>{" "}
            on the PredictionMarket contract.
          </p>
          <button
            disabled={!address}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-medium disabled:opacity-50 transition-all"
          >
            {address ? `Bet ${betAmount} ETH on ${betSide.toUpperCase()}` : "Connect Wallet"}
          </button>
        </div>
      )}

      {/* Oracle Trigger */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-semibold mb-2">AI Oracle</h2>
        <p className="text-sm text-gray-400 mb-4">
          Manually trigger the AI oracle pipeline to resolve this market.
          In production this runs automatically after the resolution time.
        </p>
        <div className="text-xs text-gray-500 font-mono bg-gray-800 rounded-lg px-3 py-2 mb-4 break-all">
          Source: {market.data_source}
        </div>
        <button
          onClick={triggerOracle}
          disabled={triggering || market.status !== 0}
          className="w-full py-2.5 rounded-xl bg-cyan-600/20 border border-cyan-600/40 text-cyan-400 hover:bg-cyan-600/30 text-sm font-medium disabled:opacity-40 transition-all"
        >
          {triggering ? "Triggering…" : "Trigger Oracle Resolution"}
        </button>
        {oracleMsg && (
          <p className="text-xs mt-3 text-gray-400 bg-gray-800 rounded-lg px-3 py-2">
            {oracleMsg}
          </p>
        )}
      </div>
    </div>
  );
}
