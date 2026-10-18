import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, coupons, products } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { ActionForm } from "@/components/ActionForm";
import { formatNaira } from "@/lib/money";
import { saveCouponAction } from "../../actions";

type C = typeof coupons.$inferSelect;
const dt = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

function CouponForm({ c, prods, cats }: { c: C | null; prods: { id: string; name: string }[]; cats: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveCouponAction} submitLabel={c ? "Save code" : "Create code"} className="admin-form">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <label className="fld"><span>Code</span><input name="code" defaultValue={c?.code} required /></label>
      <label className="fld"><span>Type</span><select name="type" defaultValue={c?.type ?? "percent"}><option value="percent">Percentage off</option><option value="fixed">Fixed amount off (₦)</option></select></label>
      <label className="fld"><span>Value (% or ₦)</span><input name="value" type="number" step="0.01" min="0.01" defaultValue={c ? (c.type === "percent" ? c.value : c.value / 100) : ""} required /></label>
      <label className="fld"><span>Minimum spend (₦)</span><input name="minSubtotal" type="number" min={0} defaultValue={c ? c.minSubtotalKobo / 100 : 0} /></label>
      <label className="fld"><span>Starts</span><input name="startsAt" type="datetime-local" defaultValue={dt(c?.startsAt ?? null)} /></label>
      <label className="fld"><span>Expires</span><input name="expiresAt" type="datetime-local" defaultValue={dt(c?.expiresAt ?? null)} /></label>
      <label className="fld"><span>Usage limit (blank = unlimited)</span><input name="usageLimit" type="number" min={1} defaultValue={c?.usageLimit ?? ""} /></label>
      <div className="check"><input type="checkbox" name="isActive" id={`ca-${c?.id ?? "new"}`} defaultChecked={c?.isActive ?? true} /><label htmlFor={`ca-${c?.id ?? "new"}`} style={{ margin: 0 }}>Active</label></div>
      <label className="fld wide"><span>Only for these products (none selected = everything)</span>
        <select name="productIds" multiple size={5} defaultValue={c?.productIds ?? []}>{prods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="fld wide"><span>…or these categories</span>
        <select name="categoryIds" multiple size={3} defaultValue={c?.categoryIds ?? []}>{cats.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    </ActionForm>
  );
}

export default async function AdminCoupons() {
  const me = await requireAdmin();
  const db = await getDb();
  const [rows, prods, cats] = await Promise.all([
    db.select().from(coupons).orderBy(desc(coupons.createdAt)),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return (
    <>
      <h1>Discount codes</h1>
      {me.role !== "owner" && <p className="notice">Only the store owner can create or change discount codes.</p>}
      {rows.map((c) => (
        <details className="panel" key={c.id}>
          <summary>
            <strong>{c.code}</strong> — {c.type === "percent" ? `${c.value}% off` : `${formatNaira(c.value)} off`} · used {c.usageCount}{c.usageLimit ? `/${c.usageLimit}` : ""}{" "}
            <span className={`badge ${c.isActive ? "good" : ""}`}>{c.isActive ? "active" : "inactive"}</span>
          </summary>
          <CouponForm c={c} prods={prods} cats={cats} />
        </details>
      ))}
      <div className="panel"><h2 style={{ marginTop: 0 }}>New discount code</h2><CouponForm c={null} prods={prods} cats={cats} /></div>
    </>
  );
}
