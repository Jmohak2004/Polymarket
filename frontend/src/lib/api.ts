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

export interface MarketSummary {
  total: number;
  by_status: Record<string, number>;
}

export interface PagedMarkets {
  items: Market[];
  total: number;
  limit: number;
  offset: number;
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

export interface SourceCandidate {
  url: string;
  title: string;
  snippet: string;
  provider: string;
}

export interface DiscoverResponse {
  search_query: string;
  sources: SourceCandidate[];
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const raw = await res.text();
    let message = raw;
    try {
      const j = JSON.parse(raw) as {
        detail?: string | Array<{ msg?: string }>;
      };
      if (typeof j.detail === "string") {
        message = j.detail;
      } else if (Array.isArray(j.detail)) {
        message = j.detail.map((d) => d.msg).filter(Boolean).join("; ") || message;
      }
    } catch {
      /* use raw text */
    }
    throw new Error((message || `${res.status} ${res.statusText}`).slice(0, 800));
  }
  return res.json() as Promise<T>;
}

export const api = {
  markets: {
    summary: () => fetchJson<MarketSummary>("/markets/summary"),
    list: (status?: number, opts?: { limit?: number; offset?: number }) => {
      const limit = opts?.limit ?? 40;
      const offset = opts?.offset ?? 0;
      const q = new URLSearchParams();
      q.set("limit", String(limit));
      q.set("offset", String(offset));
      if (status !== undefined) q.set("status_filter", String(status));
      return fetchJson<PagedMarkets>(`/markets/?${q.toString()}`);
    },
    get: (id: number) => fetchJson<Market>(`/markets/${id}`),
    create: (body: {
      question: string;
      market_type: number;
      data_source?: string;
      resolution_time: string;
      creator_address: string;
      auto_discover?: boolean;
      search_hints?: string;
    }) => fetchJson<Market>("/markets/", { method: "POST", body: JSON.stringify(body) }),
    chainSync: (
      id: number,
      body: {
        chain_market_id: number;
        tx_hash?: string | null;
        creator_address: string;
      },
    ) =>
      fetchJson<Market>(`/markets/${id}/chain-sync`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  sources: {
    discover: (body: {
      question: string;
      market_type: number;
      search_hints?: string;
      max_results?: number;
    }) =>
      fetchJson<DiscoverResponse>("/sources/discover", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    preview: (url: string) => {
      const q = new URLSearchParams({ url });
      return fetchJson<{ url: string; title: string | null; text: string; warning: string | null }>(
        `/sources/preview?${q.toString()}`
      );
    },
  },
  oracle: {
    trigger: (marketId: number) =>
      fetchJson<OracleJob>(`/oracle/trigger/${marketId}`, { method: "POST" }),
    jobs: () => fetchJson<OracleJob[]>("/oracle/jobs"),
  },
};
