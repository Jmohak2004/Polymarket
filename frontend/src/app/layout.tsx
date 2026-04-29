import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "sonner/dist/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

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
    <html lang="en" className={outfit.variable}>
      <body
        className={`${outfit.className} min-h-screen font-sans text-neutral-950 antialiased`}
      >
        <div className="nb-bg-blobs" aria-hidden="true" />
        <Providers>
          <div className="relative z-10">
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
