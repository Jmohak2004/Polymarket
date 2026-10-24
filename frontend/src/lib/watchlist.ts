"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "polyoracle-watchlist";
const WATCHLIST_EVENT = "polyoracle-watchlist-change";

function readWatchlist(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function writeWatchlist(ids: number[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function useWatchlist() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    const sync = () => setIds(readWatchlist());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(WATCHLIST_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(WATCHLIST_EVENT, sync);
    };
  }, []);

  const toggle = useCallback((marketId: number) => {
    const next = readWatchlist();
    const updated = next.includes(marketId)
      ? next.filter((id) => id !== marketId)
      : [...next, marketId];
    writeWatchlist(updated);
    setIds(updated);
  }, []);

  return {
    ids,
    isWatched: (marketId: number) => ids.includes(marketId),
    toggle,
  };
}
