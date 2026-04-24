"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { api, SourceCandidate, DiscoverResponse } from "@/lib/api";
import { MARKET_TYPES } from "@/lib/wagmi";
import { pickWalletConnector } from "@/lib/walletConnect";

const EXAMPLE_QUESTIONS: Record<number, string> = {
  0: "Will PM use the word 'AI' in their speech on April 25?",
  1: "Will Elon Musk wear a hoodie at the Tesla keynote?",
  2: "Will Mumbai receive >10mm rainfall tomorrow?",
  3: "Will $TSLA stock fall more than 5% after Q1 earnings?",
  4: "Will the next Fed meeting announce a rate cut?",
};

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();

  const [form, setForm] = useState({
    question: "",
    market_type: 0,
    data_source: "",
    resolution_time: "",
    search_hints: "",
  });
  const [autoDiscover, setAutoDiscover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const findSources = async () => {
    if (!form.question.trim()) {
      setError("Add a question first so we can search the web for evidence.");
      return;
    }
    setSearching(true);
    setError(null);
    setDiscover(null);
    setSelectedUrl(null);
    try {
      const res = await api.sources.discover({
        question: form.question,
        market_type: form.market_type,
        search_hints: form.search_hints || undefined,
        max_results: 8,
      });
      setDiscover(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const selectSource = (s: SourceCandidate) => {
    setForm((f) => ({ ...f, data_source: s.url }));
    setSelectedUrl(s.url);
    setAutoDiscover(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      const connector = pickWalletConnector(connectors);
      if (!connector) {
        setError("No wallet found. Install MetaMask or another Web3 wallet.");
        return;
      }
      try {
        await connectAsync({ connector });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    if (!autoDiscover && !form.data_source.trim()) {
      setError("Paste a data source URL, run “Find web sources” and pick one, or enable auto-pick.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const market = await api.markets.create({
        question: form.question,
        market_type: form.market_type,
        data_source: form.data_source.trim() || undefined,
        creator_address: address,
        resolution_time: new Date(form.resolution_time).toISOString(),
        auto_discover: autoDiscover,
        search_hints: form.search_hints.trim() || undefined,
      });
      router.push(`/market/${market.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create Market</h1>
        <p className="text-gray-400">
          Define a yes/no question. The backend can <strong>search the web</strong> to find
          a news article, live stream, or transcript page to use as the evidence URL.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Market Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MARKET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    market_type: t.value,
                    question: EXAMPLE_QUESTIONS[t.value] || "",
                  }));
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  form.market_type === t.value
                    ? "border-purple-500 bg-purple-500/10 text-purple-300"
                    : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Question <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            placeholder="e.g. Will PM use the word 'AI' in their speech on April 25?"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Search hints <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={form.search_hints}
            onChange={(e) => setForm((f) => ({ ...f, search_hints: e.target.value }))}
            placeholder="e.g. YouTube live PM speech April 25 2026, BBC, PMO India"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Helps the web search: names, event titles, news outlet, or platform.
          </p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={findSources}
              disabled={searching}
              className="px-4 py-2.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-600/30 disabled:opacity-50"
            >
              {searching ? "Searching…" : "Find web sources"}
            </button>
            <p className="text-xs text-gray-500 flex-1">
              Uses your backend search (Tavily, Brave, Google CSE, or DuckDuckGo fallback). Configure{" "}
              <code className="bg-gray-800 px-1 rounded">TAVILY_API_KEY</code> in production.
            </p>
          </div>
          {discover && (
            <div>
              <p className="text-xs text-gray-500 mb-2 break-all">
                Query: <span className="text-gray-300">{discover.search_query}</span>
              </p>
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {discover.sources.map((s) => (
                  <li key={s.url}>
                    <button
                      type="button"
                      onClick={() => selectSource(s)}
                      className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                        selectedUrl === s.url
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-gray-700 bg-gray-800/80 hover:border-gray-500"
                      }`}
                    >
                      <div className="font-medium text-gray-200 line-clamp-2">{s.title || s.url}</div>
                      <div className="text-xs text-gray-500 mt-0.5 break-all">{s.url}</div>
                      {s.snippet && (
                        <div className="text-xs text-gray-400 mt-1 line-clamp-2">{s.snippet}</div>
                      )}
                      <div className="text-[10px] text-gray-600 mt-1">via {s.provider}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Data source / evidence URL{" "}
            {!autoDiscover && <span className="text-red-400">*</span>}
            {autoDiscover && <span className="text-gray-500 font-normal">(optional if auto-pick)</span>}
          </label>
          <input
            type="text"
            required={!autoDiscover}
            value={form.data_source}
            onChange={(e) => {
              setForm((f) => ({ ...f, data_source: e.target.value }));
              setSelectedUrl(null);
            }}
            disabled={autoDiscover}
            placeholder="https://... YouTube, news, IPFS, or image URL"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-600"
            checked={autoDiscover}
            onChange={(e) => {
              setAutoDiscover(e.target.checked);
              if (e.target.checked) {
                setForm((f) => ({ ...f, data_source: "" }));
                setSelectedUrl(null);
              }
            }}
          />
          <div>
            <span className="text-sm text-gray-200 group-hover:text-white">
              Auto-pick the best search result on create
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              If checked, the server runs the same web search and sets{" "}
              <code className="bg-gray-800 px-1 rounded">data_source</code> to the top result.
              You can still use “Find web sources” first to preview.
            </p>
          </div>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Resolution time <span className="text-red-400">*</span>
          </label>
          <input
            required
            type="datetime-local"
            value={form.resolution_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, resolution_time: e.target.value }))
            }
            min={new Date().toISOString().slice(0, 16)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isConnecting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting
            ? "Connecting wallet…"
            : loading
            ? "Creating…"
            : isConnected
            ? "Create market"
            : "Connect wallet to create"}
        </button>
      </form>
    </div>
  );
}
