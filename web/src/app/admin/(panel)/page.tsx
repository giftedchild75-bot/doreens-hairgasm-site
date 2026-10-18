import Link from "next/link";
import { getDb } from "@/db/client";
import { dashboardMetrics } from "@/server/admin";
import { expireStaleOrders } from "@/server/orders";
import { reconcileOrder } from "@/server/payments";
import { formatNaira } from "@/lib/money";
import { env } from "@/lib/env";

const RANGES: Record<string, [string, number]> = { "7d": ["Last 7 days", 7], "30d": ["Last 30 days", 30], "90d": ["Last 90 days", 90], "365d": ["Last 12 months", 365] };

export default async function Dashboard({ searchParams }: PageProps<"/admin">) {
  const r = String((await searchParams).range ?? "30d");
  const [label, days] = RANGES[r] ?? RANGES["30d"];
  const db = await getDb();
  // Opportunistic housekeeping so expired reservations don't linger between cron runs.
  await expireStaleOrders(db, (id) => reconcileOrder(db, id)).catch(() => {});
  const to = new Date();
  const m = await dashboardMetrics(db, new Date(to.getTime() - days * 86400_000), to);
  const ev = (n: string) => m.funnel.find((f) => f.name === n)?.sessions ?? 0;

  return (
    <>
      <h1>Dashboard</h1>
      {env.paymentsMode !== "live" && (
        <p className="notice" style={{ marginBottom: 16 }}>
          Payments are <strong>{env.paymentsMode}</strong>.{" "}
          {env.paymentsMode === "disabled" ? "Checkout is closed; customers are directed to WhatsApp." : "Paystack sandbox — no real money moves."}
        </p>
      )}
      {m.attention > 0 && (
        <p className="notice error" style={{ marginBottom: 16 }}>
          {m.attention} order{m.attention > 1 ? "s need" : " needs"} attention (payment anomalies). <Link className="mini-link" href="/admin/orders?attention=1">Review</Link>
        </p>
      )}
      <form className="toolbar">
        <select name="range" defaultValue={r} aria-label="Period">
          {Object.entries(RANGES).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn btn-outline btn-sm">Update</button>
      </form>
      <div className="kpis">
        <div className="kpi"><div className="label">Paid revenue</div><div className="value">{formatNaira(m.grossPaidKobo)}</div><div className="sub">{label} · verified payments only</div></div>
        <div className="kpi"><div className="label">Refunded</div><div className="value">{formatNaira(m.refundedKobo)}</div><div className="sub">Net {formatNaira(m.netKobo)}</div></div>
        <div className="kpi"><div className="label">Paid orders</div><div className="value">{m.paidOrders}</div><div className="sub">Avg {formatNaira(m.averageOrderKobo)}</div></div>
        <div className="kpi"><div className="label">Awaiting payment</div><div className="value">{m.pendingCount}</div><div className="sub">{formatNaira(m.pendingValueKobo)} not yet paid</div></div>
        <div className="kpi"><div className="label">To fulfil</div><div className="value">{m.toFulfil}</div><div className="sub"><Link href="/admin/orders?status=paid">Paid, not shipped</Link></div></div>
        <div className="kpi"><div className="label">Cancelled</div><div className="value">{m.cancelledCount}</div><div className="sub">{label}</div></div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Recent orders</h2>
          {m.recent.length === 0 ? <p className="muted">No orders yet.</p> : (
            <table className="tbl"><tbody>
              {m.recent.map((o) => (
                <tr key={o.id}>
                  <td><Link className="mini-link" href={`/admin/orders/${o.id}`}>{o.reference}</Link></td>
                  <td>{o.customerName}</td>
                  <td><span className="badge">{o.status.replace(/_/g, " ")}</span></td>
                  <td>{formatNaira(o.totalKobo)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Bestsellers</h2>
            {m.bestsellers.length === 0 ? <p className="muted">No paid orders in this period.</p> : (
              <table className="tbl"><tbody>{m.bestsellers.map((b) => <tr key={b.name}><td>{b.name}</td><td>{b.units} sold</td><td>{formatNaira(b.revenue)}</td></tr>)}</tbody></table>
            )}
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Low stock</h2>
            {m.lowStock.length === 0 ? <p className="muted">Nothing low. (Only options with stock tracking switched on are checked.)</p> : (
              <table className="tbl"><tbody>{m.lowStock.map((v) => <tr key={v.id}><td><Link className="mini-link" href={`/admin/products/${v.productId}`}>{v.name}</Link> {v.title !== "Default" ? `(${v.title})` : ""}</td><td><span className={`badge ${v.stock === 0 ? "bad" : "warn"}`}>{v.stock} left</span></td></tr>)}</tbody></table>
            )}
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Shopper activity</h2>
            <p className="muted" style={{ fontSize: 12 }}>Unique browsing sessions, {label.toLowerCase()} (first-party, cookie-less).</p>
            <table className="tbl"><tbody>
              <tr><td>Viewed a product</td><td>{ev("product_view")}</td></tr>
              <tr><td>Searched / filtered</td><td>{ev("search") + ev("filter")}</td></tr>
              <tr><td>Added to bag</td><td>{ev("add_to_cart")}</td></tr>
              <tr><td>Started checkout</td><td>{ev("checkout_start")}</td></tr>
              <tr><td>Paid orders (verified)</td><td>{m.paidOrders}</td></tr>
            </tbody></table>
          </div>
        </div>
      </div>
    </>
  );
}
