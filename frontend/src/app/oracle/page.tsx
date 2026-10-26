"use client";
import Link from "next/link";
import { DEMO_MODE } from "@/lib/demo";
import { Icon } from "@/components/Icon";
import OracleJobsLive from "@/components/OracleJobsLive";

export default function OraclePage() {
  if (!DEMO_MODE) return <div className="legacy-page"><OracleJobsLive/></div>;
  return <div><div className="oracle-intro"><span className="eyebrow">EVIDENCE OVER OPINION</span><h1>Clarity behind every outcome<span className="title-dot">.</span></h1><p className="muted">A look at the oracle architecture powering connected PolyOracle markets.</p></div><div className="oracle-status-grid">{[
    { icon: "search", title: "1. Find the evidence", text: "Public news, speeches, images, or weather observations provide a source for the market’s resolution." },
    { icon: "cpu", title: "2. Analyze the outcome", text: "The configured AI pipeline evaluates the source against the market’s question and produces a confidence score." },
    { icon: "shield", title: "3. Reach consensus", text: "Authorized oracle votes go to the resolver contract. The configured quorum and dispute window determine settlement." },
  ].map(item => <div className="oracle-status-card" key={item.title}><Icon name={item.icon} size={25}/><h3>{item.title}</h3><p>{item.text}</p><span className="demo-chip">BACKEND REQUIRED</span></div>)}</div><div className="data-panel"><div className="panel-heading"><h3>Oracle activity</h3><span>DEMO ENVIRONMENT</span></div><div className="empty-state compact-empty"><span className="empty-icon"><Icon name="shield" size={30}/></span><h3>No oracle jobs in demo mode.</h3><p>Practice markets don’t run AI resolution. Connect the backend, configure the oracle services, and deploy the contracts to process real evidence.</p><Link className="secondary-button" href="/">Back to markets<Icon name="arrow" size={16}/></Link></div></div></div>;
}
