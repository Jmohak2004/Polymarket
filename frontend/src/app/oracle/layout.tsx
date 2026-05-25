import type { Metadata } from "next";
import { Suspense } from "react";
import { OracleJobSkeleton } from "@/components/OracleJobSkeleton";

const TITLE = "Oracle jobs";
const DESC =
  "Monitor oracle resolution jobs: speech, image, weather, and social pipelines against your evidence URLs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC },
  twitter: { card: "summary", title: TITLE, description: DESC },
};

export default function OracleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <ul className="mx-auto max-w-4xl space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <OracleJobSkeleton key={i} />
          ))}
        </ul>
      }
    >
      {children}
    </Suspense>
  );
}
