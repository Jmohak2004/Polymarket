"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { api, SourceCandidate, DiscoverResponse, Market } from "@/lib/api";
import { getExpectedChainId } from "@/lib/chainEnv";
import { shortError } from "@/lib/errors";
import { getPredictionMarketAddress, predictionMarketAbi } from "@/lib/predictionMarket";
import { MARKET_TYPES } from "@/lib/wagmi";
import { pickWalletConnector } from "@/lib/walletConnect";

const EXAMPLE_QUESTIONS: Record<number, string> = {
  0: "Will PM use the word 'AI' in their speech on April 25?",
  1: "Will Elon Musk wear a hoodie at the Tesla keynote?",
  2: "Will Mumbai receive >10mm rainfall tomorrow?",
  3: "Will $TSLA stock fall more than 5% after Q1 earnings?",
  4: "Will the next Fed meeting announce a rate cut?",
};

const typeBtn = (on: boolean) =>
  on
    ? "border-2 border-neutral-950 bg-amber-300 font-bold text-neutral-950"
    : "border-2 border-neutral-950 bg-white font-bold text-neutral-800 hover:bg-neutral-50";

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const expectedChainId = getExpectedChainId();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const publicClient = usePublicClient();
  const { writeContractAsync, reset: resetDeployWrite } = useWriteContract();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const [form, setForm] = useState({
    question: "",
    market_type: 0,
    data_source: "",
    resolution_time: "",
    search_hints: "",
  });
  const [autoDiscover, setAutoDiscover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "api" | "deploy" | "link">("idle");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMarketFallbackId, setSavedMarketFallbackId] = useState<number | null>(null);
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);

  const chainMismatch =
    address != null && expectedChainId != null && chainId !== expectedChainId;

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

  const deployAndLink = async (market: Market, wallet: `0x${string}`) => {
    const contractAddr = getPredictionMarketAddress();
    if (!contractAddr) {
      router.push(`/market/${market.id}`);
      return;
    }
    if (!publicClient) {
      setSavedMarketFallbackId(market.id);
      setError("No RPC client. Reconnect your wallet.");
      return;
    }
    if (expectedChainId != null && chainMismatch) {
      setSavedMarketFallbackId(market.id);
      setError(
        `Switch wallet to chain ID ${expectedChainId}, then reopen this page or retry from the listing.`,
      );
      return;
    }

    setPhase("deploy");
    resetDeployWrite();

    const resSec = BigInt(Math.floor(Date.parse(market.resolution_time) / 1000));

    let hash: `0x${string}`;
    try {
      hash = (await writeContractAsync({
        address: contractAddr,
        abi: predictionMarketAbi,
        functionName: "createMarket",
        args: [
          market.question,
          market.market_type,
          market.data_source.trim(),
          resSec,
        ],
        value: parseEther("0.001"),
      })) as `0x${string}`;
    } catch (err: unknown) {
      setSavedMarketFallbackId(market.id);
      setPhase("idle");
      setError(shortError(err));
      return;
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      setSavedMarketFallbackId(market.id);
      setPhase("idle");
      setError("createMarket mined with reverted status.");
      return;
    }

    const nextRaw = await publicClient.readContract({
      address: contractAddr,
      abi: predictionMarketAbi,
      functionName: "totalMarkets",
    });
    const next = Number(nextRaw as bigint);
    const chainMarketId = next > 0 ? next - 1 : -1;
    if (chainMarketId < 0) {
      setSavedMarketFallbackId(market.id);
      setPhase("idle");
      setError("Could not read new market ID from chain.");
      return;
    }

    setPhase("link");
    try {
      await api.markets.chainSync(market.id, {
        chain_market_id: chainMarketId,
        tx_hash: hash,
        creator_address: wallet,
      });
    } catch (err: unknown) {
      setSavedMarketFallbackId(market.id);
      setPhase("idle");
      setError(
        `Deployed on-chain (id ${chainMarketId}) but failed to sync the app DB: ${shortError(err)}`,
      );
      return;
    }

    setPhase("idle");
    router.push(`/market/${market.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMarketFallbackId(null);
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
      setError("Paste a URL, use Find sources, or enable auto-pick.");
      return;
    }

    setLoading(true);
    setError(null);
    setPhase("idle");

    let created: Market | null = null;
    try {
      setPhase("api");
      created = await api.markets.create({
        question: form.question,
        market_type: form.market_type,
        data_source: form.data_source.trim() || undefined,
        creator_address: address,
        resolution_time: new Date(form.resolution_time).toISOString(),
        auto_discover: autoDiscover,
        search_hints: form.search_hints.trim() || undefined,
      });

      const contractAddr = getPredictionMarketAddress();
      if (!contractAddr) {
        setPhase("idle");
        router.push(`/market/${created.id}`);
        return;
      }

      await deployAndLink(created, address);
    } catch (err: unknown) {
      if (created) {
        setSavedMarketFallbackId(created.id);
        setError(`Market #${created.id} was saved, but a later step failed: ${shortError(err)}`);
      } else {
        setError(shortError(err));
      }
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  };

  const submitLabel = () => {
    if (isConnecting) return "Wallet…";
    if (!isConnected) return "Connect wallet";
    if (!loading) return "Create market";
    if (phase === "api") return "Saving listing…";
    if (phase === "deploy") return "Deploy on-chain…";
    if (phase === "link") return "Linking…";
    return "Creating…";
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div
        className="mb-8 border-2 border-neutral-950 bg-[#fffef8] p-5 sm:p-6"
        style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
      >
        <h1 className="text-2xl font-black text-neutral-950 sm:text-3xl">New market</h1>
        <p className="mt-2 text-sm font-medium text-neutral-600">
          One clear yes/no question. Add evidence with a link or run a web search. With a deployed
          contract in env you also register the market on-chain (0.001 Ξ creation fee).
        </p>
      </div>

      {expectedChainId != null && isConnected && address && chainMismatch && (
        <div
          className="mb-6 border-2 border-red-950 bg-rose-100 p-4"
          style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
        >
          <p className="mb-2 text-sm font-bold text-red-950">
            Wallet is on chain {chainId}; this app expects {expectedChainId}.
          </p>
          <button
            type="button"
            disabled={isSwitchingChain}
            className="nb-btn w-full !py-2.5 text-sm"
            onClick={() => switchChain?.({ chainId: expectedChainId })}
          >
            {isSwitchingChain ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <span className="nb-label">Type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                className={`flex min-h-[3rem] items-center justify-center gap-2 px-2 py-2 text-left text-sm transition ${typeBtn(
                  form.market_type === t.value
                )}`}
                style={{ boxShadow: form.market_type === t.value ? "3px 3px 0 0 #0a0a0a" : "2px 2px 0 0 #0a0a0a" }}
              >
                <span className="shrink-0">{t.icon}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="nb-label" htmlFor="q">
            Question <span className="text-red-800">*</span>
          </label>
          <textarea
            id="q"
            required
            rows={3}
            value={form.question}
            onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
            placeholder="Will the PM say the word 'AI' in the April 25 speech?"
            className="nb-input min-h-[5rem] resize-y"
          />
        </div>

        <div>
          <label className="nb-label" htmlFor="hints">
            Search hints <span className="font-normal normal-case text-neutral-500">(optional)</span>
          </label>
          <input
            id="hints"
            type="text"
            value={form.search_hints}
            onChange={(e) => setForm((f) => ({ ...f, search_hints: e.target.value }))}
            placeholder="e.g. BBC, YouTube live, 25 April 2026"
            className="nb-input"
          />
        </div>

        <div
          className="space-y-3 border-2 border-neutral-950 bg-white p-4"
          style={{ boxShadow: "4px 4px 0 0 #0a0a0a" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={findSources}
              disabled={searching || loading}
              className="nb-btn shrink-0 !py-2 text-sm disabled:opacity-50"
            >
              {searching ? "…" : "Find web sources"}
            </button>
            <p className="text-xs font-medium text-neutral-600">
              Searches the open web. Add <code className="font-mono">TAVILY_API_KEY</code> in backend for
              production.
            </p>
          </div>
          {discover && (
            <div>
              <p className="mb-2 break-all font-mono text-[10px] font-medium text-neutral-500">
                Query: {discover.search_query}
              </p>
              <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {discover.sources.map((s) => (
                  <li key={s.url}>
                    <button
                      type="button"
                      onClick={() => selectSource(s)}
                      className={`w-full border-2 p-3 text-left text-sm ${
                        selectedUrl === s.url
                          ? "border-neutral-950 bg-amber-200"
                          : "border-neutral-950 bg-neutral-50 hover:bg-amber-50"
                      }`}
                      style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                    >
                      <div className="font-bold text-neutral-950 line-clamp-2">{s.title || s.url}</div>
                      <div className="mt-0.5 break-all font-mono text-[10px] text-neutral-500">{s.url}</div>
                      {s.snippet && <div className="mt-1 line-clamp-2 text-xs text-neutral-600">{s.snippet}</div>}
                      <div className="mt-1 text-[10px] font-bold uppercase text-neutral-400">{s.provider}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <label className="nb-label" htmlFor="ds">
            Evidence URL {!autoDiscover && <span className="text-red-800">*</span>}
          </label>
          <input
            id="ds"
            type="url"
            required={!autoDiscover}
            value={form.data_source}
            onChange={(e) => {
              setForm((f) => ({ ...f, data_source: e.target.value }));
              setSelectedUrl(null);
            }}
            disabled={autoDiscover}
            placeholder="https://…"
            className="nb-input font-mono text-xs disabled:opacity-50"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 border-2 border-neutral-950 bg-neutral-100 p-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 border-2 border-neutral-950 accent-neutral-950"
            checked={autoDiscover}
            onChange={(e) => {
              setAutoDiscover(e.target.checked);
              if (e.target.checked) {
                setForm((f) => ({ ...f, data_source: "" }));
                setSelectedUrl(null);
              }
            }}
          />
          <span className="text-sm font-bold text-neutral-900">
            Auto-pick best search result on the server
          </span>
        </label>

        <div>
          <label className="nb-label" htmlFor="res">
            Resolution time <span className="text-red-800">*</span>
          </label>
          <input
            id="res"
            required
            type="datetime-local"
            value={form.resolution_time}
            onChange={(e) => setForm((f) => ({ ...f, resolution_time: e.target.value }))}
            min={new Date().toISOString().slice(0, 16)}
            className="nb-input"
          />
        </div>

        {error && (
          <div
            className="space-y-2 border-2 border-neutral-950 bg-rose-100 p-3 text-sm font-medium text-red-900"
            style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
          >
            <p>{error}</p>
            {savedMarketFallbackId != null && (
              <Link
                href={`/market/${savedMarketFallbackId}`}
                className="inline-block font-black underline decoration-2 underline-offset-4"
              >
                Open saved listing →
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || isConnecting}
          className="nb-btn w-full !py-3 text-base disabled:opacity-50"
        >
          {submitLabel()}
        </button>
      </form>
    </div>
  );
}
