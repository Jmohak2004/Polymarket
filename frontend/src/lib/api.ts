const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Market {
  id: number;
  chain_market_id: number | null;
  question: string;
  market_type: number;
  data_source: string;
  resolution_time: string;
  created_at: string;
  creator_address: string | null;
  yes_pool: number;
  no_pool: number;
  status: number;
  outcome: boolean | null;
  oracle_confidence: number | null;
  tx_hash: string | null;
}

export interface OracleJob {
  id: number;
  market_id: number;
  job_type: string;
  status: string;
  result: boolean | null;
  confidence: number | null;
  raw_output: string | null;
  created_at: string;
  completed_at: string | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json() as Promise<T>;
}

export const api = {
  markets: {
    list: (status?: number) =>
      fetchJson<Market[]>(status !== undefined ? `/markets/?status_filter=${status}` : "/markets/"),
    get: (id: number) => fetchJson<Market>(`/markets/${id}`),
    create: (body: {
      question: string;
      market_type: number;
      data_source: string;
      resolution_time: string;
      creator_address: string;
    }) => fetchJson<Market>("/markets/", { method: "POST", body: JSON.stringify(body) }),
  },
  oracle: {
    trigger: (marketId: number) =>
      fetchJson<OracleJob>(`/oracle/trigger/${marketId}`, { method: "POST" }),
    jobs: () => fetchJson<OracleJob[]>("/oracle/jobs"),
  },
};
