"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, OracleJob } from "@/lib/api";

const POLL_MS = 6000;

const STATUS_STYLES: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  pending: {
    bg: "bg-amber-100",
    border: "border-amber-900",
    text: "text-amber-950",
  },
  running: {
    bg: "bg-sky-100",
    border: "border-sky-900",
    text: "text-sky-950",
  },
  done: {
    bg: "bg-emerald-100",
    border: "border-emerald-900",
    text: "text-emerald-950",
  },
  failed: {
    bg: "bg-rose-100",
    border: "border-rose-900",
    text: "text-rose-950",
  },
};

const JOB_ICONS: Record<string, string> = {
  speech: "🎙️",
  image: "📷",
  weather: "🌦️",
  social: "📱",
  custom: "⚡",
};

export default function OracleJobsPage() {
  const [jobs, setJobs] = useState<OracleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [filterMarket, setFilterMarket] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadJobs = useCallback(async () => {
    try {
      const list = await api.oracle.jobs();
      setJobs(list);
      setLoadErr(null);
    } catch {
      setJobs([]);
      setLoadErr("Could not load jobs (is the API running?).");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadJobs().finally(() => setLoading(false));

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      loadJobs();
    }, POLL_MS);

    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadJobs();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadJobs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = new URLSearchParams(window.location.search).get("market")?.trim();
    if (m) setFilterMarket(m);
  }, []);

  const marketIds = useMemo(() => {
    const s = new Set<number>();
    jobs.forEach((j) => s.add(j.market_id));
    return [...s].sort((a, b) => a - b);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (filterStatus !== "all" && j.status !== filterStatus) return false;
      if (filterMarket.trim() === "") return true;
      const n = Number(filterMarket);
      if (!Number.isFinite(n)) return true;
      return j.market_id === n;
    });
  }, [jobs, filterMarket, filterStatus]);

  const toggleExpand = (jobId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const statusOptions = ["all", "pending", "running", "done", "failed"] as const;

  return (
    <div className="mx-auto max-w-4xl">
      <div
        className="mb-8 border-2 border-neutral-950 bg-[#fffef8] p-5"
        style={{ boxShadow: "6px 6px 0 0 #0a0a0a" }}
      >
        <h1 className="text-2xl font-black text-neutral-950 sm:text-3xl">Oracle jobs</h1>
        <p className="mt-1 text-sm font-medium text-neutral-600">
          Queue from the API — auto-refresh every {POLL_MS / 1000}s when this tab is visible. Use
          filters to narrow by market or status.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="nb-label" htmlFor="mfilter">
              Market ID
            </label>
            <input
              id="mfilter"
              type="number"
              min={0}
              step={1}
              placeholder="Any"
              value={filterMarket}
              onChange={(e) => setFilterMarket(e.target.value)}
              className="nb-input max-w-[140px] font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="self-end text-[10px] font-bold uppercase tracking-wide text-neutral-500">
              Status
            </span>
            {statusOptions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={
                  filterStatus === s
                    ? "nb-btn !bg-neutral-950 !text-amber-300 !py-1.5 text-xs"
                    : "nb-btn-outline border-2 border-neutral-950 bg-white py-1.5 text-xs"
                }
                style={
                  filterStatus === s ? { boxShadow: "3px 3px 0 0 #0a0a0a" } : undefined
                }
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              void loadJobs();
            }}
            className="nb-btn-outline ml-auto self-end border-2 border-neutral-950 px-3 py-2 text-xs font-bold"
          >
            Refresh now
          </button>
        </div>
        {marketIds.length > 0 && filterMarket.trim() === "" && (
          <p className="mt-3 text-xs font-medium text-neutral-500">
            Markets in queue:{" "}
            {marketIds.map((mid) => (
              <button
                key={mid}
                type="button"
                className="mr-2 font-mono font-bold text-neutral-800 underline decoration-2 underline-offset-2"
                onClick={() => setFilterMarket(String(mid))}
              >
                #{mid}
              </button>
            ))}
          </p>
        )}
      </div>

      {loadErr && (
        <div
          className="mb-6 border-2 border-neutral-950 bg-rose-100 px-4 py-3 text-sm font-bold text-rose-950"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          {loadErr}
        </div>
      )}

      {loading && <p className="py-20 text-center font-bold text-neutral-500">Loading…</p>}

      {!loading && jobs.length === 0 && !loadErr && (
        <div
          className="border-2 border-dashed border-neutral-950 bg-white py-20 text-center"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          <p className="mb-2 text-2xl" aria-hidden>
            ◇
          </p>
          <p className="font-bold text-neutral-800">No jobs yet. Trigger from a market.</p>
        </div>
      )}

      {!loading && filteredJobs.length === 0 && jobs.length > 0 && (
        <div
          className="border-2 border-neutral-950 bg-neutral-100 py-10 text-center font-bold text-neutral-700"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          No jobs match filters.
        </div>
      )}

      {filteredJobs.length > 0 && (
        <ul className="space-y-3">
          {filteredJobs.map((job) => {
            const st = STATUS_STYLES[job.status] ?? {
              bg: "bg-white",
              border: "border-neutral-950",
              text: "text-neutral-900",
            };
            const expanded = expandedIds.has(job.id);

            return (
              <li
                key={job.id}
                className="overflow-hidden border-2 border-neutral-950 bg-white"
                style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
              >
                <div className="flex items-stretch">
                  <button
                    type="button"
                    className="shrink-0 border-r-2 border-neutral-950 bg-neutral-100 px-2 text-sm font-bold text-neutral-700 hover:bg-neutral-200 sm:px-3"
                    onClick={() => toggleExpand(job.id)}
                    aria-expanded={expanded}
                    aria-label={expanded ? "Hide job details" : "Show job details"}
                  >
                    <span aria-hidden>{expanded ? "−" : "+"}</span>
                  </button>
                  <div className="min-w-0 flex-1 p-3 sm:p-4">
                    <div className="flex gap-3">
                      <div className="shrink-0 pt-0.5 text-2xl leading-none">
                        {JOB_ICONS[job.job_type] ?? "▪"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold">#{job.id}</span>
                          <Link
                            href={`/market/${job.market_id}`}
                            className="text-xs font-black text-neutral-950 underline decoration-2 underline-offset-2"
                          >
                            Market {job.market_id} →
                          </Link>
                          <span
                            className={`ml-auto border-2 px-2 py-0.5 text-[10px] font-black uppercase ${st.bg} ${st.border} ${st.text}`}
                            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                          >
                            {job.status}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-neutral-600">
                          <span className="font-bold text-neutral-900">{job.job_type}</span>
                          {job.result !== null && (
                            <span className="ml-2 font-black text-neutral-950">
                              → {job.result ? "YES" : "NO"}
                            </span>
                          )}
                          {job.confidence != null && (
                            <span className="ml-2 font-mono">{job.confidence}%</span>
                          )}
                          <span className="ml-2 text-neutral-400">
                            {new Date(job.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {expanded && (
                  <div
                    className="border-t-2 border-neutral-950 bg-neutral-50 px-4 py-3"
                    style={{ boxShadow: "inset 0 2px 0 0 rgba(10,10,10,0.06)" }}
                  >
                    <dl className="grid gap-2 text-xs font-mono text-neutral-800 sm:grid-cols-2">
                      <div>
                        <dt className="text-[10px] font-bold uppercase text-neutral-500">Created</dt>
                        <dd>{new Date(job.created_at).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase text-neutral-500">Completed</dt>
                        <dd>
                          {job.completed_at
                            ? new Date(job.completed_at).toLocaleString()
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    {job.raw_output && (
                      <pre className="mt-3 max-h-56 overflow-auto border-2 border-neutral-950 bg-white p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-neutral-700">
                        {job.raw_output}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
