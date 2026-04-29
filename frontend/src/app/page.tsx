"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, Market, MarketSummary } from "@/lib/api";
import { shortError } from "@/lib/errors";
import { toastError } from "@/lib/toast";
import { MarketCard } from "@/components/MarketCard";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Open", value: 0 },
  { label: "Done", value: 2 },
  { label: "Disputed", value: 3 },
];

const PAGE_SIZE = 40;

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | undefined>(undefined);

  useEffect(() => {
    api.markets
      .summary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.markets
      .list(filter, { limit: PAGE_SIZE, offset: 0 })
      .then((p) => {
        setMarkets(p.items);
        setListTotal(p.total);
      })
      .catch((e) => {
        const msg = shortError(e);
        setError(msg);
        toastError(e);
      })
      .finally(() => setLoading(false));
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (loadingMore || markets.length >= listTotal) return;
    setLoadingMore(true);
    try {
      const p = await api.markets.list(filter, {
        limit: PAGE_SIZE,
        offset: markets.length,
      });
      setMarkets((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const extra = p.items.filter((x) => !seen.has(x.id));
        return [...prev, ...extra];
      });
      setListTotal(p.total);
    } catch (e) {
      toastError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, loadingMore, listTotal, markets.length]);

  const openCount = summary?.by_status["0"] ?? 0;
  const resolvedCount = summary?.by_status["2"] ?? 0;

  return (
    <div>
      <div
        className="mb-10 border-2 border-neutral-950 bg-[#fffef8] p-6 sm:p-8"
        style={{ boxShadow: "6px 6px 0 0 #0a0a0a" }}
      >
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-neutral-600">
          Prediction + AI oracles
        </p>
        <h1 className="mb-3 max-w-2xl text-3xl font-black leading-tight text-neutral-950 sm:text-4xl md:text-5xl">
          Real events. Real stakes. On-chain.
        </h1>
        <p className="mb-6 max-w-xl text-sm font-medium leading-relaxed text-neutral-600">
          Create markets, back your call, and let independent checks resolve
          the outcome: speech, news, weather, and more.
        </p>
        <Link href="/create" className="nb-btn inline-flex gap-2 text-base">
          + New market
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total", value: summary?.total ?? listTotal },
          { label: "Open", value: summary != null ? openCount : "—" },
          { label: "Resolved", value: summary != null ? resolvedCount : "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border-2 border-neutral-950 bg-white px-3 py-3 text-center sm:px-4"
            style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
          >
            <div className="font-mono text-2xl font-black tabular-nums text-neutral-950 sm:text-3xl">
              {stat.value}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-600 sm:text-xs">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={String(f.value)}
            type="button"
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value
                ? "nb-btn !bg-neutral-950 !text-amber-300 !shadow-[4px_4px_0_0_#0a0a0a] py-1.5 text-sm"
                : "nb-btn-outline border-2 border-neutral-950 bg-white py-1.5 text-sm"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="py-20 text-center font-bold text-neutral-500">Loading…</p>
      )}
      {error && (
        <div
          className="border-2 border-neutral-950 bg-rose-100 p-6 text-center"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          <p className="mb-1 font-bold text-red-900">Backend unreachable</p>
          <p className="mb-2 text-sm text-red-800">{error}</p>
          <p className="text-xs text-neutral-700">
            Run:{" "}
            <code className="font-mono font-bold">uvicorn app.main:app --reload</code> in /backend
          </p>
        </div>
      )}
      {!loading && !error && markets.length === 0 && (
        <div
          className="border-2 border-dashed border-neutral-950 bg-white/40 py-20 text-center"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          <p className="mb-2 text-3xl" aria-hidden>
            ▢
          </p>
          <p className="mb-3 font-bold text-neutral-800">
            {(filter === undefined && (summary?.total ?? listTotal) === 0
              ? "No markets yet."
              : "No markets match this filter."
            )}
          </p>
          <Link
            href="/create"
            className="text-sm font-bold text-neutral-950 underline decoration-2 underline-offset-4"
          >
            Create the first one →
          </Link>
        </div>
      )}
      {!loading && !error && markets.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
          {markets.length < listTotal && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="nb-btn-outline border-2 border-neutral-950 px-8 py-2 text-sm font-bold disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Load more (${markets.length} / ${listTotal})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
