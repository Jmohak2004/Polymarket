"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { Navbar } from "./Navbar";
import { DEMO_MODE } from "@/lib/demo";

function Sidebar({ close }: { close: () => void }) {
  const path = usePathname(), params = useSearchParams();
  const view = params.get("view") || "markets", category = params.get("category");
  const [help, setHelp] = useState(false);
  const primary = [
    { label: "Explore markets", icon: "grid", href: "/", active: path === "/" && view === "markets" && !category },
    { label: "Ending soon", icon: "bolt", href: "/?view=ending", active: view === "ending" },
    { label: "My portfolio", icon: "wallet", href: "/?view=portfolio", active: view === "portfolio" },
    { label: "Watchlist", icon: "star", href: "/?view=watchlist", active: view === "watchlist" },
    { label: "Activity", icon: "activity", href: "/?view=activity", active: view === "activity" },
  ];
  return <>
    <Link href="/" className="brand" onClick={close}><span className="brand-mark"><i/><i/><i/></span>poly<span>oracle</span><span className="brand-dot">●</span></Link>
    <div className="sidebar-scroll">
      <div className="workspace-tag"><span className="live-dot"/>{DEMO_MODE ? "THE PREDICTION PLAYGROUND" : "THE PREDICTION EXCHANGE"}</div>
      <nav className="side-nav" aria-label="Main navigation">{primary.map(item => <Link key={item.label} href={item.href} onClick={close} className={`side-link ${item.active ? "active" : ""}`}><Icon name={item.icon} size={19}/><span>{item.label}</span>{item.icon === "bolt" && <span className="side-badge">HOT</span>}</Link>)}</nav>
      <p className="side-section-label">DISCOVER</p>
      <nav className="side-nav" aria-label="Market categories">{[["Politics", "globe"], ["Sports", "ball"], ["Crypto", "bitcoin"], ["Tech & AI", "cpu"], ["Economy", "chart"], ["Culture", "news"]].map(([name, icon]) => <Link key={name} href={`/?category=${encodeURIComponent(name)}`} onClick={close} className={`side-link ${category === name ? "active" : ""}`}><Icon name={icon} size={18}/><span>{name}</span><Icon name="chevron" size={13}/></Link>)}</nav>
      <div className="sidebar-divider"/>
      <nav className="side-nav" aria-label="Tools"><Link href="/create" onClick={close} className={`side-link ${path === "/create" ? "active" : ""}`}><Icon name="plus" size={19}/>Create a market</Link><Link href="/oracle" onClick={close} className={`side-link ${path === "/oracle" ? "active" : ""}`}><Icon name="shield" size={19}/>Oracle network<span className="beta">BETA</span></Link></nav>
      <div className="sidebar-promo"><span className="promo-orbit">✦</span><span className="mini-label">HAVE A HUNCH?</span><h3>Put your knowledge<br/>to the test.</h3><Link href="/?view=ending" onClick={close}>Find your next market <Icon name="arrow" size={15}/></Link></div>
    </div>
    <div className="sidebar-bottom"><button onClick={() => setHelp(true)}><Icon name="help" size={18}/>How it works<Icon name="external" size={13}/></button><div><span className="live-dot"/> {DEMO_MODE ? "Demo mode · virtual funds" : "Connected exchange"}<span>v1.0</span></div></div>
    {help && <Modal title="A little knowledge. A new edge." onClose={() => setHelp(false)}><div className="help-content"><p>Pick an event, choose Yes or No, and follow your prediction.</p><ol><li><strong>Find your market.</strong> Explore topics, search questions, and save your favorites.</li><li><strong>Make your call.</strong> A 67¢ Yes share implies a 67% market probability. A winning demo share pays $1 at resolution.</li><li><strong>Track your position.</strong> View your shares and history in My portfolio. In demo mode, sell at the displayed practice price.</li></ol><div className="info-box">{DEMO_MODE ? "This is a practice environment. Markets, volumes, chart histories, and funds are illustrative. No deposits, withdrawals, or real-money trades take place. Practice markets do not auto-settle." : "Connected markets use the configured blockchain contract. Pool ratios are indicative; payouts depend on the final pool, fees, and oracle outcome."}</div><p className="muted">Use predictions thoughtfully. Take breaks and only risk what you can afford on real-money platforms.</p><button className="primary-button full" onClick={() => setHelp(false)}>Got it. Let’s explore <Icon name="arrow" size={17}/></button></div></Modal>}
  </>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  return <div className="app-shell">
    {menu && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMenu(false)}/>}
    <aside className={`sidebar ${menu ? "open" : ""}`}><Suspense fallback={<div className="brand">polyoracle</div>}><Sidebar close={() => setMenu(false)}/></Suspense></aside>
    <div className="app-content"><Navbar onMenu={() => setMenu(v => !v)}/><main className="main-content">{children}</main><footer className="app-footer"><span className="footer-brand">polyoracle<span>®</span></span><span>Your perspective has value.</span><div><span className="live-dot"/>{DEMO_MODE ? "Practice markets · Virtual funds only" : "Powered by on-chain markets"}<span className="footer-copy">© 2026 PolyOracle</span></div></footer></div>
  </div>;
}
