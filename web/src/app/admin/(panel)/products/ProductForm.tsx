import { ActionForm } from "@/components/ActionForm";
import { saveProductAction } from "../../actions";
import type { products } from "@/db/schema";

type P = typeof products.$inferSelect;

export function ProductForm({ p, categories }: { p: P | null; categories: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveProductAction} submitLabel={p ? "Save product" : "Create product"} className="admin-form">
      <input type="hidden" name="id" value={p?.id ?? ""} />
      <label className="fld wide"><span>Name</span><input id="pf-name" name="name" defaultValue={p?.name} required /></label>
      <label className="fld"><span>URL slug</span><input id="pf-slug" name="slug" defaultValue={p?.slug} placeholder="auto from name" /></label>
      <div>
        <label htmlFor="pf-status">Status</label>
        <select id="pf-status" name="status" defaultValue={p?.status ?? "draft"}>
          <option value="draft">Draft (hidden)</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
      </div>
      <div>
        <label htmlFor="pf-kind">Type</label>
        <select id="pf-kind" name="kind" defaultValue={p?.kind ?? "physical"}>
          <option value="physical">Product (sold online)</option><option value="service">Service (booked on WhatsApp)</option>
        </select>
      </div>
      <div>
        <label htmlFor="pf-cat">Category</label>
        <select id="pf-cat" name="categoryId" defaultValue={p?.categoryId ?? ""}>
          <option value="">—</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <label className="fld wide"><span>Description</span><textarea id="pf-desc" name="description" defaultValue={p?.description} /></label>
      <label className="fld wide"><span>Highlights (one per line)</span><textarea id="pf-specs" name="specs" defaultValue={p?.specs.join("\n")} /></label>
      <div>
        <label htmlFor="pf-tex">Texture (filter)</label>
        <select id="pf-tex" name="texture" defaultValue={p?.texture ?? ""}><option value="">—</option><option value="straight">Straight</option><option value="wavy">Wavy</option><option value="curly">Curly</option></select>
      </div>
      <div>
        <label htmlFor="pf-len">Length (filter)</label>
        <select id="pf-len" name="lengthGroup" defaultValue={p?.lengthGroup ?? ""}><option value="">—</option><option value="bob">Bob</option><option value="mid">Mid-length</option><option value="long">Long</option></select>
      </div>
      <div>
        <label htmlFor="pf-col">Colour family (filter)</label>
        <select id="pf-col" name="colorFamily" defaultValue={p?.colorFamily ?? ""}>
          <option value="">—</option>
          {["black", "brown", "blonde", "red", "grey", "fashion"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="check"><input id="pf-feat" type="checkbox" name="isFeatured" defaultChecked={p?.isFeatured} /><label htmlFor="pf-feat" style={{ margin: 0 }}>Featured on homepage</label></div>
      <label className="fld wide"><span>SEO title (optional)</span><input id="pf-seot" name="seoTitle" defaultValue={p?.seoTitle ?? ""} maxLength={70} /></label>
      <label className="fld wide"><span>SEO description (optional)</span><input id="pf-seod" name="seoDescription" defaultValue={p?.seoDescription ?? ""} maxLength={170} /></label>
    </ActionForm>
  );
}
