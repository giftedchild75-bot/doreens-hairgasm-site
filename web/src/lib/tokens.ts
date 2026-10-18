import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// No 0/O/1/I so references read cleanly over the phone or WhatsApp.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Human-facing order reference, e.g. DH-7K3Q9PXA (32^8 ≈ 1.1e12 space). */
export function orderReference(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `DH-${s}`;
}

/** Payment-attempt reference sent to the provider (unique per attempt). */
export function paymentReference(orderRef: string): string {
  return `${orderRef}-${randomBytes(4).toString("hex")}`;
}

/**
 * Secret link token for a guest's order page: HMAC(ORDER_LINK_SECRET, orderId).
 * Deterministic, so emails sent later (payment, dispatch) can include the same
 * link without the raw token ever being stored.
 */
export function orderLinkToken(orderId: string): string {
  let secret = process.env.ORDER_LINK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("ORDER_LINK_SECRET must be set in production");
    secret = "dev-only-order-link-secret";
  }
  return createHmac("sha256", secret).update(orderId).digest("base64url");
}
