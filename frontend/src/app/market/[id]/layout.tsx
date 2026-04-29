import type { Metadata } from "next";

const FALLBACK_DESC =
  "View this prediction market on PolyOracle — on-chain staking and AI-assisted resolution.";

function truncateMid(s: string, max = 72): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

async function fetchMarketQuestion(id: string): Promise<string | null> {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /\/+$/,
    "",
  );
  try {
    const res = await fetch(`${apiBase}/markets/${encodeURIComponent(id)}`, {
      cache: "no-store",
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
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
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
