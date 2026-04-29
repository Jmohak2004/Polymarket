import type { Metadata } from "next";

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
  return children;
}
