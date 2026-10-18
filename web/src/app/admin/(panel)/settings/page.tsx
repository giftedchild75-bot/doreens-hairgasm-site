import { getDb } from "@/db/client";
import { storeSettings } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { env } from "@/lib/env";
import { saveSettingsAction } from "../../actions";

export default async function AdminSettings() {
  const rows = await (await getDb()).select().from(storeSettings);
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  return (
    <>
      <h1>Store settings</h1>
      <div className="panel">
        <ActionForm action={saveSettingsAction} submitLabel="Save settings" className="admin-form">
          <label className="fld wide"><span>Announcement bar (blank hides it)</span><input name="announcement" defaultValue={get("announcement")} maxLength={140} /></label>
          <label className="fld wide"><span>Delivery information (shown on product pages and /policies/delivery)</span><textarea name="delivery_info" defaultValue={get("delivery_info")} /></label>
          <label className="fld wide"><span>Returns &amp; refunds policy — your real policy. Until filled in, customers are asked to message you.</span><textarea name="returns_policy" defaultValue={get("returns_policy")} rows={8} /></label>
          <label className="fld wide"><span>Privacy policy — have this reviewed for NDPA (Nigeria Data Protection Act) compliance before launch.</span><textarea name="privacy_policy" defaultValue={get("privacy_policy")} rows={8} /></label>
        </ActionForm>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Integrations</h2>
        <table className="tbl"><tbody>
          <tr><td>Payments (Paystack)</td><td><span className={`badge ${env.paymentsMode === "live" ? "good" : "warn"}`}>{env.paymentsMode}</span></td></tr>
          <tr><td>Email (Resend)</td><td><span className={`badge ${env.resendKey && env.emailFrom ? "good" : "warn"}`}>{env.resendKey && env.emailFrom ? "configured" : "not configured — emails are recorded but not sent"}</span></td></tr>
          <tr><td>Image storage</td><td><span className={`badge ${process.env.BLOB_READ_WRITE_TOKEN ? "good" : "warn"}`}>{process.env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "local files (development only)"}</span></td></tr>
        </tbody></table>
        <p className="muted" style={{ fontSize: 13 }}>These are configured with environment variables by whoever manages hosting — see DEPLOYMENT.md.</p>
      </div>
    </>
  );
}
