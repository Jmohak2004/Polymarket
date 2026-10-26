"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DemoMarketDetail } from "@/components/DemoMarketDetail";
import { DEMO_MODE } from "@/lib/demo";
import Link from "next/link";
function MarketByQuery() { const params = useSearchParams(); return DEMO_MODE ? <DemoMarketDetail id={Number(params.get("id"))}/> : <div className="empty-state"><h3>Select a connected market to begin.</h3><Link href="/" className="primary-button">Browse markets</Link></div>; }
export default function MarketPage() { return <Suspense fallback={<div className="page-loading">Loading market…</div>}><MarketByQuery/></Suspense>; }
