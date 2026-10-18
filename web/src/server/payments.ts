/**
 * Payment lifecycle. An order becomes `paid` ONLY after the provider's
 * verify endpoint (or a signature-checked webhook confirmed by verify) reports
 * a successful transaction for the exact amount and currency we expected.
 * Returning to a "success" URL never marks anything paid by itself.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { orders, payments, refunds, webhookEvents } from "@/db/schema";
import { env } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { paymentReference } from "@/lib/tokens";
import * as paystack from "./paystack";
import { queueEmail, renderEmail } from "./email";
import { orderSummaryLines, releaseReservation, transitionOrder, getOrderItems, type Order } from "./orders";
import { audit } from "./audit";

export async function startPayment(db: Db, order: Order) {
  if (order.status !== "pending_payment" && order.status !== "payment_failed") {
    throw new Error("This order can no longer be paid.");
  }
  const reference = paymentReference(order.reference);
  await db.insert(payments).values({
    orderId: order.id,
    provider: "paystack",
    reference,
    amountKobo: order.totalKobo,
    currency: order.currency,
  });
  const init = await paystack.initializeTransaction({
    email: order.email,
    amountKobo: order.totalKobo,
    reference,
    callbackUrl: `${env.siteUrl}/checkout/callback`,
    metadata: { order_reference: order.reference, order_id: order.id },
  });
  return { reference, authorizationUrl: init.authorization_url };
}

export type ApplyResult =
  | { outcome: "paid"; order: Order }
  | { outcome: "already_processed" }
  | { outcome: "failed" }
  | { outcome: "pending" }
  | { outcome: "amount_mismatch" }
  | { outcome: "needs_attention"; reason: string }
  | { outcome: "unknown_reference" };

/** Apply a provider-verified transaction to our records. Idempotent. */
export async function applyVerifiedTransaction(db: Db, tx: paystack.VerifiedTransaction): Promise<ApplyResult> {
  const [payment] = await db.select().from(payments).where(and(eq(payments.provider, "paystack"), eq(payments.reference, tx.reference))).limit(1);
  if (!payment) return { outcome: "unknown_reference" };
  if (payment.status === "success" || payment.status === "amount_mismatch") return { outcome: "already_processed" };

  if (tx.status !== "success") {
    if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
      const status = tx.status === "abandoned" ? "abandoned" : "failed";
      const changed = await db
        .update(payments)
        .set({ status, rawStatus: tx.status, updatedAt: new Date() })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "initialized")))
        .returning({ id: payments.id });
      if (changed.length) {
        const [o] = await db.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
        // Keep the reservation so the customer can retry until the order expires.
        if (o?.status === "pending_payment") await transitionOrder(db, o, "payment_failed", `Payment ${tx.status} (${tx.reference})`);
      }
      return { outcome: "failed" };
    }
    return { outcome: "pending" };
  }

  return db.transaction(async (t) => {
    const [o] = await t.select().from(orders).where(eq(orders.id, payment.orderId)).limit(1);
    const amountOk = tx.amount === payment.amountKobo && tx.amount === o.totalKobo && tx.currency === o.currency;

    // Exactly one caller (webhook vs. callback vs. reconcile) wins this update.
    const won = await t
      .update(payments)
      .set({
        status: amountOk ? "success" : "amount_mismatch",
        rawStatus: tx.status,
        providerTransactionId: String(tx.id),
        channel: tx.channel ?? null,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, payment.id), ne(payments.status, "success"), ne(payments.status, "amount_mismatch")))
      .returning({ id: payments.id });
    if (!won.length) return { outcome: "already_processed" } as const;

    if (!amountOk) {
      const reason = `Payment ${tx.reference} amount ${tx.currency} ${tx.amount} does not match order total ${o.currency} ${o.totalKobo} — not marked paid.`;
      await t.update(orders).set({ needsAttention: reason }).where(eq(orders.id, o.id));
      await audit(t, null, "payment.amount_mismatch", "order", o.id, { reference: tx.reference, amount: tx.amount });
      return { outcome: "amount_mismatch" } as const;
    }

    if (o.status === "pending_payment" || o.status === "payment_failed") {
      const updated = await transitionOrder(t, o, "paid", `Payment verified (${tx.reference})`, { paidAt: new Date(), stockReserved: false });
      if (!updated) return { outcome: "already_processed" } as const;
      await sendPaidEmails(t, updated);
      return { outcome: "paid", order: updated } as const;
    }

    // Money arrived for an order that is already paid or was cancelled/expired.
    const reason =
      o.status === "cancelled"
        ? `Payment ${tx.reference} (${formatNaira(tx.amount)}) arrived after the order was cancelled — refund it or re-open the order manually.`
        : `Additional payment ${tx.reference} (${formatNaira(tx.amount)}) received for an order that was already ${o.status} — likely a duplicate; refund it.`;
    await t.update(orders).set({ needsAttention: reason }).where(eq(orders.id, o.id));
    await audit(t, null, "payment.needs_attention", "order", o.id, { reference: tx.reference, reason });
    return { outcome: "needs_attention", reason } as const;
  });
}

