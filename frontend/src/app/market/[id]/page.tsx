"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { api, Market } from "@/lib/api";
import {
  predictionMarketAbi,
  getPredictionMarketAddress,
} from "@/lib/predictionMarket";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

/** Contract `MIN_BET` is 0.001 ether */
const MIN_BET_WEI = parseEther("0.001");

const STATUS_EMPH: Record<number, string> = {
  0: "text-emerald-800",
  1: "text-amber-800",
  2: "text-sky-800",
  3: "text-orange-800",
  4: "text-rose-800",
};

function shortError(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error";
  if (typeof err === "string") return err.slice(0, 480);
  if (err instanceof Error) {
    const any = err as Error & {
      shortMessage?: string;
      details?: string;
      cause?: unknown;
    };
    const line =
      typeof any.shortMessage === "string" && any.shortMessage.trim()
        ? any.shortMessage
        : any.message || String(any.cause ?? "");
    return line.slice(0, 480);
  }
  return String(err).slice(0, 480);
}

function parseEnvChainId(): number | undefined {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CHAIN_ID : undefined;
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const chainId = useChainId();
  const expectedChainId = parseEnvChainId();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [betSide, setBetSide] = useState<"yes" | "no">("yes");
  const [betAmount, setBetAmount] = useState("0.01");
  const [triggering, setTriggering] = useState(false);
  const [oracleMsg, setOracleMsg] = useState<string | null>(null);

  const [betTxHash, setBetTxHash] = useState<`0x${string}` | undefined>();
  const [betPrepError, setBetPrepError] = useState<string | null>(null);

  const {
    writeContractAsync,
    reset: resetBetWrite,
    error: wagmiWriteErr,
    isPending: isSigningBet,
  } = useWriteContract();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  const { data: receipt, error: receiptErr, isFetching: isFetchingReceipt } =
    useWaitForTransactionReceipt({ hash: betTxHash ?? undefined });

  const contractAddr = useMemo(() => getPredictionMarketAddress(), []);
  const chainMismatch =
    address != null && expectedChainId != null && chainId !== expectedChainId;

  const refreshMarketFromApi = useCallback(() => {
    api.markets.get(Number(id)).then(setMarket).catch(() => setMarket(null));
  }, [id]);

  useEffect(() => {
    setBetPrepError(null);
    setLoading(true);
    api.markets
      .get(Number(id))
      .then(setMarket)
      .catch(() => setMarket(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!betTxHash || !receipt) return;
    if (receipt.status !== "success" && receipt.status !== "reverted") return;
    setBetPrepError(null);
    if (receipt.status === "reverted") {
      setBetPrepError("Bet transaction reverted on-chain.");
      setBetTxHash(undefined);
      return;
    }
    refreshMarketFromApi();
    setBetTxHash(undefined);
  }, [betTxHash, receipt, refreshMarketFromApi]);

  useEffect(() => {
    if (receiptErr) {
      setBetPrepError(shortError(receiptErr));
    }
  }, [receiptErr]);

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

  const placeBetOnChain = async () => {
    setBetPrepError(null);
    resetBetWrite();

    if (!address) return;
    if (!contractAddr) {
      setBetPrepError(
        "Set NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS in .env.local to the deployed contract."
      );
      return;
    }
    if (chainMismatch && expectedChainId != null) {
      setBetPrepError(
        `Wrong network — switch wallet to chain ID ${expectedChainId}.`,
      );
      return;
    }
    if (market?.chain_market_id == null) {
      setBetPrepError(
        "This market has no chain ID yet — create it on-chain and sync DB (Tasks 5–6).",
      );
      return;
    }

    let value: bigint;
    try {
      value = parseEther(betAmount);
    } catch {
      setBetPrepError("Enter a valid ETH amount (e.g. 0.02).");
      return;
    }
    if (value < MIN_BET_WEI) {
      setBetPrepError(`Bet amount must be at least ${MIN_BET_WEI} wei (~0.001 ETH).`);
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: contractAddr,
        abi: predictionMarketAbi,
        functionName: "placeBet",
        args: [BigInt(market.chain_market_id), betSide === "yes"],
        value,
      });
      setBetTxHash(hash as `0x${string}`);
    } catch (e: unknown) {
      setBetPrepError(shortError(e));
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

  const showWagmiWrite = wagmiWriteErr && shortError(wagmiWriteErr).length > 0;
  const betBusy =
    isSigningBet ||
    Boolean(betTxHash && isFetchingReceipt);

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
          <p className="mb-4 text-xs font-medium leading-relaxed text-neutral-600">
            Sends <span className="font-mono">placeBet</span> with your ETH stake. Matches the
            on-chain pool for this chain market ID; off-chain totals update after confirmations
            sync (see backend).
          </p>

          {!contractAddr && (
            <div
              className="mb-4 border-2 border-amber-800 bg-amber-50 p-3 text-xs font-bold text-amber-950"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              Set <span className="font-mono">NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS</span>.
            </div>
          )}

          {market.chain_market_id == null && (
            <div
              className="mb-4 border-2 border-amber-800 bg-amber-50 p-3 text-xs font-bold text-amber-950"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              No <span className="font-mono">chain_market_id</span> on this listing — bets are
              disabled until the DB is linked after on-chain create.
            </div>
          )}

          {expectedChainId != null && address && chainMismatch && (
            <div
              className="mb-4 border-2 border-red-950 bg-rose-100 p-4"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              <p className="mb-2 text-sm font-bold text-red-950">
                Wallet chain ({chainId}) does not match <span className="font-mono">NEXT_PUBLIC_CHAIN_ID</span> ({expectedChainId}).
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
              disabled={
                !!(
                  chainMismatch ||
                  contractAddr === undefined ||
                  market.chain_market_id == null ||
                  !address
                )
              }
            />
          </div>
          <p className="mb-3 font-mono text-[11px] text-neutral-600">
            placeBet( marketId=<span>{String(market.chain_market_id ?? "—")}</span>,{" "}
            {betSide.toUpperCase()} )
          </p>

          {(betPrepError || showWagmiWrite) && (
            <div
              className="mb-4 border-2 border-red-950 bg-red-50 p-3 font-mono text-xs text-red-950"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              {betPrepError ??
                (showWagmiWrite ? shortError(wagmiWriteErr) : "")}
            </div>
          )}

          {betBusy && (
            <p className="mb-4 border-2 border-neutral-950 bg-neutral-100 px-3 py-2 font-mono text-xs font-bold">
              <span className="block">{isSigningBet ? "Approve in wallet…" : "Waiting for confirmation…"}</span>
              {betTxHash && (
                <span className="mt-2 block opacity-95">
                  <span className="opacity-75">Tx</span>
                  {" "}
                  <span className="break-all font-medium">{betTxHash}</span>
                </span>
              )}
            </p>
          )}

          <button
            type="button"
            onClick={placeBetOnChain}
            disabled={
              !address ||
              !contractAddr ||
              market.chain_market_id == null ||
              !!chainMismatch ||
              betBusy
            }
            className="nb-btn w-full !py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!address
              ? "Connect wallet"
              : !contractAddr ||
                  market.chain_market_id == null ||
                  !!chainMismatch
                ? "Cannot bet yet — see notes above"
                : isSigningBet
                  ? "Approve in wallet…"
                  : betTxHash && isFetchingReceipt
                    ? "Confirming…"
                    : `Ξ ${betAmount} on ${betSide.toUpperCase()}`}
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
