import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shippingMethods } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { formatNaira } from "@/lib/money";
import { saveShippingAction } from "../../actions";

type M = typeof shippingMethods.$inferSelect;

function MethodForm({ m }: { m: M | null }) {
  return (
    <ActionForm action={saveShippingAction} submitLabel={m ? "Save" : "Add delivery method"} className="admin-form">
      <input type="hidden" name="id" value={m?.id ?? ""} />
      <label className="fld"><span>Name shown to customers</span><input name="name" defaultValue={m?.name} required /></label>
      <label className="fld"><span>Fee (₦)</span><input name="fee" type="number" min={0} step="0.01" defaultValue={m ? m.feeKobo / 100 : ""} required /></label>
      <label className="fld"><span>Country code (NG, GB… or * for all others)</span><input name="country" defaultValue={m?.country ?? "NG"} required /></label>
      <label className="fld"><span>States/regions (comma-separated; blank = whole country)</span><input name="regions" defaultValue={m?.regions.join(", ")} /></label>
      <label className="fld"><span>Estimated delivery time</span><input name="estimatedDays" defaultValue={m?.estimatedDays ?? ""} placeholder="e.g. 2–4 working days" /></label>
      <label className="fld"><span>Order</span><input name="sortOrder" type="number" min={0} defaultValue={m?.sortOrder ?? 0} /></label>
      <label className="fld wide"><span>Note shown at checkout</span><input name="description" defaultValue={m?.description ?? ""} /></label>
      <div className="check"><input type="checkbox" name="isActive" id={`sa-${m?.id ?? "new"}`} defaultChecked={m?.isActive ?? false} /><label htmlFor={`sa-${m?.id ?? "new"}`} style={{ margin: 0 }}>Offer at checkout</label></div>
    </ActionForm>
  );
}

export default async function AdminShipping() {
  const rows = await (await getDb()).select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder));
  const active = rows.filter((r) => r.isActive).length;
  return (
    <>
      <h1>Delivery</h1>
      {active === 0 && (
        <p className="notice error">No delivery method is switched on, so online checkout cannot complete. Enter your real fees and tick “Offer at checkout”.</p>
      )}
      <p className="muted">Fulfilment is manual: you arrange the courier and add tracking on the order page. Live courier tracking isn’t connected.</p>
      {rows.map((m) => (
        <details className="panel" key={m.id} open={!m.isActive}>
          <summary>{m.name} — {formatNaira(m.feeKobo)} · {m.country}{m.regions.length ? ` (${m.regions.join(", ")})` : ""} <span className={`badge ${m.isActive ? "good" : ""}`}>{m.isActive ? "on" : "off"}</span></summary>
          <MethodForm m={m} />
        </details>
      ))}
      <div className="panel"><h2 style={{ marginTop: 0 }}>New delivery method</h2><MethodForm m={null} /></div>
    </>
  );
}
