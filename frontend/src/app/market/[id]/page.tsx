"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { api, Market } from "@/lib/api";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

const STATUS_EMPH: Record<number, string> = {
  0: "text-emerald-800",
  1: "text-amber-800",
  2: "text-sky-800",
  3: "text-orange-800",
  4: "text-rose-800",
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
      setOracleMsg(`Job #${job.id} — ${job.job_type} — ${job.status}`);
    } catch (e: unknown) {
      setOracleMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return <p className="py-20 text-center font-bold text-neutral-500">Loading…</p>;
  }

  if (!market) {
    return <p className="py-20 text-center font-bold text-red-800">Market not found.</p>;
  }

  const totalPool = market.yes_pool + market.no_pool;
  const yesPercent = totalPool > 0 ? Math.round((market.yes_pool / totalPool) * 100) : 50;
  const marketType = MARKET_TYPES.find((t) => t.value === market.market_type);
  const isOpen = market.status === 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="mb-6 inline-block text-sm font-bold text-neutral-700 underline decoration-2 decoration-neutral-950 underline-offset-4"
      >
        ← Markets
      </Link>

      <div
        className="mb-6 border-2 border-neutral-950 bg-[#fffef8] p-5 sm:p-6"
        style={{ boxShadow: "6px 6px 0 0 #0a0a0a" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">{marketType?.icon}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">
            {marketType?.label}
          </span>
          <span
            className={`ml-auto text-xs font-black uppercase ${STATUS_EMPH[market.status] ?? "text-neutral-800"}`}
          >
            {MARKET_STATUS[market.status]}
          </span>
        </div>

        <h1 className="mb-4 text-xl font-black leading-snug text-neutral-950 sm:text-2xl">
          {market.question}
        </h1>

        <div className="mb-4">
          <div className="mb-1 flex justify-between text-sm font-black">
            <span className="text-emerald-700">YES {yesPercent}%</span>
            <span className="text-rose-700">NO {100 - yesPercent}%</span>
          </div>
          <div className="h-3 border-2 border-neutral-950 bg-white">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div
            className="border-2 border-neutral-950 bg-white p-3"
            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
          >
            <div className="text-[10px] font-bold uppercase text-neutral-500">Pool (Ξ)</div>
            <div className="font-mono font-bold">{totalPool.toFixed(4)}</div>
          </div>
          <div
            className="border-2 border-neutral-950 bg-white p-3"
            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
          >
            <div className="text-[10px] font-bold uppercase text-neutral-500">Closes</div>
            <div className="text-xs font-bold">
              {new Date(market.resolution_time).toLocaleString()}
            </div>
          </div>
        </div>

        {market.status === 2 && market.outcome !== null && (
          <div
            className={`mt-4 border-2 border-neutral-950 py-3 text-center text-lg font-black ${
              market.outcome ? "bg-emerald-300" : "bg-rose-300"
            }`}
            style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
          >
            {market.outcome ? "YES" : "NO"}
            {market.oracle_confidence != null && market.oracle_confidence > 0 && (
              <span className="ml-2 text-sm font-bold opacity-80">
                {Math.round(market.oracle_confidence)}% conf.
              </span>
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div
          className="mb-6 border-2 border-neutral-950 bg-white p-5"
          style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
        >
          <h2 className="mb-1 text-sm font-black uppercase">Place bet</h2>
          <p className="mb-4 text-xs font-medium text-neutral-600">
            Wire the contract in env, then we&apos;ll send <span className="font-mono">placeBet</span> from
            the UI. Until then, connect shows intent only.
          </p>
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setBetSide("yes")}
              className={`flex-1 border-2 border-neutral-950 py-2.5 text-sm font-black ${
                betSide === "yes" ? "bg-emerald-300" : "bg-white hover:bg-emerald-50"
              }`}
              style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
            >
              YES
            </button>
            <button
              type="button"
              onClick={() => setBetSide("no")}
              className={`flex-1 border-2 border-neutral-950 py-2.5 text-sm font-black ${
                betSide === "no" ? "bg-rose-300" : "bg-white hover:bg-rose-50"
              }`}
              style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
            >
              NO
            </button>
          </div>
          <div className="mb-3">
            <span className="nb-label">Amount (ETH)</span>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              className="nb-input font-mono"
            />
          </div>
          <p className="mb-3 font-mono text-xs text-neutral-600">
            placeBet( {String(market.chain_market_id ?? "—")} )
          </p>
          <button
            type="button"
            disabled={!address}
            className="nb-btn w-full !py-2.5"
          >
            {address
              ? `Ξ ${betAmount} on ${betSide.toUpperCase()} — wire contract to enable`
              : "Connect wallet"}
          </button>
        </div>
      )}

      <div
        className="border-2 border-neutral-950 bg-amber-100 p-5"
        style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
      >
        <h2 className="text-sm font-black uppercase">Oracle</h2>
        <p className="mb-3 text-sm font-medium text-neutral-800">
          Runs the AI pipeline on the evidence URL. Only while status is <strong>open</strong>.
        </p>
        <div
          className="mb-3 break-all font-mono text-xs text-neutral-800"
          style={{ boxShadow: "inset 0 0 0 2px #0a0a0a" }}
        >
          <div className="bg-neutral-950 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
            source
          </div>
          <div className="bg-white p-2">{market.data_source}</div>
        </div>
        <button
          type="button"
          onClick={triggerOracle}
          disabled={triggering || !isOpen}
          className="nb-btn w-full !border-neutral-950 !bg-white !py-2.5 text-sm"
        >
          {triggering ? "…" : "Run resolution"}
        </button>
        {!isOpen && (
          <p className="mt-2 text-xs font-bold text-amber-900">Closed — not open in DB.</p>
        )}
        {oracleMsg && (
          <p className="mt-3 border-2 border-neutral-950 bg-white p-2 font-mono text-xs">{oracleMsg}</p>
        )}
      </div>
    </div>
  );
}
