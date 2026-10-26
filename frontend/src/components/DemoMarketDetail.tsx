"use client";
import Link from "next/link";
import { useDemo } from "@/lib/useDemo";
import { metaFor, probability } from "@/lib/demo";
import { Icon } from "./Icon";
import { MarketBadge, TradeTicket } from "./Trading";
import { MarketChart } from "./MarketChart";

export function DemoMarketDetail({ id }: { id: number }) {
  const demo = useDemo(), market = demo.markets.find(m => m.id === id);
  if (!market) return <div className="empty-state" style={{ marginTop: 35 }}><Icon name="search" size={30}/><h3>This market isn’t available.</h3><p>It may have been created in a different browser session.</p><Link href="/" className="primary-button">Explore markets</Link></div>;
  const meta = metaFor(market);
  return <div className="detail-page"><Link className="detail-back" href="/"><Icon name="arrow" size={14}/>Back to markets</Link><div className="detail-grid"><div className="detail-info"><div className="market-category"><MarketBadge market={market}/><span>{meta.category}<span className="demo-label">Practice market · virtual funds</span></span></div><h1>{market.question}</h1><div className="preview-probability">{probability(market)}<span>% chance</span></div><MarketChart large seed={market.id} positive={meta.change >= 0}/><p className="chart-caption">Illustrative history · not a live price feed</p><div className="detail-rules"><h3>Resolution rules</h3><p>This market asks whether the event described in the question occurs before {new Date(market.resolution_time).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}. This is a demo market; it does not settle automatically.</p><p>Evidence: {market.data_source.startsWith("https://") || market.data_source.startsWith("http://") ? <a href={market.data_source} target="_blank" rel="noopener noreferrer" className="positive">View evidence source ↗</a> : market.data_source}</p><div className="info-box">Practice prices are fixed and illustrative. Winning value is conditional; no real money or guaranteed returns are involved.</div></div></div><TradeTicket market={market}/></div></div>;
}
