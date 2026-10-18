import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { adminUsers, auditEvents } from "@/db/schema";

export default async function AdminAudit() {
  const rows = await (await getDb())
    .select({ e: auditEvents, who: adminUsers.name })
    .from(auditEvents)
    .leftJoin(adminUsers, eq(adminUsers.id, auditEvents.actorAdminId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(300);
  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Sensitive actions by staff and payment anomalies. Latest 300.</p>
      <div className="panel">
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map(({ e, who }) => (
              <tr key={e.id}>
                <td>{e.createdAt.toLocaleString("en-NG")}</td>
                <td>{who ?? "system"}</td>
                <td>{e.action}</td>
                <td style={{ fontSize: 12, maxWidth: 420, wordBreak: "break-word" }} className="muted">{e.details ? JSON.stringify(e.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
