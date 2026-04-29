"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useChains,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { getExpectedChainId } from "@/lib/chainEnv";
import { pickWalletConnector } from "@/lib/walletConnect";

const navLink =
  "text-sm font-bold text-neutral-800 underline decoration-2 decoration-transparent underline-offset-4 transition hover:decoration-neutral-950";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const expectedChainId = getExpectedChainId();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [connectErr, setConnectErr] = useState<string | null>(null);

  const activeChain = chains.find((c) => c.id === chainId);
  const activeChainLabel = activeChain?.name ?? `Chain ${chainId}`;

  const expectedChain =
    expectedChainId != null ? chains.find((c) => c.id === expectedChainId) : undefined;
  const expectedLabel =
    expectedChainId != null
      ? expectedChain?.name ?? `Chain ${expectedChainId}`
      : null;

  const wrongNetwork = Boolean(
    isConnected && expectedChainId != null && chainId !== expectedChainId,
  );

  const handleConnect = async () => {
    setConnectErr(null);
    const connector = pickWalletConnector(connectors);
    if (!connector) {
      setConnectErr("No wallet found. Install MetaMask or another Web3 wallet.");
      return;
    }
    try {
      await connectAsync({ connector });
    } catch (e) {
      setConnectErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b-2 border-neutral-950 bg-[#fffef8]">
      {wrongNetwork && expectedChainId != null && (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col gap-3 border-b-2 border-rose-900 bg-rose-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <p className="text-sm font-bold text-rose-950">
            Wrong network — you&apos;re on <span className="font-mono">{activeChainLabel}</span>.
            Switch to{" "}
            <span className="font-mono">{expectedLabel}</span>
            {" "}(IDs {chainId} → {expectedChainId}) so contract calls succeed.
          </p>
          <button
            type="button"
            disabled={isSwitching}
            onClick={() => switchChain?.({ chainId: expectedChainId })}
            className="nb-btn shrink-0 px-5 py-2 text-sm whitespace-nowrap"
          >
            {isSwitching ? "Switching…" : "Switch network"}
          </button>
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-baseline gap-2 font-black tracking-tight text-neutral-950"
          >
            <span className="text-xl leading-none" aria-hidden>
              ◆
            </span>
            <span className="text-lg uppercase sm:text-xl">PolyOracle</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            <Link href="/" className={navLink}>
              Markets
            </Link>
            <Link href="/create" className={navLink}>
              Create
            </Link>
            <Link href="/oracle" className={navLink}>
              Oracle
            </Link>
          </nav>
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
          {connectErr && (
            <span className="max-w-[220px] text-right text-[10px] font-medium leading-tight text-red-700">
              {connectErr}
            </span>
          )}
          {isConnected ? (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-3">
              <span
                className={`inline-flex max-w-full items-center border-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-xs ${
                  wrongNetwork
                    ? "border-rose-800 bg-rose-100 text-rose-950"
                    : "border-neutral-950 bg-white text-neutral-800"
                }`}
                style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                title="Active wallet network"
              >
                {activeChainLabel}
              </span>
              <span className="hidden max-w-[10rem] truncate font-mono text-xs font-medium text-neutral-600 sm:block">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              <button
                type="button"
                onClick={() => disconnect()}
                className="nb-btn-outline shrink-0 px-3 py-1.5 text-xs"
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isPending}
              className="nb-btn px-4 py-2 text-sm disabled:opacity-60"
            >
              {isPending ? "…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
