/**
 * Order creation and the server-controlled order lifecycle.
 *
 *   pending_payment → paid → processing → shipped → delivered
 *          ↓  ↑          ↘
 *   payment_failed      refunded / cancelled
 *
 * Stock for tracked variants is reserved atomically when the order is created
 * (a conditional UPDATE that can never drive stock below zero) and released if
 * the order is cancelled or expires unpaid.
 */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  coupons,
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  payments,
  productVariants,
} from "@/db/schema";
import { orderReference, randomToken, sha256 } from "@/lib/tokens";
import { env } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { quoteCart, quoteInputSchema, type Executor } from "./pricing";
import { queueEmail, renderEmail } from "./email";

export type OrderStatus = (typeof orders.$inferSelect)["status"];
export type Order = typeof orders.$inferSelect;

export class CheckoutError extends Error {
  constructor(message: string, public readonly problems: string[] = [message]) {
    super(message);
  }
}

export const checkoutSchema = quoteInputSchema.extend({
  checkoutKey: z.string().min(16).max(64),
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  addressLine1: z.string().trim().min(4).max(200),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).toUpperCase(),
  deliveryInstructions: z.string().trim().max(500).optional().nullable(),
  shippingMethodId: z.string().uuid({ message: "Choose a delivery method" }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

/** Transitions staff may perform by hand. Payment states are set only by verified payments. */
export const STAFF_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ["cancelled"],
  payment_failed: ["cancelled"],
  paid: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

export async function createOrder(
  db: Db,
  raw: unknown,
  opts: { customerId?: string | null; now?: Date } = {},
): Promise<{ order: Order; accessToken: string; reused: boolean }> {
  const input = checkoutSchema.parse(raw);

  // Idempotency: a double-clicked "Place order" returns the first order.
  const [existing] = await db.select().from(orders).where(eq(orders.checkoutKey, input.checkoutKey)).limit(1);
  if (existing) {
    // Re-issue a fresh access token for the same browser session.
    const accessToken = randomToken();
    await db.update(orders).set({ accessTokenHash: sha256(accessToken) }).where(eq(orders.id, existing.id));
    return { order: { ...existing, accessTokenHash: sha256(accessToken) }, accessToken, reused: true };
  }

  return db.transaction(async (tx) => {
    const quote = await quoteCart(tx, input, opts.now);
    if (quote.problems.length) throw new CheckoutError("Your bag needs attention.", quote.problems);
    if (!quote.selectedShipping) throw new CheckoutError("Choose a delivery method.");
    if (input.couponCode && !quote.coupon?.applied) {
      throw new CheckoutError(quote.coupon?.message ?? "That code isn't valid.");
    }

    // Reserve stock atomically. If another order took the last unit first,
    // this matches zero rows and the whole transaction rolls back.
    for (const line of quote.lines) {
      if (!line.stockTracked) continue;
      const updated = await tx
        .update(productVariants)
        .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${line.quantity}`, updatedAt: new Date() })
        .where(and(eq(productVariants.id, line.variantId), sql`${productVariants.stockQuantity} >= ${line.quantity}`))
        .returning({ id: productVariants.id });
      if (updated.length === 0) {
        throw new CheckoutError(`Sorry — ${line.productName} just sold out.`);
      }
    }

    // Claim a coupon use atomically so a limited code can't be over-redeemed.
    if (quote.coupon?.applied) {
      const claimed = await tx
        .update(coupons)
        .set({ usageCount: sql`${coupons.usageCount} + 1` })
        .where(and(eq(coupons.id, quote.coupon.id), sql`(${coupons.usageLimit} IS NULL OR ${coupons.usageCount} < ${coupons.usageLimit})`))
        .returning({ id: coupons.id });
      if (claimed.length === 0) throw new CheckoutError("That code has reached its usage limit.");
    }

    // Guest checkout: link to (or create) a customer record by email.
    let customerId = opts.customerId ?? null;
    if (!customerId) {
      const [c] = await tx
        .insert(customers)
        .values({ email: input.email, name: input.name, phone: input.phone })
        .onConflictDoUpdate({ target: customers.email, set: { updatedAt: new Date() } })
        .returning({ id: customers.id });
      customerId = c.id;
    }

    const accessToken = randomToken();
    const hasTracked = quote.lines.some((l) => l.stockTracked);
    const [order] = await tx
      .insert(orders)
      .values({
        reference: orderReference(),
        customerId,
        email: input.email,
        customerName: input.name,
        phone: input.phone,
        addressLine1: input.addressLine1,
        city: input.city,
        region: input.region,
        country: input.country,
        deliveryInstructions: input.deliveryInstructions || null,
        shippingMethodId: quote.selectedShipping.id,
        shippingMethodName: quote.selectedShipping.name,
        subtotalKobo: quote.subtotalKobo,
        discountKobo: quote.discountKobo,
        shippingKobo: quote.shippingKobo,
        totalKobo: quote.totalKobo,
        couponId: quote.coupon?.applied ? quote.coupon.id : null,
        couponCode: quote.coupon?.applied ? quote.coupon.code : null,
        stockReserved: hasTracked,
        accessTokenHash: sha256(accessToken),
        checkoutKey: input.checkoutKey,
      })
      .returning();

    await tx.insert(orderItems).values(
      quote.lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        variantTitle: l.variantTitle,
        sku: l.sku,
        unitPriceKobo: l.unitPriceKobo,
        quantity: l.quantity,
        stockTracked: l.stockTracked,
        lineTotalKobo: l.lineTotalKobo,
      })),
    );
    const tracked = quote.lines.filter((l) => l.stockTracked);
    if (tracked.length) {
      await tx.insert(inventoryMovements).values(
        tracked.map((l) => ({ variantId: l.variantId, delta: -l.quantity, reason: "reservation" as const, orderId: order.id })),
      );
    }
    await tx.insert(orderEvents).values({ orderId: order.id, toStatus: "pending_payment", message: "Order placed, awaiting payment" });
    return { order, accessToken, reused: false };
  });
}

/** Puts reserved stock back (once). Safe to call repeatedly. */
export async function releaseReservation(tx: Executor, orderId: string, reason: "release" | "restock_refund" = "release") {
  const [flip] = await tx
    .update(orders)
    .set({ stockReserved: false })
    .where(and(eq(orders.id, orderId), eq(orders.stockReserved, true)))
    .returning({ id: orders.id });
  if (!flip) return false;
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const it of items) {
    if (!it.stockTracked || !it.variantId) continue;
    await tx
      .update(productVariants)
      .set({ stockQuantity: sql`${productVariants.stockQuantity} + ${it.quantity}`, updatedAt: new Date() })
      .where(and(eq(productVariants.id, it.variantId), sql`${productVariants.stockQuantity} IS NOT NULL`));
    await tx.insert(inventoryMovements).values({ variantId: it.variantId, delta: it.quantity, reason, orderId });
  }
  return true;
}

/**
 * Conditional status change. Returns the updated order, or null if the order
 * was not in `from` any more (someone else moved it first).
 */
export async function transitionOrder(
  tx: Executor,
  order: Pick<Order, "id" | "status">,
  to: OrderStatus,
  message: string,
  extra: Partial<typeof orders.$inferInsert> = {},
  actorAdminId: string | null = null,
): Promise<Order | null> {
  if (!canTransition(order.status, to)) {
    throw new Error(`Illegal order transition ${order.status} → ${to}`);
  }
  const [updated] = await tx
    .update(orders)
    .set({ ...extra, status: to, updatedAt: new Date() })
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
    .returning();
  if (!updated) return null;
  await tx.insert(orderEvents).values({ orderId: order.id, fromStatus: order.status, toStatus: to, message, actorAdminId });
  return updated;
}

/** Cancel an unpaid order: status change + stock release + coupon use returned. */
export async function cancelUnpaidOrder(db: Db, orderId: string, message: string, actorAdminId: string | null = null) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!o || (o.status !== "pending_payment" && o.status !== "payment_failed")) return null;
    const updated = await transitionOrder(tx, o, "cancelled", message, {}, actorAdminId);
    if (!updated) return null;
    await releaseReservation(tx, o.id);
    if (o.couponId) {
      await tx
        .update(coupons)
        .set({ usageCount: sql`GREATEST(${coupons.usageCount} - 1, 0)` })
        .where(eq(coupons.id, o.couponId));
    }
    return updated;
  });
}

/**
 * Cancels orders left unpaid past the reservation window. Before cancelling,
 * `reconcile` (payment verification against the provider) gets a chance to
 * discover a payment whose webhook never arrived.
 */
export async function expireStaleOrders(
  db: Db,
  reconcile: (orderId: string) => Promise<void>,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - env.reservationMinutes * 60_000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(inArray(orders.status, ["pending_payment", "payment_failed"]), lt(orders.createdAt, cutoff)));
  let cancelled = 0;
  for (const { id } of stale) {
    const hasAttempt = await db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, id)).limit(1);
    if (hasAttempt.length) await reconcile(id);
    const r = await cancelUnpaidOrder(db, id, "Expired: not paid within the reservation window");
    if (r) cancelled++;
  }
  return { checked: stale.length, cancelled };
}

export async function getOrderByReference(db: Executor, reference: string) {
  const [o] = await db.select().from(orders).where(eq(orders.reference, reference)).limit(1);
  return o ?? null;
}

export async function getOrderItems(db: Executor, orderId: string) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

/** Guest access check for /orders/[reference]?t=… links. */
export function orderAccessOk(order: Pick<Order, "accessTokenHash">, token: string | null | undefined) {
  return !!token && sha256(token) === order.accessTokenHash;
}

// ---------------------------------------------------------------- staff actions

export async function staffUpdateStatus(
  db: Db,
  orderId: string,
  to: OrderStatus,
  actorAdminId: string,
  opts: { trackingNumber?: string | null; carrier?: string | null } = {},
) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) throw new Error("Order not found");
  if (!(STAFF_TRANSITIONS[o.status] ?? []).includes(to)) {
    throw new Error(`Staff cannot move an order from ${o.status} to ${to}`);
  }
  if (to === "cancelled") return cancelUnpaidOrder(db, o.id, "Cancelled by staff", actorAdminId);

  const extra: Partial<typeof orders.$inferInsert> = {};
  if (to === "shipped") {
    extra.trackingNumber = opts.trackingNumber?.trim() || null;
    extra.carrier = opts.carrier?.trim() || null;
  }
  const updated = await transitionOrder(db, o, to, `Marked ${to} by staff`, extra, actorAdminId);
  if (!updated) throw new Error("Order changed while you were editing — reload and try again.");

  const link = `${env.siteUrl}/account/orders`;
  if (to === "shipped") {
    const lines = [
      `Good news — order ${o.reference} is on its way via ${o.shippingMethodName}.`,
      updated.trackingNumber
        ? `Tracking: ${updated.carrier ? updated.carrier + " " : ""}${updated.trackingNumber}`
        : "We'll be in touch on WhatsApp with delivery updates.",
    ];
    const { html, text } = renderEmail("Your order has shipped", lines, { label: "View your orders", url: link });
    await queueEmail(db, { to: o.email, template: "order_shipped", subject: `Your order ${o.reference} has shipped`, html, text, orderId: o.id, dedupeKey: `shipped:${o.id}` });
  } else if (to === "delivered") {
    const { html, text } = renderEmail("Your order was delivered", [
      `Order ${o.reference} has been marked as delivered. We hope you love it!`,
      "If anything isn't right, just reply on WhatsApp.",
    ]);
    await queueEmail(db, { to: o.email, template: "order_delivered", subject: `Order ${o.reference} delivered`, html, text, orderId: o.id, dedupeKey: `delivered:${o.id}` });
  }
  return updated;
}

export function orderSummaryLines(o: Pick<Order, "subtotalKobo" | "discountKobo" | "shippingKobo" | "totalKobo">) {
  return [
    `Subtotal: ${formatNaira(o.subtotalKobo)}`,
    ...(o.discountKobo ? [`Discount: −${formatNaira(o.discountKobo)}`] : []),
    `Delivery: ${formatNaira(o.shippingKobo)}`,
    `Total: ${formatNaira(o.totalKobo)}`,
  ];
}
