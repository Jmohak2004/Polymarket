import type { Connector } from "wagmi";

/**
 * Use a connector instance from `useConnect().connectors` / `useConnectors()`.
 * Do not call `injected()` here — a fresh instance will not match the config
 * and MetaMask / wallet connect can silently do nothing.
 */
export function pickWalletConnector(connectors: readonly Connector[]) {
  if (connectors.length === 0) return undefined;
  const by = (id: string) => connectors.find((c) => c.id === id);
  return (
    by("io.metamask") ||
    by("io.rabby") ||
    by("app.phantom") ||
    connectors.find((c) => c.type === "injected") ||
    connectors[0]
  );
}
