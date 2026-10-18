import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { checkoutInput, fakePaystack, nationwideId, seededDb, signedWebhook, variantFor } from "./helpers";
import type { Db } from "@/db/client";
import { emailMessages, orders, payments, productVariants, refunds, webhookEvents } from "@/db/schema";
import { createOrder, cancelUnpaidOrder, expireStaleOrders } from "@/server/orders";
import {
  applyVerifiedTransaction,
  handlePaystackWebhook,
  markRefundProcessed,
  reconcileOrder,
  requestRefund,
  startPayment,
} from "@/server/payments";
import { setEmailSenderForTesting } from "@/server/email";
import { verifyWebhookSignature } from "@/server/paystack";

let db: Db;
let shipId: string;
let ps: ReturnType<typeof fakePaystack>;

beforeAll(async () => {
  db = await seededDb();
  shipId = await nationwideId(db);
  ps = fakePaystack();
});
afterEach(() => setEmailSenderForTesting(null));

async function newOrder(slug = "alicia", qty = 1, stock: number | null = null) {
  const v = await variantFor(db, slug);
  if (stock !== null) await db.update(productVariants).set({ stockQuantity: stock }).where(eq(productVariants.id, v.id));
  const { order } = await createOrder(db, checkoutInput([{ variantId: v.id, quantity: qty }], shipId));
  const pay = await startPayment(db, order);
  return { order, ...pay, variantId: v.id };
}

const getOrder = async (id: string) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

describe("payment initialisation", () => {
  it("sends the server-computed amount and a unique reference to Paystack", async () => {
    const { order, reference, authorizationUrl } = await newOrder();
    const init = ps.calls.find((c) => c.url.endsWith("/initialize") && (c.body as { reference: string }).reference === reference);
    expect((init!.body as { amount: number }).amount).toBe(order.totalKobo);
    expect((init!.body as { currency: string }).currency).toBe("NGN");
    expect(authorizationUrl).toContain(reference);
  });

  it("refuses to start payment while payments are disabled", async () => {
    const v = await variantFor(db, "alicia");
    const { order } = await createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId));
    process.env.PAYMENTS_ENABLED = "false";
    try {
      await expect(startPayment(db, order)).rejects.toThrow(/not enabled/);
    } finally {
      process.env.PAYMENTS_ENABLED = "true";
    }
  });

  it("treats a live key as disabled until explicitly approved", async () => {
    const { env } = await import("@/lib/env");
    process.env.PAYSTACK_SECRET_KEY = "sk_live_something";
    try {
      expect(env.paymentsMode).toBe("disabled");
      process.env.PAYSTACK_LIVE_APPROVED = "true";
      expect(env.paymentsMode).toBe("live");
    } finally {
      process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_secret";
      delete process.env.PAYSTACK_LIVE_APPROVED;
    }
  });
});

