"use client";

import { useEffect, useState } from "react";
import { api, OracleJob } from "@/lib/api";

const STATUS_BG: Record<string, string> = {
  pending: "bg-amber-200",
  running: "bg-sky-200",
  done: "bg-emerald-200",
  failed: "bg-rose-200",
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

  useEffect(() => {
    api.oracle
      .jobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      api.oracle.jobs().then(setJobs).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <div
        className="mb-8 border-2 border-neutral-950 bg-[#fffef8] p-5"
        style={{ boxShadow: "6px 6px 0 0 #0a0a0a" }}
      >
        <h1 className="text-2xl font-black text-neutral-950 sm:text-3xl">Oracle jobs</h1>
        <p className="mt-1 text-sm font-medium text-neutral-600">
          Live queue. Refreshes every 5s.
        </p>
      </div>

      {loading && <p className="py-20 text-center font-bold text-neutral-500">Loading…</p>}

      {!loading && jobs.length === 0 && (
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

      {jobs.length > 0 && (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex border-2 border-neutral-950 bg-white p-4"
              style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
            >
              <div className="shrink-0 pr-3 text-2xl">{JOB_ICONS[job.job_type] ?? "▪"}</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">#{job.id}</span>
                  <span className="text-xs font-bold text-neutral-500">M{job.market_id}</span>
                  <span
                    className={`ml-auto border-2 border-neutral-950 px-2 py-0.5 text-[10px] font-black uppercase ${
                      STATUS_BG[job.status] ?? "bg-white"
                    }`}
                    style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="text-xs font-medium text-neutral-600">
                  {job.job_type}
                  {job.result !== null && (
                    <span className="ml-2 font-bold text-neutral-950">
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
                {job.raw_output && (
                  <pre className="mt-2 max-h-32 overflow-auto border-2 border-neutral-950 bg-neutral-100 p-2 font-mono text-[10px] leading-relaxed text-neutral-700">
                    {job.raw_output}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
