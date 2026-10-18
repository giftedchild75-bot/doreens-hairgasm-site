import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, inventoryMovements, productImages, products, productVariants } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { formatNaira } from "@/lib/money";
import { ProductForm } from "../ProductForm";
import { adjustStockAction, moveImageAction, removeImageAction, saveVariantAction, uploadImageAction } from "../../../actions";

type V = typeof productVariants.$inferSelect;

function VariantForm({ productId, v }: { productId: string; v: V | null }) {
  return (
    <ActionForm action={saveVariantAction} submitLabel={v ? "Save option" : "Add option"} className="admin-form">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={v?.id ?? ""} />
      <label className="fld"><span>Option name</span><input name="title" defaultValue={v?.title ?? ""} placeholder='e.g. 26" / Default' required /></label>
      <label className="fld"><span>SKU</span><input name="sku" defaultValue={v?.sku ?? ""} required /></label>
      <label className="fld"><span>Price (₦)</span><input name="price" type="number" min={0} step="0.01" defaultValue={v ? v.priceKobo / 100 : ""} required /></label>
      <label className="fld"><span>Sale price (₦, optional)</span><input name="salePrice" type="number" min={0} step="0.01" defaultValue={v?.salePriceKobo != null ? v.salePriceKobo / 100 : ""} /></label>
      <label className="fld"><span>Length (inches)</span><input name="lengthInches" type="number" min={1} max={60} defaultValue={v?.lengthInches ?? ""} /></label>
      <label className="fld"><span>Colour</span><input name="color" defaultValue={v?.color ?? ""} /></label>
      <label className="fld"><span>Density</span><input name="density" defaultValue={v?.density ?? ""} /></label>
      <label className="fld"><span>Lace type</span><input name="laceType" defaultValue={v?.laceType ?? ""} /></label>
      <label className="fld"><span>Cap size</span><input name="capSize" defaultValue={v?.capSize ?? ""} /></label>
      <div className="check"><input type="checkbox" name="trackStock" id={`ts-${v?.id ?? "new"}`} defaultChecked={v ? v.stockQuantity !== null : false} /><label htmlFor={`ts-${v?.id ?? "new"}`} style={{ margin: 0 }}>Track stock</label></div>
      <div className="check"><input type="checkbox" name="isActive" id={`ia-${v?.id ?? "new"}`} defaultChecked={v ? v.isActive : true} /><label htmlFor={`ia-${v?.id ?? "new"}`} style={{ margin: 0 }}>Available</label></div>
    </ActionForm>
  );
}

export default async function EditProduct({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const db = await getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) notFound();
  const [cats, variants, images] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.position), asc(productVariants.createdAt)),
    db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.position)),
  ]);
  const moves = variants.length
    ? await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, variants[0].id)).orderBy(desc(inventoryMovements.createdAt)).limit(10)
    : [];

  return (
    <>
      <p><Link className="mini-link" href="/admin/products">← Products</Link></p>
      <h1>{p.name} <span className={`badge ${p.status === "published" ? "good" : "warn"}`}>{p.status}</span></h1>
      <p><Link className="mini-link" href={`/products/${p.slug}?preview=1`} target="_blank">Preview product page ↗</Link></p>

      <div className="panel"><h2 style={{ marginTop: 0 }}>Details</h2><ProductForm p={p} categories={cats} /></div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Photos</h2>
        <div className="img-row">
          {images.map((img, i) => (
            <figure key={img.id}>
              <img src={img.url} alt={img.alt} />
              <div className="ops">
                <form action={moveImageAction}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="dir" value="up" /><button disabled={i === 0} aria-label="Move earlier">←</button></form>
                <form action={moveImageAction}><input type="hidden" name="imageId" value={img.id} /><input type="hidden" name="dir" value="down" /><button disabled={i === images.length - 1} aria-label="Move later">→</button></form>
                <form action={removeImageAction}><input type="hidden" name="imageId" value={img.id} /><button aria-label="Remove photo">✕</button></form>
              </div>
            </figure>
          ))}
          {images.length === 0 && <p className="muted">No photos yet.</p>}
        </div>
        <ActionForm action={uploadImageAction} submitLabel="Upload photo" className="admin-form">
          <input type="hidden" name="productId" value={p.id} />
          <label className="fld"><span>Image (JPEG, PNG or WebP, max 4 MB)</span><input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
          <label className="fld"><span>Alt text (describe the photo)</span><input name="alt" defaultValue={p.name} /></label>
        </ActionForm>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Options, pricing &amp; stock</h2>
        {variants.map((v) => (
          <details key={v.id} className="panel" open={variants.length === 1}>
            <summary>
              {v.title} · {v.sku} · {formatNaira(v.salePriceKobo ?? v.priceKobo)}{" "}
              {v.stockQuantity === null ? <span className="badge">stock not tracked</span> : <span className={`badge ${v.stockQuantity === 0 ? "bad" : "good"}`}>{v.stockQuantity} in stock</span>}
              {!v.isActive && <> <span className="badge bad">unavailable</span></>}
            </summary>
            <VariantForm productId={p.id} v={v} />
            {v.stockQuantity !== null && (
              <ActionForm action={adjustStockAction} submitLabel="Adjust stock" className="admin-form">
                <input type="hidden" name="variantId" value={v.id} />
                <label className="fld"><span>Change (+ received, − removed)</span><input name="delta" type="number" step={1} required /></label>
                <label className="fld"><span>Note</span><input name="note" placeholder="e.g. new delivery from supplier" /></label>
              </ActionForm>
            )}
          </details>
        ))}
        <details className="panel" open={variants.length === 0}>
          <summary>Add another option (e.g. a different length or colour)</summary>
          <VariantForm productId={p.id} v={null} />
        </details>
        {moves.length > 0 && (
          <>
            <h2>Recent stock movements ({variants[0].title})</h2>
            <table className="tbl"><tbody>{moves.map((m) => <tr key={m.id}><td>{m.createdAt.toLocaleString("en-NG")}</td><td>{m.reason}</td><td>{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td>{m.note}</td></tr>)}</tbody></table>
          </>
        )}
      </div>
    </>
  );
}
