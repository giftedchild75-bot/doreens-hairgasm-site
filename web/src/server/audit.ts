import { auditEvents } from "@/db/schema";
import type { Executor } from "./pricing";

/** Append-only record of sensitive actions (admin changes, payment anomalies). */
export async function audit(
  db: Executor,
  actorAdminId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(auditEvents).values({ actorAdminId, action, entityType, entityId, details: details ?? null });
}
