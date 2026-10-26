import type { Metadata } from "next";
import "sonner/dist/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL(
    (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "") + "/",
  ),
  title: {
    default: "Markets · PolyOracle",
    template: "%s · PolyOracle",
  },
  description:
    "Decentralized prediction markets with an AI oracle network. Create markets, place stakes on-chain, and resolve outcomes from real-world evidence.",
  applicationName: "PolyOracle",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "PolyOracle",
    title: "PolyOracle · Prediction markets & AI oracle",
    description:
      "Decentralized prediction markets with an AI oracle network. Bet on real-world events resolved from speech, news, weather, and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PolyOracle · Prediction markets & AI oracle",
    description:
      "Decentralized prediction markets with an AI oracle network. Bet on real-world events resolved from evidence.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