describe("verification", () => {
  it("marks the order paid only after a verified successful charge", async () => {
    const { order, reference } = await newOrder();
    ps.verify.set(reference, { status: "success", amount: order.totalKobo });
    const r = await applyVerifiedTransaction(db, { id: 1, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    expect(r.outcome).toBe("paid");
    const o = await getOrder(order.id);
    expect(o.status).toBe("paid");
    expect(o.paidAt).not.toBeNull();
  });

  it("does not mark paid when the charged amount differs", async () => {
    const { order, reference } = await newOrder();
    const r = await applyVerifiedTransaction(db, { id: 2, status: "success", reference, amount: 100, currency: "NGN" });
    expect(r.outcome).toBe("amount_mismatch");
    const o = await getOrder(order.id);
    expect(o.status).toBe("pending_payment");
    expect(o.needsAttention).toMatch(/does not match/);
  });

  it("does not mark paid on a wrong currency", async () => {
    const { order, reference } = await newOrder();
    const r = await applyVerifiedTransaction(db, { id: 3, status: "success", reference, amount: order.totalKobo, currency: "USD" });
    expect(r.outcome).toBe("amount_mismatch");
    expect((await getOrder(order.id)).status).toBe("pending_payment");
  });

  it("records a failed payment without a paid order and allows retry", async () => {
    const { order, reference } = await newOrder();
    const r = await applyVerifiedTransaction(db, { id: 4, status: "failed", reference, amount: order.totalKobo, currency: "NGN" });
    expect(r.outcome).toBe("failed");
    let o = await getOrder(order.id);
    expect(o.status).toBe("payment_failed");
    expect(o.paidAt).toBeNull();

    const retry = await startPayment(db, o);
    await applyVerifiedTransaction(db, { id: 5, status: "success", reference: retry.reference, amount: order.totalKobo, currency: "NGN" });
    o = await getOrder(order.id);
    expect(o.status).toBe("paid");
  });

  it("leaves the order pending for in-progress transactions", async () => {
    const { order, reference } = await newOrder();
    const r = await applyVerifiedTransaction(db, { id: 6, status: "ongoing", reference, amount: order.totalKobo, currency: "NGN" });
    expect(r.outcome).toBe("pending");
    expect((await getOrder(order.id)).status).toBe("pending_payment");
  });

  it("ignores references we never issued", async () => {
    const r = await applyVerifiedTransaction(db, { id: 7, status: "success", reference: "DH-NOTOURS-1", amount: 1, currency: "NGN" });
    expect(r.outcome).toBe("unknown_reference");
  });

  it("flags money that arrives after the order was cancelled", async () => {
    const { order, reference } = await newOrder();
    await cancelUnpaidOrder(db, order.id, "test");
    const r = await applyVerifiedTransaction(db, { id: 8, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    expect(r.outcome).toBe("needs_attention");
    const o = await getOrder(order.id);
    expect(o.status).toBe("cancelled");
    expect(o.needsAttention).toMatch(/after the order was cancelled/);
  });

  it("flags a second successful payment for an already-paid order", async () => {
    const { order, reference } = await newOrder();
    const second = await startPayment(db, order);
    await applyVerifiedTransaction(db, { id: 9, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    const r = await applyVerifiedTransaction(db, { id: 10, status: "success", reference: second.reference, amount: order.totalKobo, currency: "NGN" });
    expect(r.outcome).toBe("needs_attention");
    expect((await getOrder(order.id)).needsAttention).toMatch(/duplicate/);
  });

  it("reconcile recovers a payment whose webhook never arrived, before expiry cancels it", async () => {
    const { order, reference } = await newOrder("monica", 1, 1);
    ps.verify.set(reference, { status: "success", amount: order.totalKobo });
    const later = new Date(Date.now() + 3 * 3600_000);
    await expireStaleOrders(db, (id) => reconcileOrder(db, id), later);
    const o = await getOrder(order.id);
    expect(o.status).toBe("paid");
    expect((await variantFor(db, "monica")).stockQuantity).toBe(0); // sold, not released
  });
});

describe("webhooks", () => {
  it("rejects unsigned or wrongly-signed deliveries", async () => {
    const { raw } = signedWebhook({ event: "charge.success", data: { reference: "x" } });
    expect((await handlePaystackWebhook(db, raw, null)).status).toBe(401);
    expect((await handlePaystackWebhook(db, raw, "ab".repeat(64))).status).toBe(401);
    expect(verifyWebhookSignature(raw, "zz")).toBe(false);
  });

  it("processes charge.success once even when delivered repeatedly", async () => {
    const { order, reference } = await newOrder("nelly-gold", 1, 5);
    ps.verify.set(reference, { status: "success", amount: order.totalKobo });
    let sent = 0;
    setEmailSenderForTesting(async () => ({ id: `m${++sent}` }));

    const { raw, sig } = signedWebhook({ event: "charge.success", data: { id: 555, reference, amount: order.totalKobo } });
    const results = await Promise.all([1, 2, 3].map(() => handlePaystackWebhook(db, raw, sig)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    await handlePaystackWebhook(db, raw, sig);

    const o = await getOrder(order.id);
    expect(o.status).toBe("paid");
    const evts = await db.select().from(webhookEvents).where(eq(webhookEvents.eventKey, `charge.success:555:${reference}`));
    expect(evts).toHaveLength(1);
    // Stock reserved once (5 → 4), never decremented again by retries.
    expect((await variantFor(db, "nelly-gold")).stockQuantity).toBe(4);
    const mails = await db.select().from(emailMessages).where(eq(emailMessages.orderId, order.id));
    expect(mails.filter((m) => m.template === "order_paid")).toHaveLength(1);
    expect(sent).toBe(1);
  });

  it("does not trust a forged success payload — it re-verifies with Paystack", async () => {
    const { order, reference } = await newOrder();
    ps.verify.set(reference, { status: "failed", amount: order.totalKobo });
    const { raw, sig } = signedWebhook({ event: "charge.success", data: { id: 777, reference } });
    await handlePaystackWebhook(db, raw, sig);
    expect((await getOrder(order.id)).status).toBe("payment_failed");
  });
});

describe("notifications", () => {
  it("records emails as not_configured (never 'sent') without a provider", async () => {
    const { order, reference } = await newOrder();
    await applyVerifiedTransaction(db, { id: 11, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    const [m] = await db.select().from(emailMessages).where(eq(emailMessages.orderId, order.id));
    expect(m.status).toBe("not_configured");
  });

  it("sends nothing for failed payments or unpaid orders", async () => {
    const { order, reference } = await newOrder();
    await applyVerifiedTransaction(db, { id: 12, status: "failed", reference, amount: order.totalKobo, currency: "NGN" });
    expect(await db.select().from(emailMessages).where(eq(emailMessages.orderId, order.id))).toHaveLength(0);
  });

  it("records provider failures honestly", async () => {
    setEmailSenderForTesting(async () => {
      throw new Error("provider down");
    });
    const { order, reference } = await newOrder();
    await applyVerifiedTransaction(db, { id: 13, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    const [m] = await db.select().from(emailMessages).where(eq(emailMessages.orderId, order.id));
    expect(m.status).toBe("failed");
    expect(m.error).toMatch(/provider down/);
    expect((await getOrder(order.id)).status).toBe("paid"); // email failure never undoes a payment
  });
});

describe("refunds", () => {
  async function paidOrder(stock: number) {
    const { order, reference } = await newOrder("riri", 1, stock);
    await applyVerifiedTransaction(db, { id: 20, status: "success", reference, amount: order.totalKobo, currency: "NGN" });
    return getOrder(order.id);
  }
  const admin = crypto.randomUUID();

  it("partial then full refund moves the order to refunded and restocks once", async () => {
    const o = await paidOrder(3); // 3 → 2 after purchase
    expect((await variantFor(db, "riri")).stockQuantity).toBe(2);
    const r1 = await requestRefund(db, { orderId: o.id, amountKobo: 1_000_000, reason: "partial", restock: true, actorAdminId: admin });
    await markRefundProcessed(db, r1.id);
    expect((await getOrder(o.id)).status).toBe("paid");
    expect((await variantFor(db, "riri")).stockQuantity).toBe(3);

    const r2 = await requestRefund(db, { orderId: o.id, amountKobo: o.totalKobo - 1_000_000, reason: "rest", restock: true, actorAdminId: admin });
    await markRefundProcessed(db, r2.id);
    await markRefundProcessed(db, r2.id); // duplicate processing is a no-op
    expect((await getOrder(o.id)).status).toBe("refunded");
    expect((await variantFor(db, "riri")).stockQuantity).toBe(3); // restocked only once
  });

  it("cannot refund more than was paid, or an unpaid order", async () => {
    const o = await paidOrder(10);
    await expect(requestRefund(db, { orderId: o.id, amountKobo: o.totalKobo + 1, reason: "x", restock: false, actorAdminId: admin })).rejects.toThrow(/between/);
    const { order } = await newOrder();
    await expect(requestRefund(db, { orderId: order.id, amountKobo: 100, reason: "x", restock: false, actorAdminId: admin })).rejects.toThrow(/Cannot refund/);
  });

  it("applies refund.processed webhooks idempotently", async () => {
    const o = await paidOrder(10);
    const r = await requestRefund(db, { orderId: o.id, amountKobo: o.totalKobo, reason: "full", restock: false, actorAdminId: admin });
    const { raw, sig } = signedWebhook({ event: "refund.processed", data: { id: Number(r.providerRefundId), status: "processed" } });
    await handlePaystackWebhook(db, raw, sig);
    await handlePaystackWebhook(db, raw, sig);
    const [after] = await db.select().from(refunds).where(eq(refunds.id, r.id));
    expect(after.status).toBe("processed");
    expect((await getOrder(o.id)).status).toBe("refunded");
    const mails = await db.select().from(emailMessages).where(eq(emailMessages.orderId, o.id));
    expect(mails.filter((m) => m.template === "refund_processed")).toHaveLength(1);
  });
});

describe("payments table", () => {
  it("keeps provider references unique", async () => {
    const { order, reference } = await newOrder();
    await expect(
      db.insert(payments).values({ orderId: order.id, provider: "paystack", reference, amountKobo: 1, currency: "NGN" }),
    ).rejects.toThrow();
  });
});
