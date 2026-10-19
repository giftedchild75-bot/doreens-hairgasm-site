"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProductCard as Card } from "@/server/catalog";
import { ProductCard } from "./ProductCard";
import { useSaved } from "./useSaved";

export function SavedList() {
  const { slugs } = useSaved();
  const [items, setItems] = useState<Card[] | null>(null);
  const key = slugs.join(",");

  useEffect(() => {
    if (!key) {
      setItems([]);
      return;
    }
    fetch(`/api/products/cards?slugs=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: Card[] }) => setItems(d.items))
      .catch(() => setItems([]));
  }, [key]);

  if (items === null) return <p className="muted" style={{ textAlign: "center" }}>Loading your pieces…</p>;
  // Keep the order the shopper saved them in, and drop anything no longer for sale.
  const shown = slugs.map((s) => items.find((i) => i.slug === s)).filter((i): i is Card => !!i);
  if (!shown.length) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.6-9.2C1 8.2 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.7 0 5.6 3.7 4.2 6.8-2.1 4.6-9.6 9.2-9.6 9.2z" /></svg>
        <p className="muted">Nothing saved yet. Tap the ♡ on any piece to keep it here.</p>
        <Link className="btn btn-primary" href="/shop">Explore the collection</Link>
      </div>
    );
  }
  return <div className="grid-products">{shown.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}
