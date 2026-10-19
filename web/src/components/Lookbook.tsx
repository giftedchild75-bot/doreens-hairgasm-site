"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

export type Look = { url: string; alt: string; slug: string; name: string };

/** Swipeable reel of every product photo; arrows on desktop, touch-scroll on phones. */
export function Lookbook({ looks }: { looks: Look[] }) {
  const track = useRef<HTMLDivElement>(null);
  const nudge = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.7 });
  if (looks.length < 3) return null;
  return (
    <section className="lookbook" id="lookbook" aria-label="Lookbook">
      <div className="container lookbook-head">
        <div className="section-head">
          <div className="section-eyebrow">The Lookbook</div>
          <h2>Straight From the Salon</h2>
          <p>Real pieces, real photos — swipe through and tap any look to shop it.</p>
        </div>
        <div className="lookbook-arrows">
          <button type="button" aria-label="Previous looks" onClick={() => nudge(-1)}>←</button>
          <button type="button" aria-label="More looks" onClick={() => nudge(1)}>→</button>
        </div>
      </div>
      <div className="lookbook-track" ref={track}>
        {looks.map((l) => (
          <Link key={l.url} href={`/products/${l.slug}`} className="look-link">
            <figure className="look">
              <Image src={l.url} alt={l.alt || l.name} fill sizes="(max-width: 720px) 70vw, 300px" />
              <figcaption><strong>{l.name}</strong><span>Shop this look</span></figcaption>
            </figure>
          </Link>
        ))}
      </div>
    </section>
  );
}
