"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { track } from "./track";

type Card = { slug: string; name: string; priceKobo: number; image: { url: string; alt: string } | null };
const STEPS = [
  { key: "undertone", title: "1 · Undertone", swatch: true, options: [["warm", "Warm", "#caa06b"], ["cool", "Cool", "#453a33"], ["neutral", "Neutral", "#8a7256"]] },
  { key: "length", title: "2 · Length", options: [["bob", "Bob"], ["mid", "Mid-Length"], ["long", "Long"]] },
  { key: "texture", title: "3 · Texture", options: [["straight", "Straight"], ["wavy", "Wavy"], ["curly", "Curly"]] },
] as const;

export function ShadeFinder({ whatsappNumber }: { whatsappNumber: string }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Card[] | null>(null);
  const [error, setError] = useState(false);
  const complete = sel.undertone && sel.length && sel.texture;

  useEffect(() => {
    if (!complete) return;
    const qs = new URLSearchParams(sel).toString();
    setError(false);
    fetch(`/api/shade?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMatches(d.items))
      .catch(() => setError(true));
    track("shade_finder_complete", sel);
  }, [complete, sel]);

  const wa = complete
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Hi Doreen! I used the shade finder — ${sel.undertone} undertone, ${sel.length} length, ${sel.texture} texture.${matches?.length ? ` I like ${matches[0].name}.` : ""} Can we chat?`,
      )}`
    : "#";

  return (
    <>
      <div className="shade-steps">
        {STEPS.map((step) => (
          <div className="shade-step" data-reveal key={step.key}>
            <h3 id={`shade-${step.key}`}>{step.title}</h3>
            <div className="swatch-row" role="radiogroup" aria-labelledby={`shade-${step.key}`}>
              {step.options.map((o) => {
                const [value, label] = o;
                const selected = sel[step.key] === value;
                return "swatch" in step ? (
                  <button key={value} type="button" role="radio" aria-checked={selected} aria-label={label}
                    className={`swatch${selected ? " is-selected" : ""}`} style={{ ["--sw" as string]: (o as readonly string[])[2] }}
                    onClick={() => setSel((s) => ({ ...s, [step.key]: value }))} />
                ) : (
                  <button key={value} type="button" role="radio" aria-checked={selected}
                    className={`pill-choice${selected ? " is-selected" : ""}`}
                    onClick={() => setSel((s) => ({ ...s, [step.key]: value }))}>{label}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {complete && (
        <div className="shade-result is-shown" aria-live="polite">
          <p className="shade-result-label">Your closest matches in the collection</p>
          {error && <p className="muted">We couldn&apos;t load matches right now — message us and we&apos;ll help.</p>}
          {matches && matches.length > 0 && (
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", margin: "16px 0 24px" }}>
              {matches.map((m) => (
                <Link key={m.slug} href={`/products/${m.slug}`} style={{ width: 150, textAlign: "center" }}>
                  {m.image && <Image src={m.image.url} alt={m.image.alt} width={150} height={200} style={{ borderRadius: 14, objectFit: "cover", height: 200 }} />}
                  <h3 style={{ fontSize: 16, margin: "8px 0 2px" }}>{m.name}</h3>
                  <span className="price">{formatNaira(m.priceKobo)}</span>
                </Link>
              ))}
            </div>
          )}
          <a className="btn btn-primary" href={wa} target="_blank" rel="noopener">Finish your fitting on WhatsApp</a>
        </div>
      )}
    </>
  );
}
