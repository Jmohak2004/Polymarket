import type { Metadata } from "next";
import { seedMarkets, DEMO_MODE } from "@/lib/demo";

export function generateStaticParams() {
  return process.env.STATIC_EXPORT === "true" ? seedMarkets().map(m => ({ id: String(m.id) })) : [];
}

const FALLBACK_DESC =
  "View this prediction market on PolyOracle — on-chain staking and AI-assisted resolution.";

function truncateMid(s: string, max = 72): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

async function fetchMarketQuestion(id: string): Promise<string | null> {
  if (DEMO_MODE) return seedMarkets().find(m => m.id === Number(id))?.question ?? null;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
  try {
    const res = await fetch(`${apiBase}/markets/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { question?: unknown };
    return typeof j.question === "string" ? j.question : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const q = await fetchMarketQuestion(id);
  const title = truncateMid(q ?? `Market #${id}`, 76);

  const desc = FALLBACK_DESC;

  const path = `/market/${id}`;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://polyoracle-markets.deeppanda2049.chatgpt.site").replace(
    /\/+$/,
    "",
  );
  try {
    const ogUrl = new URL(path, siteUrl);
    return {
      title,
      description: desc,
      openGraph: { title, description: desc, url: ogUrl.href },
      twitter: { card: "summary", title, description: desc },
    };
  } catch {
    return {
      title,
      description: desc,
      openGraph: { title, description: desc },
      twitter: { card: "summary", title, description: desc },
    };
  }
}

export default function MarketSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
