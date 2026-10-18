"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";

type Card = { slug: string; name: string; priceKobo: number; image: { url: string; alt: string } | null };

export function RecentlyViewed({ exclude }: { exclude: string }) {
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    let slugs: string[] = [];
    try {
      slugs = JSON.parse(localStorage.getItem("dh_recent") ?? "[]").filter((s: string) => s !== exclude).slice(0, 4);
    } catch {}
    if (!slugs.length) return;
    fetch(`/api/products/cards?slugs=${encodeURIComponent(slugs.join(","))}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, [exclude]);
  if (!items.length) return null;
  return (
    <section className="section-tight">
      <div className="container">
        <div className="section-head"><div className="section-eyebrow">You looked at</div><h2>Recently Viewed</h2></div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {items.map((m) => (
            <Link key={m.slug} href={`/products/${m.slug}`} style={{ width: 160 }}>
              {m.image && <Image src={m.image.url} alt={m.image.alt} width={160} height={213} style={{ borderRadius: 14, objectFit: "cover", height: 213 }} />}
              <h3 style={{ fontFamily: "var(--serif)", fontSize: 16, margin: "8px 0 2px" }}>{m.name}</h3>
              <span className="price">{formatNaira(m.priceKobo)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
