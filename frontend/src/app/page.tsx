"use client";

import { useEffect, useState } from "react";
import { api, Market } from "@/lib/api";
import { MarketCard } from "@/components/MarketCard";
import Link from "next/link";

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Open", value: 0 },
  { label: "Resolved", value: 2 },
  { label: "Disputed", value: 3 },
];

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<number | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    api.markets
      .list(filter)
      .then(setMarkets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-12 mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Predict. Bet. Earn.
          </span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-6">
          Decentralized prediction markets resolved by a multi-node AI oracle
          network. Speech, image, weather, and social events.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-medium transition-all shadow-lg shadow-purple-900/30"
        >
          <span>+</span> Create Market
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Markets", value: markets.length },
          {
            label: "Open Markets",
            value: markets.filter((m) => m.status === 0).length,
          },
          {
            label: "Resolved",
            value: markets.filter((m) => m.status === 2).length,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f.value
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Markets grid */}
      {loading && (
        <div className="text-center py-20 text-gray-500">Loading markets…</div>
      )}
      {error && (
        <div className="text-center py-20 text-red-400">
          <p className="text-lg mb-2">Could not connect to backend</p>
          <p className="text-sm text-gray-500">{error}</p>
          <p className="text-sm text-gray-600 mt-2">
            Start the FastAPI server: <code className="bg-gray-800 px-2 py-0.5 rounded">cd backend && uvicorn app.main:app --reload</code>
          </p>
        </div>
      )}
      {!loading && !error && markets.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-lg">No markets yet.</p>
          <Link href="/create" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
            Create the first one →
          </Link>
        </div>
      )}
      {!loading && !error && markets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
