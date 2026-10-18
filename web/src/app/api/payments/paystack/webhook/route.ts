import { getDb } from "@/db/client";
import { handlePaystackWebhook } from "@/server/payments";
import { logError } from "@/server/http";

/**
 * Paystack webhook. The signature is checked against the raw body before
 * anything else; processing is idempotent. A non-2xx makes Paystack retry.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    const res = await handlePaystackWebhook(await getDb(), raw, req.headers.get("x-paystack-signature"));
    return new Response(res.body, { status: res.status });
  } catch (err) {
    logError("webhook processing failed", { err: String(err) });
    return new Response("error", { status: 500 });
  }
}
