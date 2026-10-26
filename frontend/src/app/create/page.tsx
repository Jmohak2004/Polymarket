"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo";
import { Icon } from "@/components/Icon";
import CreateMarketLive from "@/components/CreateMarketLive";

function DemoCreate() {
  const router = useRouter();
  const [question, setQuestion] = useState(""), [source, setSource] = useState(""), [date, setDate] = useState(""), [type, setType] = useState("4");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <div className="create-page"><div className="create-header"><span className="eyebrow">YOUR QUESTION. YOUR MARKET.</span><h1>See something others don’t<span className="title-dot">?</span></h1><p>Turn a clear question into a new prediction market. Make it specific, give it a deadline, and let curiosity take it from there.</p></div><form className="create-form" onSubmit={async e => { e.preventDefault(); setError(""); setBusy(true); try { const market = await api.markets.create({ question: question.trim(), market_type: Number(type), data_source: source, resolution_time: new Date(date).toISOString(), creator_address: "0x0000000000000000000000000000000000000000" }); toast.success("Your demo market is ready", { description: "Start making predictions with virtual funds." }); router.push(`/market?id=${market.id}`); } catch (err) { setError(err instanceof Error ? err.message : "Could not create market."); } finally { setBusy(false); } }}>
    <label htmlFor="question">What’s your prediction?</label><textarea id="question" placeholder="Will Bitcoin reach $150,000 before the end of 2026?" minLength={5} maxLength={500} required value={question} onChange={e => setQuestion(e.target.value)}/><small>Ask a specific question that can be answered with Yes or No.</small>
    <div className="create-fields"><div><label htmlFor="resolution">Resolution date</label><input id="resolution" type="datetime-local" required value={date} onChange={e => setDate(e.target.value)}/></div><div><label htmlFor="market-type">Evidence type</label><select id="market-type" value={type} onChange={e => setType(e.target.value)}><option value="4">Custom event</option><option value="0">Speech or announcement</option><option value="1">Image or video</option><option value="2">Weather event</option><option value="3">Social or news event</option></select></div></div>
    <label htmlFor="evidence">Evidence URL</label><input id="evidence" type="url" placeholder="https://example.com/official-results" required value={source} onChange={e => setSource(e.target.value)}/><small>Link to the public source that will determine the outcome.</small>
    <div className="info-box"><Icon name="shield" size={17}/><p>This creates a practice market in this browser. It uses virtual funds, has no on-chain deployment fee, and does not automatically resolve or pay out.</p></div>
    {error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button full" disabled={busy} type="submit">{busy ? "Creating your market…" : "Create demo market"}<Icon name="arrow" size={17}/></button>
  </form></div>;
}
export default function CreateMarketPage() { return DEMO_MODE ? <DemoCreate/> : <div className="legacy-page"><CreateMarketLive/></div>; }
