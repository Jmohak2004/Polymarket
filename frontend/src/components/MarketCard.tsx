"use client";

import Link from "next/link";
import { Market } from "@/lib/api";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

interface Props {
  market: Market;
}

const STATUS_COLORS: Record<number, string> = {
  0: "text-green-400 bg-green-400/10",
  1: "text-yellow-400 bg-yellow-400/10",
  2: "text-blue-400 bg-blue-400/10",
  3: "text-orange-400 bg-orange-400/10",
  4: "text-red-400 bg-red-400/10",
};

export function MarketCard({ market }: Props) {
  const totalPool = market.yes_pool + market.no_pool;
  const yesPercent =
    totalPool > 0 ? Math.round((market.yes_pool / totalPool) * 100) : 50;
  const noPercent = 100 - yesPercent;

  const marketTypeInfo = MARKET_TYPES.find((t) => t.value === market.market_type);
  const statusLabel = MARKET_STATUS[market.status] ?? "Unknown";

  const resolutionDate = new Date(market.resolution_time);
  const isExpired = resolutionDate < new Date();

  return (
    <Link href={`/market/${market.id}`}>
      <div className="border border-gray-800 rounded-xl p-5 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/80 transition-all cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-lg">{marketTypeInfo?.icon}</span>
            <span className="text-xs text-gray-500">{marketTypeInfo?.label}</span>
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[market.status]}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Question */}
        <p className="font-medium text-gray-100 group-hover:text-white mb-4 line-clamp-2 leading-snug">
          {market.question}
        </p>

        {/* Pool bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span className="text-green-400 font-medium">YES {yesPercent}%</span>
            <span className="text-red-400 font-medium">NO {noPercent}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Pool: {totalPool.toFixed(4)} ETH</span>
          <span className={isExpired ? "text-red-400" : ""}>
            {isExpired ? "Expired" : `Closes ${resolutionDate.toLocaleDateString()}`}
          </span>
        </div>

        {/* Resolved outcome */}
        {market.status === 2 && market.outcome !== null && (
          <div
            className={`mt-3 text-center py-1.5 rounded-lg text-sm font-bold ${
              market.outcome
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            Outcome: {market.outcome ? "✓ YES" : "✗ NO"}
            {market.oracle_confidence && (
              <span className="ml-2 text-xs opacity-70">
                ({market.oracle_confidence}% confidence)
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
