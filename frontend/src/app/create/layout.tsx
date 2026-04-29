import type { Metadata } from "next";

const TITLE = "Create market";
const DESC =
  "Submit a prediction market listing: question, evidence URL, resolution time — with optional on-chain deployment.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC },
  twitter: { card: "summary", title: TITLE, description: DESC },
};

export default function CreateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
