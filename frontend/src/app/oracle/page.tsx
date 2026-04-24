"use client";

import { useEffect, useState } from "react";
import { api, OracleJob } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  running: "text-blue-400 bg-blue-400/10",
  done: "text-green-400 bg-green-400/10",
  failed: "text-red-400 bg-red-400/10",
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Oracle Jobs</h1>
        <p className="text-gray-400">
          Live AI oracle resolution pipeline status. Refreshes every 5s.
        </p>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-500">Loading jobs…</div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">🤖</p>
          <p>No oracle jobs yet. Trigger one from a market page.</p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start gap-4"
            >
              <div className="text-2xl">{JOB_ICONS[job.job_type] ?? "⚡"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-sm">Job #{job.id}</span>
                  <span className="text-xs text-gray-500">
                    Market #{job.market_id}
                  </span>
                  <span
                    className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[job.status] ?? "text-gray-400"
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Type: {job.job_type}</span>
                  {job.result !== null && (
                    <span
                      className={
                        job.result ? "text-green-400" : "text-red-400"
                      }
                    >
                      Outcome: {job.result ? "YES" : "NO"}
                    </span>
                  )}
                  {job.confidence !== null && (
                    <span>Confidence: {job.confidence}%</span>
                  )}
                  <span>
                    {new Date(job.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {job.raw_output && (
                  <pre className="mt-2 text-xs text-gray-500 bg-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap line-clamp-3">
                    {job.raw_output}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
