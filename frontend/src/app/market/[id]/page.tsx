"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useReadContract,
  useSimulateContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { api, Market } from "@/lib/api";
import { getExpectedChainId } from "@/lib/chainEnv";
import { shortError } from "@/lib/errors";
import { TxHashLink } from "@/components/TxHashLink";
import {
  predictionMarketAbi,
  getPredictionMarketAddress,
} from "@/lib/predictionMarket";
import { MARKET_TYPES, MARKET_STATUS } from "@/lib/wagmi";

/** Contract `MIN_BET` is 0.001 ether */
const MIN_BET_WEI = parseEther("0.001");

/** Solidity `MarketStatus` on-chain — match `PredictionMarket.Market.status` uint8 decode */
const ONCHAIN_RESOLVED = 2;

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
  const chainId = useChainId();
  const expectedChainId = getExpectedChainId();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [betSide, setBetSide] = useState<"yes" | "no">("yes");
  const [betAmount, setBetAmount] = useState("0.01");
  const [triggering, setTriggering] = useState(false);
  const [oracleMsg, setOracleMsg] = useState<string | null>(null);

  const [betTxHash, setBetTxHash] = useState<`0x${string}` | undefined>();
  const [betPrepError, setBetPrepError] = useState<string | null>(null);

  const [resolveTxHash, setResolveTxHash] = useState<`0x${string}` | undefined>();
  const [resolvePrepError, setResolvePrepError] = useState<string | null>(null);

  const {
    writeContractAsync: writeBetAsync,
    reset: resetBetWrite,
    error: wagmiBetErr,
    isPending: isBetPending,
  } = useWriteContract();
  const {
    writeContractAsync: writeResolveAsync,
    reset: resetResolveWrite,
    error: wagmiResolveErr,
    isPending: isResolvePending,
  } = useWriteContract();

  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();
  const {
    data: receipt,
    error: receiptErr,
    isFetching: isFetchingBetReceipt,
  } = useWaitForTransactionReceipt({ hash: betTxHash ?? undefined });
  const {
    data: resolveReceipt,
    error: resolveReceiptErr,
    isFetching: isFetchingResolveReceipt,
  } = useWaitForTransactionReceipt({ hash: resolveTxHash ?? undefined });

  const contractAddr = useMemo(() => getPredictionMarketAddress(), []);
  const chainMismatch =
    address != null && expectedChainId != null && chainId !== expectedChainId;

  const chainMarketDbId = market?.chain_market_id ?? null;
  const readsEnabled = Boolean(
    contractAddr &&
      address &&
      !chainMismatch &&
      chainMarketDbId !== null &&
      chainMarketDbId >= 0,
  );

  const { data: disputeBondWei } = useReadContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "DISPUTE_BOND",
    query: { enabled: !!contractAddr, refetchOnWindowFocus: false },
  });

  const { data: onChainMarket } = useReadContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "getMarket",
    args:
      readsEnabled && chainMarketDbId != null
        ? [BigInt(chainMarketDbId)]
        : undefined,
    query: {
      enabled:
        readsEnabled &&
        chainMarketDbId !== null &&
        /^0x[a-fA-F0-9]{40}$/.test(address ?? ""),
      refetchInterval: 15_000,
    },
  });

  const onResolvedOnChain =
    onChainMarket != null &&
    typeof onChainMarket === "object" &&
    "status" in onChainMarket &&
    Number((onChainMarket as { status: number }).status) === ONCHAIN_RESOLVED;

  const simBaseEnabled =
    readsEnabled &&
    onResolvedOnChain &&
    /^0x[a-fA-F0-9]{40}$/.test(address ?? "");

  const { data: simClaimData } = useSimulateContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "claimReward",
    args:
      simBaseEnabled && chainMarketDbId != null
        ? [BigInt(chainMarketDbId)]
        : undefined,
    account: address,
    query: {
      enabled: simBaseEnabled && chainMarketDbId !== null && !!contractAddr,
      refetchInterval: 15_000,
      retry: 0,
    },
  });

  const disputeValue =
    typeof disputeBondWei === "bigint" ? disputeBondWei : undefined;

  const { data: simDisputeData } = useSimulateContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "disputeMarket",
    args:
      simBaseEnabled && chainMarketDbId != null
        ? [BigInt(chainMarketDbId)]
        : undefined,
    value: disputeValue,
    account: address,
    query: {
      enabled:
        simBaseEnabled &&
        chainMarketDbId !== null &&
        !!contractAddr &&
        disputeValue !== undefined,
      refetchInterval: 15_000,
      retry: 0,
    },
  });

  const { data: payoutWei } = useReadContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "calculatePayout",
    args:
      readsEnabled &&
      /^0x[a-fA-F0-9]{40}$/.test(address ?? "") &&
      chainMarketDbId != null
        ? [BigInt(chainMarketDbId), address as `0x${string}`]
        : undefined,
    query: {
      enabled:
        readsEnabled &&
        !!address &&
        chainMarketDbId !== null &&
        onResolvedOnChain,
      refetchInterval: 15_000,
    },
  });

  const { data: hasClaimed } = useReadContract({
    address: contractAddr,
    abi: predictionMarketAbi,
    functionName: "hasClaimed",
    args:
      readsEnabled &&
      /^0x[a-fA-F0-9]{40}$/.test(address ?? "") &&
      chainMarketDbId != null
        ? [BigInt(chainMarketDbId), address as `0x${string}`]
        : undefined,
    query: {
      enabled:
        readsEnabled &&
        !!address &&
        chainMarketDbId !== null &&
        onResolvedOnChain,
      refetchInterval: 15_000,
    },
  });

  const canClaimViaSim = Boolean(simClaimData?.request);

  const canDisputeViaSim = Boolean(simDisputeData?.request);

  const refreshMarketFromApi = useCallback(() => {
    api.markets.get(Number(id)).then(setMarket).catch(() => setMarket(null));
  }, [id]);

  useEffect(() => {
    setBetPrepError(null);
    setResolvePrepError(null);
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
    if (!resolveTxHash || !resolveReceipt) return;
    if (resolveReceipt.status !== "success" && resolveReceipt.status !== "reverted")
      return;
    setResolvePrepError(null);
    if (resolveReceipt.status === "reverted") {
      setResolvePrepError("Settlement transaction reverted.");
      setResolveTxHash(undefined);
      return;
    }
    refreshMarketFromApi();
    setResolveTxHash(undefined);
  }, [resolveTxHash, resolveReceipt, refreshMarketFromApi]);

  useEffect(() => {
    if (receiptErr) setBetPrepError(shortError(receiptErr));
  }, [receiptErr]);

  useEffect(() => {
    if (resolveReceiptErr) setResolvePrepError(shortError(resolveReceiptErr));
  }, [resolveReceiptErr]);

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
        "Set NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS in .env.local to the deployed contract.",
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
        "This market has no chain_market_id — create on-chain first (Create flow syncs DB).",
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
      const hash = await writeBetAsync({
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

  const runClaim = async () => {
    setResolvePrepError(null);
    resetResolveWrite();
    if (!contractAddr || !simClaimData?.request || !address) return;
    if (resolveBusy) return;
    try {
      const hash = await writeResolveAsync(simClaimData.request);
      setResolveTxHash(hash as `0x${string}`);
    } catch (e: unknown) {
      setResolvePrepError(shortError(e));
    }
  };

  const runDispute = async () => {
    setResolvePrepError(null);
    resetResolveWrite();
    if (!contractAddr || !simDisputeData?.request || !address) return;
    if (resolveBusy) return;
    try {
      const hash = await writeResolveAsync(simDisputeData.request);
      setResolveTxHash(hash as `0x${string}`);
    } catch (e: unknown) {
      setResolvePrepError(shortError(e));
    }
  };

  if (loading) {
    return <p className="py-20 text-center font-bold text-neutral-500">Loading…</p>;
  }

  if (!market) {
    return <p className="py-20 text-center font-bold text-red-800">Market not found.</p>;
  }

  const totalPool = market.yes_pool + market.no_pool;
  const yesPercent =
    totalPool > 0 ? Math.round((market.yes_pool / totalPool) * 100) : 50;
  const marketType = MARKET_TYPES.find((t) => t.value === market.market_type);
  const isOpen = market.status === 0;

  const showBetWagmiErr =
    wagmiBetErr !== null && wagmiBetErr !== undefined && shortError(wagmiBetErr).length > 0;
  const resolveBusy =
    isResolvePending || Boolean(resolveTxHash && isFetchingResolveReceipt);
  const betBusy = isBetPending || Boolean(betTxHash && isFetchingBetReceipt);
  const showResolveWagmiErr =
    wagmiResolveErr !== null &&
    wagmiResolveErr !== undefined &&
    shortError(wagmiResolveErr).length > 0;

  const payoutLabel =
    typeof payoutWei === "bigint" ? `${formatEther(payoutWei)} Ξ est.` : "—";

  const bondLabel =
    typeof disputeBondWei === "bigint"
      ? `${formatEther(disputeBondWei)} Ξ bond`
      : "bond";

  const showSettlementPanel =
    Boolean(contractAddr) &&
    chainMarketDbId !== null &&
    !chainMismatch &&
    onResolvedOnChain;

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

        {market.tx_hash && (
          <div
            className="mt-3 border-2 border-neutral-950 bg-neutral-50 p-2 font-mono text-neutral-800"
            style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
          >
            <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
              Create / sync tx
            </div>
            <div className="mt-1">
              <TxHashLink
                hash={market.tx_hash as `0x${string}`}
                className="break-all text-[10px] font-medium sm:text-xs"
              />
            </div>
          </div>
        )}

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
            on-chain pool for this chain market ID; off-chain totals update after confirmations sync
            (see backend).
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
              No <span className="font-mono">chain_market_id</span> — bets disabled until synced.
            </div>
          )}

          {expectedChainId != null && address && chainMismatch && (
            <div
              className="mb-4 border-2 border-red-950 bg-rose-100 p-4"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              <p className="mb-2 text-sm font-bold text-red-950">
                Wallet chain ({chainId}) does not match{" "}
                <span className="font-mono">NEXT_PUBLIC_CHAIN_ID</span> ({expectedChainId}).
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
            placeBet( marketId={<span>{String(market.chain_market_id ?? "—")}</span>},{" "}
            {betSide.toUpperCase()} )
          </p>

          {(betPrepError || showBetWagmiErr) && (
            <div
              className="mb-4 border-2 border-red-950 bg-red-50 p-3 font-mono text-xs text-red-950"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              {betPrepError ?? (showBetWagmiErr ? shortError(wagmiBetErr) : "")}
            </div>
          )}

          {betBusy && (
            <p className="mb-4 border-2 border-neutral-950 bg-neutral-100 px-3 py-2 font-mono text-xs font-bold">
              <span className="block">
                {isBetPending ? "Approve in wallet…" : "Waiting for confirmation…"}
              </span>
              {betTxHash && (
                <span className="mt-2 block opacity-95">
                  <span className="opacity-75">Tx</span>{" "}
                  <TxHashLink hash={betTxHash} className="text-xs font-medium" />
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
              : !contractAddr || market.chain_market_id == null || !!chainMismatch
                ? "Cannot bet yet — see notes above"
                : isBetPending
                  ? "Approve in wallet…"
                  : betTxHash && isFetchingBetReceipt
                    ? "Confirming…"
                    : `Ξ ${betAmount} on ${betSide.toUpperCase()}`}
          </button>
        </div>
      )}

      {showSettlementPanel && (
        <div
          className="mb-6 border-2 border-neutral-950 bg-sky-50 p-5"
          style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
        >
          <h2 className="mb-2 text-sm font-black uppercase tracking-wide">
            Resolved on-chain · claim & dispute
          </h2>
          <p className="mb-4 text-xs font-medium leading-relaxed text-neutral-700">
            <span className="font-mono">claimReward</span> after the 24h dispute window;{" "}
            <span className="font-mono">disputeMarket</span> bonds {bondLabel}{" "}
            while the window is open. Buttons appear only when a dry-run succeeds for your wallet.
          </p>
          {!address && (
            <p className="mb-4 text-xs font-bold text-neutral-700">Connect wallet for actions.</p>
          )}
          {address && readsEnabled && (
            <div className="mb-4 grid gap-2 text-xs font-mono sm:grid-cols-2">
              <div className="border-2 border-neutral-950 bg-white p-3" style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}>
                Est. payout
                <div className="mt-1 text-sm font-black text-neutral-950">{payoutLabel}</div>
              </div>
              <div className="border-2 border-neutral-950 bg-white p-3" style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}>
                Claimed
                <div className="mt-1 text-sm font-black text-neutral-950">
                  {typeof hasClaimed === "boolean" ? (hasClaimed ? "Yes" : "No") : "—"}
                </div>
              </div>
            </div>
          )}

          {(resolvePrepError || showResolveWagmiErr) && (
            <div
              className="mb-4 border-2 border-red-950 bg-red-50 p-3 font-mono text-xs text-red-950"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              {resolvePrepError ??
                (showResolveWagmiErr ? shortError(wagmiResolveErr) : "")}
            </div>
          )}

          {resolveBusy && (
            <p className="mb-4 border-2 border-neutral-950 bg-neutral-100 px-3 py-2 font-mono text-xs font-bold">
              <span className="block">
                {isResolvePending ? "Approve in wallet…" : "Waiting for confirmation…"}
              </span>
              {resolveTxHash && (
                <span className="mt-2 block opacity-95">
                  <span className="opacity-75">Tx</span>{" "}
                  <TxHashLink hash={resolveTxHash} className="text-xs font-medium" />
                </span>
              )}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={runDispute}
              disabled={
                !address || !canDisputeViaSim || resolveBusy || betBusy
              }
              className="nb-btn-outline w-full !border-orange-950 !bg-orange-50 !py-2.5 text-sm font-black text-orange-950 disabled:opacity-50"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              {!canDisputeViaSim ? "Cannot dispute now" : `Dispute (${bondLabel})`}
            </button>
            <button
              type="button"
              onClick={runClaim}
              disabled={
                !address ||
                !canClaimViaSim ||
                resolveBusy ||
                betBusy ||
                Boolean(hasClaimed)
              }
              className="nb-btn w-full !border-neutral-950 !bg-emerald-200 !py-2.5 text-sm font-black disabled:opacity-50"
              style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
            >
              {!canClaimViaSim
                ? hasClaimed
                  ? "Already claimed"
                  : "Cannot claim yet"
                : `Claim (${payoutLabel})`}
            </button>
          </div>
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
