/** `NEXT_PUBLIC_CHAIN_ID` — optional enforced chain for contract calls */
export function getExpectedChainId(): number | undefined {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CHAIN_ID : undefined;
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