async function sendPaidEmails(db: Parameters<typeof queueEmail>[0], o: Order) {
  const items = await getOrderItems(db, o.id);
  const lines = [
    `Thank you, ${o.customerName}! We've received your payment for order ${o.reference}.`,
    ...items.map((i) => `${i.quantity} × ${i.productName}${i.variantTitle !== "Default" ? ` (${i.variantTitle})` : ""} — ${formatNaira(i.lineTotalKobo)}`),
    ...orderSummaryLines(o),
    `Delivery: ${o.shippingMethodName} to ${o.addressLine1}, ${o.city}, ${o.region}.`,
    "We'll email you again when it ships.",
  ];
  const { html, text } = renderEmail("Order confirmed", lines, { label: "View your order", url: `${env.siteUrl}/account/orders` });
  await queueEmail(db, { to: o.email, template: "order_paid", subject: `Order ${o.reference} confirmed`, html, text, orderId: o.id, dedupeKey: `paid:${o.id}` });

  const notify = process.env.STORE_NOTIFY_EMAIL;
  if (notify) {
    const staff = renderEmail(`New paid order ${o.reference}`, [`${o.customerName} · ${o.phone} · ${o.email}`, ...orderSummaryLines(o)], {
      label: "Open in admin",
      url: `${env.siteUrl}/admin/orders/${o.id}`,
    });
    await queueEmail(db, { to: notify, template: "staff_new_order", subject: `New order ${o.reference} — ${formatNaira(o.totalKobo)}`, ...staff, orderId: o.id, dedupeKey: `staff-paid:${o.id}` });
  }
}

/** Ask Paystack about every unresolved attempt for an order (missed-webhook recovery). */
export async function reconcileOrder(db: Db, orderId: string) {
  if (env.paymentsMode === "disabled") return;
  const attempts = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.status, "initialized")));
  for (const p of attempts) {
    try {
      const tx = await paystack.verifyTransaction(p.reference);
      await applyVerifiedTransaction(db, tx);
    } catch {
      // Provider unreachable: leave as-is; the next reconcile will retry.
    }
  }
}

// ---------------------------------------------------------------- webhooks

export async function handlePaystackWebhook(db: Db, rawBody: string, signature: string | null) {
  if (!paystack.verifyWebhookSignature(rawBody, signature)) return { status: 401 as const, body: "invalid signature" };
  let evt: { event?: string; data?: Record<string, unknown> };
  try {
    evt = JSON.parse(rawBody);
  } catch {
    return { status: 400 as const, body: "bad json" };
  }
  const type = String(evt.event ?? "unknown");
  const data = evt.data ?? {};
  const eventKey = `${type}:${data.id ?? ""}:${data.reference ?? data.transaction_reference ?? ""}`;

  await db.insert(webhookEvents).values({ provider: "paystack", eventKey, eventType: type, payload: evt }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, "paystack"), eq(webhookEvents.eventKey, eventKey)))
    .limit(1);
  if (row.processedAt) return { status: 200 as const, body: "duplicate ignored" };

  if (type === "charge.success" && typeof data.reference === "string") {
    // Defence in depth: confirm with the verify API rather than trusting the payload.
    const tx = await paystack.verifyTransaction(data.reference);
    await applyVerifiedTransaction(db, tx);
  } else if (type.startsWith("refund.")) {
    await applyRefundEvent(db, type, data);
  }
  await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, row.id));
  return { status: 200 as const, body: "ok" };
}

// ---------------------------------------------------------------- refunds

