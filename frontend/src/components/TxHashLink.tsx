"use client";

import { explorerTxUrl } from "@/lib/chainEnv";

interface TxHashLinkProps {
  hash: `0x${string}`;
  className?: string;
}

/** Renders a transaction hash — link when `NEXT_PUBLIC_CHAIN_EXPLORER` base URL is set. */
export function TxHashLink({
  hash,
  className = "break-all font-medium",
}: TxHashLinkProps) {
  const href = explorerTxUrl(hash);
  if (!href) {
    return <span className={className}>{hash}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in block explorer"
      className={`${className} text-neutral-950 underline decoration-2 underline-offset-[3px] decoration-neutral-950 hover:text-neutral-600`}
    >
      {hash}
    </a>
  );
}
