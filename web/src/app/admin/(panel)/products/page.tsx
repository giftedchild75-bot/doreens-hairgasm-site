import Link from "next/link";
import { getDb } from "@/db/client";
import { listAdminProducts } from "@/server/admin";
import { formatNaira } from "@/lib/money";

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  const q = String((await searchParams).q ?? "");
  const rows = await listAdminProducts(await getDb(), q);
  return (
    <>
      <h1>Products</h1>
      <form className="toolbar">
        <input name="q" defaultValue={q} placeholder="Search name or SKU" aria-label="Search products" />
        <button className="btn btn-outline btn-sm">Search</button>
        <Link className="btn btn-primary btn-sm" href="/admin/products/new" style={{ marginLeft: "auto" }}>New product</Link>
      </form>
      <div className="panel">
        <table className="tbl">
          <thead><tr><th></th><th>Name</th><th>Category</th><th>Status</th><th>From</th><th>Stock</th><th>Options</th></tr></thead>
          <tbody>
            {rows.map(({ p, category, variants, minPrice, stock, untracked, image }) => (
              <tr key={p.id}>
                <td>{image ? <img src={image} alt="" /> : null}</td>
                <td><Link className="mini-link" href={`/admin/products/${p.id}`}>{p.name}</Link>{p.isFeatured && <> <span className="badge">featured</span></>}</td>
                <td>{category ?? "—"}</td>
                <td><span className={`badge ${p.status === "published" ? "good" : p.status === "draft" ? "warn" : ""}`}>{p.status}</span>{p.kind === "service" && <> <span className="badge">service</span></>}</td>
                <td>{minPrice !== null ? formatNaira(minPrice) : "—"}</td>
                <td>{untracked ? <span className="muted">not tracked</span> : <span className={`badge ${stock === 0 ? "bad" : stock !== null && stock <= 2 ? "warn" : "good"}`}>{stock}</span>}</td>
                <td>{variants}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
