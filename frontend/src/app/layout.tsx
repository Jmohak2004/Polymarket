import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Polymarket AI — Prediction Markets with AI Oracle",
  description:
    "Decentralized prediction markets powered by an AI oracle network. Bet on real-world events resolved by AI.",
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
