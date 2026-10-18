import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { saveCategoryAction } from "../../actions";

type C = typeof categories.$inferSelect;

function CategoryForm({ c }: { c: C | null }) {
  return (
    <ActionForm action={saveCategoryAction} submitLabel={c ? "Save" : "Add category"} className="admin-form">
      <input type="hidden" name="id" value={c?.id ?? ""} />
      <label className="fld"><span>Name</span><input name="name" defaultValue={c?.name} required /></label>
      <label className="fld"><span>Description</span><input name="description" defaultValue={c?.description ?? ""} /></label>
      <label className="fld"><span>Order</span><input name="sortOrder" type="number" min={0} defaultValue={c?.sortOrder ?? 0} /></label>
      <div className="check"><input type="checkbox" name="isVisible" id={`cv-${c?.id ?? "new"}`} defaultChecked={c ? c.isVisible : true} /><label htmlFor={`cv-${c?.id ?? "new"}`} style={{ margin: 0 }}>Show in shop</label></div>
    </ActionForm>
  );
}

export default async function AdminCategories() {
  const rows = await (await getDb()).select().from(categories).orderBy(asc(categories.sortOrder));
  return (
    <>
      <h1>Categories</h1>
      <p className="muted">Categories with no published products are hidden from shoppers automatically.</p>
      {rows.map((c) => (
        <div className="panel" key={c.id}><strong>/{c.slug}</strong><CategoryForm c={c} /></div>
      ))}
      <div className="panel"><h2 style={{ marginTop: 0 }}>New category</h2><CategoryForm c={null} /></div>
    </>
  );
}
