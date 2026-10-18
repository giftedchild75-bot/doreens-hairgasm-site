import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getAdminOrder } from "@/server/admin";
import { STAFF_TRANSITIONS } from "@/server/orders";
import { requireAdmin } from "@/server/auth";
import { ActionForm } from "@/components/ActionForm";
import { formatNaira } from "@/lib/money";
import { env } from "@/lib/env";
import { refundAction, resolveAttentionAction, updateOrderStatusAction } from "../../../actions";

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const data = await getAdminOrder(await getDb(), id);
  if (!data) notFound();
  const { order: o, items, events, payments, refunds, emails } = data;
  const next = STAFF_TRANSITIONS[o.status] ?? [];
  const paid = payments.find((p) => p.status === "success");
  const refundedSoFar = refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amountKobo, 0);
  const canRefund = paid && ["paid", "processing", "shipped", "delivered"].includes(o.status) && refundedSoFar < paid.amountKobo;

  return (
    <>
      <p><Link className="mini-link" href="/admin/orders">← Orders</Link></p>
      <h1>{o.reference} <span className="badge">{o.status.replace(/_/g, " ")}</span></h1>

      {o.needsAttention && (
        <div className="notice error" style={{ marginBottom: 20 }}>
          <strong>Needs attention:</strong> {o.needsAttention}
          <ActionForm action={resolveAttentionAction} submitLabel="Mark resolved" className="admin-form">
            <input type="hidden" name="orderId" value={o.id} />
            <label className="fld wide"><span>What did you do?</span><input name="note" placeholder="e.g. refunded duplicate payment in Paystack dashboard" required /></label>
          </ActionForm>
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Items</h2>
            <table className="tbl"><tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.productName}{i.variantTitle !== "Default" ? ` (${i.variantTitle})` : ""}<div className="muted" style={{ fontSize: 12 }}>{i.sku}{!i.stockTracked && " · stock not tracked — confirm availability"}</div></td>
                  <td>{i.quantity} × {formatNaira(i.unitPriceKobo)}</td>
                  <td>{formatNaira(i.lineTotalKobo)}</td>
                </tr>
              ))}
              <tr><td colSpan={2}>Subtotal</td><td>{formatNaira(o.subtotalKobo)}</td></tr>
              {o.discountKobo > 0 && <tr><td colSpan={2}>Discount {o.couponCode}</td><td>−{formatNaira(o.discountKobo)}</td></tr>}
              <tr><td colSpan={2}>Delivery ({o.shippingMethodName})</td><td>{formatNaira(o.shippingKobo)}</td></tr>
              <tr><td colSpan={2}><strong>Total</strong></td><td><strong>{formatNaira(o.totalKobo)}</strong></td></tr>
            </tbody></table>
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Fulfilment</h2>
            {next.length === 0 ? <p className="muted">No further manual steps for this status.</p> : next.map((to) => (
              <ActionForm key={to} action={updateOrderStatusAction} submitLabel={`Mark ${to.replace(/_/g, " ")}`} className="admin-form">
                <input type="hidden" name="orderId" value={o.id} />
                <input type="hidden" name="to" value={to} />
                {to === "shipped" && (<>
                  <label className="fld"><span>Carrier (optional)</span><input name="carrier" placeholder="e.g. GIG Logistics" /></label>
                  <label className="fld"><span>Tracking number (optional)</span><input name="trackingNumber" /></label>
                </>)}
                {to === "cancelled" && <p className="muted wide" style={{ margin: 0 }}>Cancelling releases any reserved stock. Only unpaid orders can be cancelled here.</p>}
              </ActionForm>
            ))}
            {o.trackingNumber && <p>Tracking: {o.carrier} <strong>{o.trackingNumber}</strong></p>}
          </div>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Payments &amp; refunds</h2>
            <table className="tbl"><tbody>
              {payments.map((p) => (
                <tr key={p.id}><td>{p.reference}</td><td><span className={`badge ${p.status === "success" ? "good" : p.status === "initialized" ? "" : "bad"}`}>{p.status}</span></td><td>{formatNaira(p.amountKobo)}</td><td>{p.channel ?? ""}</td></tr>
              ))}
              {refunds.map((r) => (
                <tr key={r.id}><td>Refund — {r.reason}</td><td><span className={`badge ${r.status === "processed" ? "good" : r.status === "failed" ? "bad" : "warn"}`}>{r.status}</span></td><td>−{formatNaira(r.amountKobo)}</td><td>{r.restock ? "restock" : ""}</td></tr>
              ))}
              {payments.length === 0 && <tr><td className="muted">No payment attempts yet.</td></tr>}
            </tbody></table>
            {canRefund && me.role === "owner" && env.paymentsMode !== "disabled" && (
              <>
                <h2>Issue a refund</h2>
                <ActionForm action={refundAction} submitLabel="Refund via Paystack" className="admin-form">
                  <input type="hidden" name="orderId" value={o.id} />
                  <label className="fld"><span>Amount (₦) — up to {formatNaira(paid!.amountKobo - refundedSoFar)}</span><input name="amount" type="number" step="0.01" min="0.01" max={(paid!.amountKobo - refundedSoFar) / 100} required /></label>
                  <label className="fld"><span>Reason</span><input name="reason" required /></label>
                  <div className="check"><input type="checkbox" name="restock" id="rf-restock" /><label htmlFor="rf-restock" style={{ margin: 0 }}>Put all items back in stock</label></div>
                  <div className="check wide"><input type="checkbox" name="confirm" id="rf-confirm" /><label htmlFor="rf-confirm" style={{ margin: 0 }}>I understand this sends money back to the customer</label></div>
                </ActionForm>
              </>
            )}
            {canRefund && me.role !== "owner" && <p className="muted">Refunds can only be issued by the store owner.</p>}
          </div>
        </div>

        <div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Customer</h2>
            <p>{o.customerName}<br /><a className="mini-link" href={`mailto:${o.email}`}>{o.email}</a><br />
              <a className="mini-link" href={`https://wa.me/${o.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">{o.phone}</a></p>
            <p>{o.addressLine1}<br />{o.city}, {o.region}, {o.country}</p>
            {o.deliveryInstructions && <p className="muted">“{o.deliveryInstructions}”</p>}
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>History</h2>
            <ul className="timeline">
              {events.map((e) => <li key={e.id}>{e.message}<div className="muted" style={{ fontSize: 12 }}>{e.createdAt.toLocaleString("en-NG")}{e.actorAdminId ? " · staff" : ""}</div></li>)}
            </ul>
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Emails</h2>
            {emails.length === 0 ? <p className="muted">None sent.</p> : (
              <table className="tbl"><tbody>{emails.map((m) => <tr key={m.id}><td>{m.template}</td><td><span className={`badge ${m.status === "sent" ? "good" : m.status === "failed" ? "bad" : "warn"}`}>{m.status.replace(/_/g, " ")}</span></td></tr>)}</tbody></table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
