import Link from "next/link";
import { getDb } from "@/db/client";
import { listCustomers } from "@/server/admin";
import { formatNaira } from "@/lib/money";

export default async function AdminCustomers({ searchParams }: PageProps<"/admin/customers">) {
  const q = String((await searchParams).q ?? "");
  const rows = await listCustomers(await getDb(), q);
  return (
    <>
      <h1>Customers</h1>
      <form className="toolbar">
        <input name="q" defaultValue={q} placeholder="Name, email or phone" aria-label="Search customers" />
        <button className="btn btn-outline btn-sm">Search</button>
      </form>
      <div className="panel">
        {rows.length === 0 ? <p className="muted">No customers yet.</p> : (
          <table className="tbl">
            <thead><tr><th>Customer</th><th>Contact</th><th>Account</th><th>Paid orders</th><th>Spent</th></tr></thead>
            <tbody>
              {rows.map(({ c, orders, spent }) => (
                <tr key={c.id}>
                  <td>{c.name ?? "—"}<div className="muted" style={{ fontSize: 12 }}>since {c.createdAt.toLocaleDateString("en-NG")}</div></td>
                  <td>{c.email}<div className="muted" style={{ fontSize: 12 }}>{c.phone}</div></td>
                  <td>{c.passwordHash ? <span className="badge good">registered{c.emailVerifiedAt ? "" : " (unverified)"}</span> : <span className="badge">guest</span>}</td>
                  <td><Link className="mini-link" href={`/admin/orders?q=${encodeURIComponent(c.email)}`}>{orders}</Link></td>
                  <td>{formatNaira(spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
