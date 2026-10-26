"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { DEMO_MODE, addDemoFunds, usd } from "@/lib/demo";
import { useDemo } from "@/lib/useDemo";
import { getExpectedChainId } from "@/lib/chainEnv";
import { shortError } from "@/lib/errors";

export function Navbar({ onMenu }: { onMenu?: () => void }) {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId(), expectedChain = getExpectedChainId();
  const { switchChainAsync } = useSwitchChain();
  const state = useDemo();
  const [modal, setModal] = useState<"funds" | "wallet" | "notifications" | null>(null);
  const [amount, setAmount] = useState("1000"), [error, setError] = useState("");
  const wrongNetwork = isConnected && expectedChain && chainId !== expectedChain;
  async function connect(connector: (typeof connectors)[number]) {
    setError("");
    try { if (!await connector.getProvider()) throw new Error("Install a compatible browser wallet, then refresh this page."); await connectAsync({ connector }); setModal(null); toast.success("Wallet connected"); } catch (e) { setError(shortError(e)); }
  }
  return <>
    <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation"><Icon name="menu"/></button><Link href="/" className="top-nav-link selected">Markets</Link><Link href="/?view=portfolio" className="top-nav-link">Portfolio</Link><span className="topbar-separator"/><form action="/" className="global-search"><Icon name="search" size={17}/><input name="q" aria-label="Search all markets" placeholder="Search markets, topics & more" autoComplete="off"/><kbd>↵</kbd></form></div>
    <div className="topbar-actions">{DEMO_MODE ? <><span className="demo-chip">DEMO</span><div className="balance"><span className="currency-mark">$</span><span>{usd(state.balance)}</span></div><button className="primary-button deposit-button" onClick={() => { setModal("funds"); setError(""); }}><Icon name="plus" size={17}/><span>Add funds</span></button></> : <Link href="/create" className="primary-button">Create market</Link>}<button className="icon-button notification-button" onClick={() => setModal("notifications")} aria-label="Notifications"><Icon name="bell" size={19}/></button><button className="avatar-button" aria-label={isConnected ? "Manage wallet" : "Connect wallet"} onClick={() => { setModal("wallet"); setError(""); }}>{isConnected ? address?.slice(2, 4).toUpperCase() : <Icon name="wallet" size={18}/>}</button></div></header>
    {wrongNetwork && <div className="network-banner">Your wallet is on a different network.<button onClick={async () => { try { await switchChainAsync({ chainId: expectedChain }); } catch (e) { toast.error(shortError(e)); } }}>Switch to chain {expectedChain}</button></div>}
    {modal === "funds" && <Modal title="A little fuel for your next call." onClose={() => setModal(null)}><form className="funds-form" onSubmit={e => { e.preventDefault(); try { addDemoFunds(Number(amount)); toast.success(`${usd(Number(amount))} added to your demo balance`); setModal(null); } catch (err) { setError(shortError(err)); } }}><span className="eyebrow">DEMO WALLET</span><p className="muted">Practice with virtual dollars. These funds have no cash value.</p><label className="field-label" htmlFor="funds-amount">Amount in USD</label><div className="amount-input"><span>$</span><input id="funds-amount" type="number" min="1" max="100000" step="1" required value={amount} onChange={e => setAmount(e.target.value)}/><span>USD</span></div><div className="quick-amounts">{[100, 1000, 5000].map(n => <button type="button" key={n} onClick={() => setAmount(String(n))}>{usd(n, 0)}</button>)}</div>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button full" type="submit">Add demo funds<Icon name="plus" size={18}/></button><p className="fine-print"><Icon name="shield" size={13}/>No payment details. No real money.</p></form></Modal>}
    {modal === "wallet" && <Modal title={isConnected ? "Your connected wallet" : "Connect your wallet"} onClose={() => setModal(null)}><div className="wallet-content">{isConnected ? <><div className="info-box break-all">{address}</div><p className="muted">Connected to chain {chainId}. {DEMO_MODE && "Your demo balance is separate from your wallet."}</p><button className="secondary-button full" onClick={() => { disconnect(); setModal(null); }}>Disconnect wallet</button></> : <><p className="muted">Connect a browser wallet for configured on-chain markets. {DEMO_MODE && "You can explore and practice without a wallet."}</p>{connectors.filter((c, i, all) => all.findIndex(x => x.name === c.name) === i).map(c => <button className="wallet-option" key={c.uid} disabled={isPending} onClick={() => connect(c)}><span className="wallet-symbol"><Icon name="wallet"/></span><span>{c.name}</span><Icon name="arrow" size={18}/></button>)}{error && <p className="form-error" role="alert">{error}</p>}<p className="fine-print">You approve every transaction in your own wallet.</p></>}</div></Modal>}
    {modal === "notifications" && <Modal title="You’re all caught up" onClose={() => setModal(null)}><div className="empty-state compact-empty"><span className="empty-icon"><Icon name="bell" size={28}/></span><h3>A little quiet. A lot of possibility.</h3><p>There are no new notifications. Your trade history is always available in Activity.</p><Link className="secondary-button" href="/?view=activity" onClick={() => setModal(null)}>View activity<Icon name="arrow" size={16}/></Link></div></Modal>}
  </>;
}
