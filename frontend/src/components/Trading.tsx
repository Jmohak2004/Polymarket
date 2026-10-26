"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Market } from "@/lib/api";
import { DEMO_MODE, executeDemoTrade, metaFor, probability, usd, type Side } from "@/lib/demo";
import { useDemo } from "@/lib/useDemo";
import { shortError } from "@/lib/errors";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { MarketChart } from "./MarketChart";

export function MarketBadge({ market, small = false }: { market: Market; small?: boolean }) {
  const meta = metaFor(market);
  return <span className={`market-badge ${meta.color} ${small ? "small" : ""}`}>{meta.symbol}</span>;
}

export function TradeTicket({ market, initialSide = "yes", onSuccess }: { market: Market; initialSide?: Side; onSuccess?: () => void }) {
  const state = useDemo();
  const [side, setSide] = useState<Side>(initialSide), [action, setAction] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const chance = probability(market), price = (side === "yes" ? chance : 100 - chance) / 100;
  const total = Number(amount) || 0, shares = total / price;
  const position = state.positions.find(p => p.marketId === market.id && p.side === side);
  const heldValue = (position?.shares || 0) * price;
  const closed = market.status !== 0 || Date.parse(market.resolution_time) <= Date.now();
  if (!DEMO_MODE) return <div className="trade-ticket"><p className="muted">This market trades through the configured on-chain contract.</p><Link href={`/market/${market.id}`} className="primary-button full">Open on-chain market<Icon name="arrow" size={17}/></Link></div>;
  return <form className="trade-ticket" onSubmit={e => {
    e.preventDefault(); setError(""); setBusy(true);
    try { const trade = executeDemoTrade(market.id, side, action, Number(amount)); toast.success(`${action === "buy" ? "Bought" : "Sold"} ${trade.shares.toFixed(2)} ${side.toUpperCase()} shares`, { description: `${usd(trade.amount)} in demo funds · ${market.question}` }); onSuccess?.(); }
    catch (err) { setError(shortError(err)); } finally { setBusy(false); }
  }}>
    <div className="ticket-tabs"><button type="button" className={action === "buy" ? "active" : ""} onClick={() => { setAction("buy"); setError(""); }}>Buy</button><button type="button" className={action === "sell" ? "active" : ""} onClick={() => { setAction("sell"); setError(""); }}>Sell</button><span className="demo-chip">DEMO TRADE</span></div>
    <div className="outcome-buttons"><button type="button" className={`yes ${side === "yes" ? "selected" : ""}`} onClick={() => { setSide("yes"); setError(""); }}>Yes <span>{chance}¢</span></button><button type="button" className={`no ${side === "no" ? "selected" : ""}`} onClick={() => { setSide("no"); setError(""); }}>No <span>{100 - chance}¢</span></button></div>
    <div className="field-row"><label htmlFor="trade-amount">Amount</label><span>{action === "buy" ? `Balance: ${usd(state.balance)}` : `Available: ${usd(heldValue)}`}</span></div>
    <div className="amount-input"><span>$</span><input id="trade-amount" type="number" min="1" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setError(""); }} required/><span>USD</span></div>
    <div className="quick-amounts">{[10, 25, 100].map(n => <button key={n} type="button" onClick={() => { setAmount(String(n)); setError(""); }}>${n}</button>)}<button type="button" onClick={() => setAmount(String(Math.floor((action === "buy" ? state.balance : heldValue) * 100) / 100))}>Max</button></div>
    <div className="trade-breakdown"><div><span>Average price</span><strong>{(price * 100).toFixed(0)}¢</strong></div><div><span>{action === "buy" ? "Shares you receive" : "Shares you sell"}</span><strong>{shares.toFixed(2)}</strong></div><div><span>Demo trading fee</span><strong>$0.00</strong></div><div className="payout-row"><span>{action === "buy" ? "Value if your outcome wins" : "You receive"}<Icon name="help" size={13}/></span><strong>{usd(action === "buy" ? shares : total)}</strong></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className={`primary-button full trade-submit ${side === "no" ? "no-submit" : ""}`} disabled={closed || busy}>{closed ? "Market closed" : `${action === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`}<Icon name="arrow" size={17}/></button>
    <p className="fine-print"><Icon name="shield" size={13}/>Virtual funds only. {action === "buy" ? "Payout is conditional on winning." : "Sells use the displayed demo price."}</p>
  </form>;
}

export function TradeModal({ market, side, onClose }: { market: Market; side: Side; onClose: () => void }) {
  const [period, setPeriod] = useState("1W");
  const meta = metaFor(market);
  return <Modal title="Make your call" onClose={onClose} wide><div className="trade-modal-grid"><div className="trade-preview"><div className="market-category"><MarketBadge market={market}/><span>{meta.category}<span className="demo-label">Illustrative market</span></span></div><h3>{market.question}</h3><div className="preview-probability">{probability(market)}<span>% chance</span><small className={meta.change >= 0 ? "positive" : "negative"}>{meta.change >= 0 ? "+" : ""}{meta.change}%</small></div><div className="chart-periods">{["1D", "1W", "1M", "ALL"].map(p => <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>{p}</button>)}</div><MarketChart seed={market.id} large positive={meta.change >= 0} period={period}/><p className="chart-caption">Illustrative history · not a live price feed</p><div className="resolution-note"><Icon name="clock" size={16}/><span>Resolves {new Date(market.resolution_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}<br/><small>Demo outcomes are not automatically settled.</small></span></div></div><TradeTicket market={market} initialSide={side}/></div></Modal>;
}
