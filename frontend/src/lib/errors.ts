/** Short UX-safe message from wallets / wagmi / API errors */
export function shortError(err: unknown): string {
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
