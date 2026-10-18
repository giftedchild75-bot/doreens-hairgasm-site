import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderEvents } from "@/db/schema";
import { getOrderByReference, getOrderItems, orderAccessOk } from "@/server/orders";
import { rememberedToken } from "@/server/orderAccess";
import { currentCustomer } from "@/server/auth";
import { formatNaira } from "@/lib/money";
import { env, whatsappLink } from "@/lib/env";
import { PayAgainButton } from "@/components/PayAgainButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Order", robots: { index: false } };

const STATUS_COPY: Record<string, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment didn't go through",
  paid: "Paid — preparing your order",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export default async function OrderPage({ params, searchParams }: PageProps<"/orders/[reference]">) {
  const { reference } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const order = await getOrderByReference(db, reference);
  if (!order) notFound();

  // Access: link token (from email), remembered cookie (same browser), or the signed-in owner.
  const linkToken = typeof sp.t === "string" ? sp.t : null;
  const customer = await currentCustomer();
  const viaLink = orderAccessOk(order, linkToken);
  const allowed = viaLink || orderAccessOk(order, await rememberedToken(reference)) || (customer && customer.emailVerifiedAt && customer.id === order.customerId);
  if (!allowed) notFound();

  const [items, events] = await Promise.all([
    getOrderItems(db, order.id),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.createdAt)),
  ]);
  const unpaid = order.status === "pending_payment" || order.status === "payment_failed";
  const fromPayment = sp.from === "payment";

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="page-head">
          <div className="section-eyebrow">Order {order.reference}</div>
          <h1>{STATUS_COPY[order.status]}</h1>
          <p><span className="status-pill">{order.status.replace(/_/g, " ")}</span></p>
        </div>

        {order.status === "paid" && fromPayment && (
          <p className="notice success" role="status">Thank you! Your payment has been verified and your order is confirmed.</p>
        )}
        {unpaid && fromPayment && (
          <p className="notice" role="status">
            We haven&apos;t been able to confirm your payment yet. If you completed it, this page will update within a few minutes —
            you won&apos;t be charged twice. Otherwise you can try again below.
          </p>
        )}
        {unpaid && env.paymentsMode !== "disabled" && (
          <div style={{ textAlign: "center", margin: "24px 0" }}>
            <PayAgainButton reference={order.reference} label={`Pay ${formatNaira(order.totalKobo)}`} />
            <p className="muted" style={{ fontSize: 13 }}>Items are held for you for a limited time while payment is pending.</p>
          </div>
        )}

        <div className="form-section">
          <h2>Items</h2>
          {items.map((i) => (
            <div className="summary-row" key={i.id}>
              <span>{i.quantity} × {i.productName}{i.variantTitle !== "Default" ? ` (${i.variantTitle})` : ""}</span>
              <span>{formatNaira(i.lineTotalKobo)}</span>
            </div>
          ))}
          <div className="summary-row" style={{ borderTop: "1px solid var(--line)", marginTop: 8 }}><span>Subtotal</span><span>{formatNaira(order.subtotalKobo)}</span></div>
          {order.discountKobo > 0 && <div className="summary-row"><span>Discount ({order.couponCode})</span><span>−{formatNaira(order.discountKobo)}</span></div>}
          <div className="summary-row"><span>Delivery — {order.shippingMethodName}</span><span>{formatNaira(order.shippingKobo)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatNaira(order.totalKobo)}</span></div>
        </div>

        <div className="form-section">
          <h2>Delivery</h2>
          <p className="muted">
            {order.customerName}<br />{order.addressLine1}<br />{order.city}, {order.region}, {order.country}
          </p>
          {order.trackingNumber && <p>Tracking: {order.carrier ? `${order.carrier} ` : ""}<strong>{order.trackingNumber}</strong></p>}
        </div>

        <div className="form-section">
          <h2>History</h2>
          <ul className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.toStatus ? STATUS_COPY[e.toStatus] : "Update"}</strong>{" "}
                <span className="muted">· {e.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        </div>

        <p style={{ textAlign: "center" }}>
          Questions about this order?{" "}
          <a className="mini-link" href={whatsappLink(`Hi Doreen! A question about my order ${order.reference}.`)} target="_blank" rel="noopener">Message us on WhatsApp</a>
          {" · "}<Link className="mini-link" href="/shop">Continue shopping</Link>
        </p>
      </div>
    </div>
  );
}
