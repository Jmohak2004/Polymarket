"use client";
import { useEffect, useState } from "react";
import { DEMO_EVENT, INITIAL_BALANCE, readDemo, seedMarkets, type DemoState } from "./demo";

export function useDemo() {
  const [state, setState] = useState<DemoState>({ version: 1, balance: INITIAL_BALANCE, funded: INITIAL_BALANCE, positions: [], trades: [], markets: seedMarkets() });
  useEffect(() => {
    const sync = () => setState(readDemo());
    sync();
    window.addEventListener(DEMO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(DEMO_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return state;
}
