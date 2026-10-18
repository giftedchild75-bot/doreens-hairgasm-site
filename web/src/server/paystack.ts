/**
 * Minimal Paystack API client (https://paystack.com/docs/api/).
 * The secret key is server-only; the browser is only ever given the hosted
 * checkout URL returned by /transaction/initialize.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const OFFICIAL = "https://api.paystack.co";
/** PAYSTACK_BASE_URL exists only so end-to-end tests can use a local mock; live keys always use Paystack. */
const base = () => (env.paymentsMode === "live" ? OFFICIAL : (process.env.PAYSTACK_BASE_URL ?? OFFICIAL));

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchLike = (url, init) => fetch(url, init);
/** Test hook: route Paystack HTTP calls to a fake. */
export function setPaystackFetchForTesting(f: FetchLike | null) {
  fetchImpl = f ?? ((url, init) => fetch(url, init));
}

export class PaymentsDisabledError extends Error {
  constructor() {
    super("Online payments are not enabled yet.");
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (env.paymentsMode === "disabled") throw new PaymentsDisabledError();
  const res = await fetchImpl(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.paystackSecret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status) {
    throw new Error(`Paystack ${path} failed (${res.status}): ${body?.message ?? "no response body"}`);
  }
  return body.data as T;
}

export async function initializeTransaction(p: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: p.email,
      amount: p.amountKobo,
      currency: "NGN",
      reference: p.reference,
      callback_url: p.callbackUrl,
      metadata: p.metadata,
    }),
  });
}

export interface VerifiedTransaction {
  id: number;
  status: string; // success | failed | abandoned | ongoing | pending | reversed
  reference: string;
  amount: number; // kobo
  currency: string;
  channel?: string;
  paid_at?: string | null;
}

export async function verifyTransaction(reference: string) {
  return call<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createRefund(p: { transactionReference: string; amountKobo: number; note?: string }) {
  return call<{ id?: number; status?: string; transaction?: { reference?: string } }>("/refund", {
    method: "POST",
    body: JSON.stringify({ transaction: p.transactionReference, amount: p.amountKobo, merchant_note: p.note }),
  });
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = env.paystackSecret) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
