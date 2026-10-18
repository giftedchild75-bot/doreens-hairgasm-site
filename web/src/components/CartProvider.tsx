"use client";
/**
 * Shopping bag, persisted in localStorage. It only stores what the shopper
 * picked (variant + quantity, plus display hints) — never prices. Every total
 * shown in the bag/checkout comes from the server quote.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface BagLine {
  variantId: string;
  quantity: number;
  slug: string;
  name: string;
  variantTitle: string;
  image: string | null;
}

interface Bag {
  lines: BagLine[];
  count: number;
  ready: boolean;
  add: (line: BagLine) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const KEY = "dh_bag_v1";
const MAX = 20;
const BagContext = createContext<Bag | null>(null);

function load(): BagLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((l) => typeof l?.variantId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(load());
    setReady(true);
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => e.key === KEY && setLines(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: BagLine[]) => {
    setLines(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable (private mode) — bag lives for this page only */
    }
  }, []);

  const value = useMemo<Bag>(() => ({
    lines,
    ready,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    add: (line) => {
      const current = load();
      const existing = current.find((l) => l.variantId === line.variantId);
      persist(
        existing
          ? current.map((l) => (l.variantId === line.variantId ? { ...l, quantity: Math.min(MAX, l.quantity + line.quantity) } : l))
          : [...current, { ...line, quantity: Math.min(MAX, line.quantity) }],
      );
    },
    setQuantity: (variantId, quantity) =>
      persist(load().map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(1, Math.min(MAX, quantity)) } : l))),
    remove: (variantId) => persist(load().filter((l) => l.variantId !== variantId)),
    clear: () => persist([]),
  }), [lines, ready, persist]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used inside CartProvider");
  return ctx;
}
