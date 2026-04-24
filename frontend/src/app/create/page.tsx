"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { injected } from "wagmi/connectors";
import { useConnect } from "wagmi";
import { api } from "@/lib/api";
import { MARKET_TYPES } from "@/lib/wagmi";

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
  const { connect } = useConnect();

  const [form, setForm] = useState({
    question: "",
    market_type: 0,
    data_source: "",
    resolution_time: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      connect({ connector: injected() });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const market = await api.markets.create({
        ...form,
        creator_address: address,
        resolution_time: new Date(form.resolution_time).toISOString(),
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
          Define a yes/no question with a verifiable outcome. The AI oracle
          network will resolve it automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Market Type */}
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

        {/* Question */}
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
          <p className="text-xs text-gray-500 mt-1">
            Keep it specific and unambiguous for clean AI resolution.
          </p>
        </div>

        {/* Data Source */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Data Source / Evidence URL <span className="text-red-400">*</span>
          </label>
          <input
            required
            type="text"
            value={form.data_source}
            onChange={(e) => setForm((f) => ({ ...f, data_source: e.target.value }))}
            placeholder="https://... or ipfs://... (audio, image, news URL)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            URL the AI oracle will fetch to verify the outcome.
          </p>
        </div>

        {/* Resolution Time */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Resolution Time <span className="text-red-400">*</span>
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
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? "Creating…"
            : isConnected
            ? "Create Market"
            : "Connect Wallet to Create"}
        </button>
      </form>
    </div>
  );
}
