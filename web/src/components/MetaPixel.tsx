"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Meta Pixel, loaded only after the visitor accepts. Until then nothing is
 * requested from Meta. The choice is remembered in localStorage ("dh_consent").
 * Store events reach Meta through metaPixelEvent(), called from track().
 */
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

const KEY = "dh_consent";

function readConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function loadPixel(id: string) {
  if (window.fbq) return;
  // Meta's standard loader, written out instead of pasted as a string.
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", id);
}

const EVENTS: Record<string, string> = {
  product_view: "ViewContent",
  add_to_cart: "AddToCart",
  checkout_start: "InitiateCheckout",
  save_item: "AddToWishlist",
  newsletter_signup: "Lead",
};

/** Forward a store event to Meta, if the pixel has been loaded with consent. */
export function metaPixelEvent(name: string, props: Record<string, unknown>) {
  const event = EVENTS[name];
  if (!event || !window.fbq) return;
  const slug = typeof props.slug === "string" ? props.slug : undefined;
  window.fbq("track", event, slug ? { content_ids: [slug], content_type: "product" } : {});
}

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const [consent, setConsent] = useState<"granted" | "denied" | null | "unknown">("unknown");
  const pathname = usePathname();

  useEffect(() => setConsent(readConsent()), []);

  useEffect(() => {
    if (consent !== "granted") return;
    loadPixel(pixelId);
    window.fbq?.("track", "PageView");
  }, [consent, pixelId, pathname]);

  function choose(v: "granted" | "denied") {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    setConsent(v);
  }

  if (consent !== null) return null;
  return (
    <div className="consent-bar" role="region" aria-label="Cookie choice">
      <p>
        May we use Meta&apos;s pixel to measure our ads and show you relevant ones on Instagram and Facebook?{" "}
        <Link className="mini-link" href="/policies/privacy">Privacy</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-outline" onClick={() => choose("denied")}>No thanks</button>
        <button type="button" className="btn btn-primary" onClick={() => choose("granted")}>Accept</button>
      </div>
    </div>
  );
}