export async function requestRefund(
  db: Db,
  p: { orderId: string; amountKobo: number; reason: string; restock: boolean; actorAdminId: string },
) {
  const [o] = await db.select().from(orders).where(eq(orders.id, p.orderId)).limit(1);
  if (!o) throw new Error("Order not found");
  if (!["paid", "processing", "shipped", "delivered"].includes(o.status)) throw new Error(`Cannot refund an order that is ${o.status}`);
  const [payment] = await db.select().from(payments).where(and(eq(payments.orderId, o.id), eq(payments.status, "success"))).limit(1);
  if (!payment) throw new Error("No successful payment found for this order");
  const [{ refunded }] = await db
    .select({ refunded: sql<number>`COALESCE(SUM(${refunds.amountKobo}), 0)::int` })
    .from(refunds)
    .where(and(eq(refunds.orderId, o.id), inArray(refunds.status, ["pending", "processed"])));
  const remaining = payment.amountKobo - refunded;
  if (!Number.isInteger(p.amountKobo) || p.amountKobo <= 0 || p.amountKobo > remaining) {
    throw new Error(`Refund must be between ₦0.01 and ${formatNaira(remaining)}`);
  }

  const res = await paystack.createRefund({ transactionReference: payment.reference, amountKobo: p.amountKobo, note: p.reason });
  const [refund] = await db
    .insert(refunds)
    .values({
      orderId: o.id,
      paymentId: payment.id,
      amountKobo: p.amountKobo,
      reason: p.reason,
      restock: p.restock,
      actorAdminId: p.actorAdminId,
      providerRefundId: res.id ? String(res.id) : null,
    })
    .returning();
  await audit(db, p.actorAdminId, "refund.requested", "order", o.id, { amountKobo: p.amountKobo, reason: p.reason });
  return refund;
}

async function applyRefundEvent(db: Db, type: string, data: Record<string, unknown>) {
  const providerId = data.id != null ? String(data.id) : null;
  const txRef = typeof data.transaction_reference === "string" ? data.transaction_reference : null;
  let [refund] = providerId
    ? await db.select().from(refunds).where(eq(refunds.providerRefundId, providerId)).limit(1)
    : [];
  if (!refund && txRef) {
    const [payment] = await db.select().from(payments).where(eq(payments.reference, txRef)).limit(1);
    if (payment) {
      [refund] = await db
        .select()
        .from(refunds)
        .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, "pending")))
        .limit(1);
    }
  }
  if (!refund) return;
  if (type === "refund.processed") await markRefundProcessed(db, refund.id);
  else if (type === "refund.failed") {
    await db.update(refunds).set({ status: "failed", updatedAt: new Date() }).where(and(eq(refunds.id, refund.id), eq(refunds.status, "pending")));
  }
}

export async function markRefundProcessed(db: Db, refundId: string) {
  return db.transaction(async (t) => {
    const [r] = await t
      .update(refunds)
      .set({ status: "processed", updatedAt: new Date() })
      .where(and(eq(refunds.id, refundId), eq(refunds.status, "pending")))
      .returning();
    if (!r) return null;
    const [o] = await t.select().from(orders).where(eq(orders.id, r.orderId)).limit(1);
    const [{ total }] = await t
      .select({ total: sql<number>`COALESCE(SUM(${refunds.amountKobo}), 0)::int` })
      .from(refunds)
      .where(and(eq(refunds.orderId, r.orderId), eq(refunds.status, "processed")));
    if (total >= o.totalKobo && o.status !== "refunded") {
      await transitionOrder(t, o, "refunded", `Fully refunded (${formatNaira(total)})`);
    }
    const [{ priorRestocks }] = await t
      .select({ priorRestocks: sql<number>`COUNT(*)::int` })
      .from(refunds)
      .where(and(eq(refunds.orderId, o.id), eq(refunds.status, "processed"), eq(refunds.restock, true), ne(refunds.id, r.id)));
    if (r.restock && priorRestocks === 0) {
      // Restock returns every unit on the order, at most once per order.
      // Paid orders no longer hold a reservation; mark it so release puts units back once.
      await t.update(orders).set({ stockReserved: true }).where(and(eq(orders.id, o.id), eq(orders.stockReserved, false)));
      await releaseReservation(t, o.id, "restock_refund");
    }
    const { html, text } = renderEmail("Your refund has been processed", [
      `We've refunded ${formatNaira(r.amountKobo)} for order ${o.reference}.`,
      "Depending on your bank it can take a few working days to appear.",
    ]);
    await queueEmail(t, { to: o.email, template: "refund_processed", subject: `Refund for order ${o.reference}`, html, text, orderId: o.id, dedupeKey: `refund:${r.id}` });
    return r;
  });
}
