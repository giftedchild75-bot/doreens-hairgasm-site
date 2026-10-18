import Link from "next/link";
import { getDb } from "@/db/client";
import { listAdminOrders } from "@/server/admin";
import { formatNaira } from "@/lib/money";

const STATUSES = ["pending_payment", "payment_failed", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const f = {
    q: typeof sp.q === "string" ? sp.q : "",
    status: typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "",
    from: typeof sp.from === "string" ? sp.from : "",
    to: typeof sp.to === "string" ? sp.to : "",
    attention: sp.attention === "1",
  };
  const rows = await listAdminOrders(await getDb(), f);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, v === true ? "1" : String(v)])).toString();
  return (
    <>
      <h1>Orders</h1>
      <form className="toolbar">
        <input name="q" defaultValue={f.q} placeholder="Reference, name, email or phone" aria-label="Search orders" />
        <select name="status" defaultValue={f.status} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <label className="muted" style={{ fontSize: 12 }}>From <input type="date" name="from" defaultValue={f.from} /></label>
        <label className="muted" style={{ fontSize: 12 }}>To <input type="date" name="to" defaultValue={f.to} /></label>
        <label className="check"><input type="checkbox" name="attention" value="1" defaultChecked={f.attention} /> Needs attention</label>
        <button className="btn btn-outline btn-sm">Filter</button>
        <a className="mini-link" href={`/admin/orders/export?${qs}`} style={{ marginLeft: "auto" }}>Export CSV</a>
      </form>
      <div className="panel">
        {rows.length === 0 ? <p className="muted">No orders match.</p> : (
          <table className="tbl">
            <thead><tr><th>Reference</th><th>Placed</th><th>Customer</th><th>Status</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td><Link className="mini-link" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                  <td>{o.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td>{o.customerName}<div className="muted" style={{ fontSize: 12 }}>{o.city}, {o.region}</div></td>
                  <td><span className="badge">{o.status.replace(/_/g, " ")}</span></td>
                  <td>{formatNaira(o.totalKobo)}</td>
                  <td>{o.needsAttention && <span className="badge bad">attention</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length === 200 && <p className="muted">Showing the latest 200 — narrow the filters to see older orders.</p>}
      </div>
    </>
  );
}
