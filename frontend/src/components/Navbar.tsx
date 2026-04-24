"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">⚡</span>
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              PolyOracle
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">
              Markets
            </Link>
            <Link href="/create" className="hover:text-white transition-colors">
              Create Market
            </Link>
            <Link href="/oracle" className="hover:text-white transition-colors">
              Oracle Jobs
            </Link>
          </div>
        </div>

        <div>
          {isConnected ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono hidden sm:block">
                {address?.slice(0, 6)}…{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
