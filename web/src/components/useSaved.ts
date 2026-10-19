"use client";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Pieces a shopper has hearted. Kept in this browser only — a convenience, not
 * account data — and synced across tabs/components via a custom event.
 */
const KEY = "dh_saved";
const EVENT = "dh-saved-change";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

let cache = "[]";
function snapshot() {
  const next = JSON.stringify(read());
  if (next !== cache) cache = next;
  return cache;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSaved() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const slugs: string[] = JSON.parse(raw);
  const toggle = useCallback((slug: string) => {
    const list = read();
    const next = list.includes(slug) ? list.filter((s) => s !== slug) : [slug, ...list].slice(0, 24);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { slugs, has: (slug: string) => slugs.includes(slug), toggle };
}
