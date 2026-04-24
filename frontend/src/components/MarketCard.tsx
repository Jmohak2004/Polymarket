"use client";

import Link from "next/link";
import { Market } from "@/lib/api";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

interface Props {
  market: Market;
}

const STATUS_STYLE: Record<number, string> = {
  0: "bg-emerald-200 text-neutral-950",
  1: "bg-amber-200 text-neutral-950",
  2: "bg-sky-200 text-neutral-950",
  3: "bg-orange-200 text-neutral-950",
  4: "bg-rose-200 text-neutral-950",
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
    <Link href={`/market/${market.id}`} className="block">
      <article
        className="nb-card nb-card-hover h-full p-4 sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-lg" aria-hidden>
              {marketTypeInfo?.icon}
            </span>
            <span className="truncate text-xs font-bold uppercase tracking-wide text-neutral-600">
              {marketTypeInfo?.label}
            </span>
          </div>
          <span
            className={`shrink-0 border-2 border-neutral-950 px-2 py-0.5 text-[10px] font-black uppercase ${
              STATUS_STYLE[market.status] ?? "bg-white"
            }`}
            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
          >
            {statusLabel}
          </span>
        </div>

        <h2 className="mb-4 line-clamp-2 text-base font-bold leading-snug text-neutral-950">
          {market.question}
        </h2>

        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs font-bold">
            <span className="text-[var(--nb-yes)]">YES {yesPercent}%</span>
            <span className="text-[var(--nb-no)]">NO {noPercent}%</span>
          </div>
          <div className="h-2.5 border-2 border-neutral-950 bg-white">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-medium text-neutral-600">
          <span className="font-mono">Ξ {totalPool.toFixed(4)}</span>
          <span className={isExpired ? "font-bold text-red-800" : ""}>
            {isExpired ? "Closed" : resolutionDate.toLocaleDateString()}
          </span>
        </div>

        {market.status === 2 && market.outcome !== null && (
          <div
            className={`mt-3 border-2 border-neutral-950 py-2 text-center text-sm font-black ${
              market.outcome
                ? "bg-emerald-300 text-neutral-950"
                : "bg-rose-300 text-neutral-950"
            }`}
            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
          >
            {market.outcome ? "YES" : "NO"}
            {market.oracle_confidence != null && market.oracle_confidence > 0 && (
              <span className="ml-2 text-xs font-bold opacity-80">
                {Math.round(market.oracle_confidence)}% conf.
              </span>
            )}
          </div>
        )}
      </article>
    </Link>
  );
}
