import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders } from "@/db/schema";
import { requireCustomer } from "@/server/auth";
import { canSeeOrderHistory } from "@/server/customers";
import { formatNaira } from "@/lib/money";
import { ActionForm, Field } from "@/components/ActionForm";
import { logoutAction, profileAction, resendVerificationAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Account", robots: { index: false } };

export default async function AccountPage() {
  const c = await requireCustomer();
  const db = await getDb();
  const verified = canSeeOrderHistory(c);
  const list = verified ? await db.select().from(orders).where(eq(orders.customerId, c.id)).orderBy(desc(orders.createdAt)) : [];

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="page-head">
          <div className="section-eyebrow">Your account</div>
          <h1>Hello{c.name ? `, ${c.name.split(" ")[0]}` : ""}</h1>
          <p>{c.email}</p>
        </div>

        <div className="form-section">
          <h2>Your orders</h2>
          {!verified ? (
            <div className="notice">
              Please confirm your email address to see your order history — we sent you a link when you registered.
              <ActionForm action={resendVerificationAction} submitLabel="Resend confirmation email"><span /></ActionForm>
            </div>
          ) : list.length === 0 ? (
            <p className="muted">No orders yet. <Link className="mini-link" href="/shop">Start shopping</Link></p>
          ) : (
            <table className="spec-table">
              <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id}>
                    <td><Link className="mini-link" href={`/orders/${o.reference}`}>{o.reference}</Link></td>
                    <td>{o.createdAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                    <td><span className="status-pill">{o.status.replace(/_/g, " ")}</span></td>
                    <td>{formatNaira(o.totalKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="form-section">
          <h2>Profile</h2>
          <ActionForm action={profileAction} submitLabel="Save profile">
            <Field name="name" label="Name" autoComplete="name" defaultValue={c.name ?? ""} />
            <Field name="phone" label="Phone" type="tel" autoComplete="tel" defaultValue={c.phone ?? ""} required={false} />
          </ActionForm>
        </div>

        <form action={logoutAction}><button className="btn btn-outline">Sign out</button></form>
      </div>
    </div>
  );
}
