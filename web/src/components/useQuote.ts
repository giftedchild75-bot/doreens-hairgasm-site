"use client";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/server/pricing";
import type { BagLine } from "./CartProvider";

export interface QuoteExtras {
  couponCode?: string | null;
  country?: string | null;
  region?: string | null;
  shippingMethodId?: string | null;
}

/** Fetches the server's authoritative quote whenever the bag or destination changes. */
export function useQuote(lines: BagLine[], extras: QuoteExtras, enabled = true) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify({ l: lines.map((l) => [l.variantId, l.quantity]), extras });

  useEffect(() => {
    if (!enabled || lines.length === 0) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), ...extras }),
        });
        if (!res.ok) throw new Error();
        const q = (await res.json()) as Quote;
        if (id === seq.current) {
          setQuote(q);
          setError(null);
        }
      } catch {
        if (id === seq.current) setError("We couldn't load current prices. Check your connection and try again.");
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { quote, loading, error };
}
