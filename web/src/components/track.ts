"use client";
import { metaPixelEvent } from "./MetaPixel";

/**
 * First-party, cookie-less event tracking. Session id lives in sessionStorage only.
 * Events are also forwarded to the Meta Pixel when the visitor has consented to it.
 */
export function track(name: string, props: Record<string, unknown> = {}, productId?: string) {
  try {
    metaPixelEvent(name, props);
  } catch {
    /* analytics must never break the page */
  }
  try {
    let sid = sessionStorage.getItem("dh_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("dh_sid", sid);
    }
    const body = JSON.stringify({ name, props, productId, sessionId: sid });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* analytics must never break the page */
  }
}
