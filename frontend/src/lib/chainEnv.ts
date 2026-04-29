/** `NEXT_PUBLIC_CHAIN_ID` — optional enforced chain for contract calls */
export function getExpectedChainId(): number | undefined {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CHAIN_ID : undefined;
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Explorer base URL (no trailing slash), from `NEXT_PUBLIC_CHAIN_EXPLORER`.
 * E.g. `https://amoy.polygonscan.com` → `/tx/:hash`.
 */
export function getChainExplorerTxBase(): string | undefined {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CHAIN_EXPLORER : undefined;
  if (!raw?.trim()) return undefined;
  return raw.trim().replace(/\/+$/, "");
}

/** Block explorer `/tx/:hash` when env is set and hash is a 66-char hex string. */
export function explorerTxUrl(hash: string): string | undefined {
  const base = getChainExplorerTxBase();
  if (!base || !hash?.trim()) return undefined;
  const h = hash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(h)) return undefined;
  return `${base}/tx/${h}`;
}
