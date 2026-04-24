"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { pickWalletConnector } from "@/lib/walletConnect";

const navLink =
  "text-sm font-bold text-neutral-800 underline decoration-2 decoration-transparent underline-offset-4 transition hover:decoration-neutral-950";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [connectErr, setConnectErr] = useState<string | null>(null);

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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-baseline gap-2 font-black tracking-tight text-neutral-950"
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

        <div className="flex flex-col items-end gap-1">
          {connectErr && (
            <span className="max-w-[220px] text-right text-[10px] font-medium leading-tight text-red-700">
              {connectErr}
            </span>
          )}
          {isConnected ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden font-mono text-xs font-medium text-neutral-600 sm:block">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              <button
                type="button"
                onClick={() => disconnect()}
                className="nb-btn-outline px-3 py-1.5 text-xs"
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
