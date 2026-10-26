import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return <Suspense fallback={<div className="page-loading">Finding your next opportunity…</div>}><Dashboard/></Suspense>;
}
