import { and, eq, gt, lt } from "drizzle-orm";
import { adminUsers, customers, sessions } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/tokens";
import type { Executor } from "./pricing";

const ADMIN_TTL_MS = 12 * 3600_000; // staff re-authenticate twice a day
const CUSTOMER_TTL_MS = 30 * 86400_000;

export async function createSession(db: Executor, subject: { adminId: string } | { customerId: string }) {
  const token = randomToken();
  const isAdmin = "adminId" in subject;
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    adminId: isAdmin ? subject.adminId : null,
    customerId: isAdmin ? null : subject.customerId,
    expiresAt: new Date(Date.now() + (isAdmin ? ADMIN_TTL_MS : CUSTOMER_TTL_MS)),
  });
  return { token, maxAgeSeconds: (isAdmin ? ADMIN_TTL_MS : CUSTOMER_TTL_MS) / 1000 };
}

export async function adminForToken(db: Executor, token: string | undefined) {
  if (!token) return null;
  const [row] = await db
    .select({ admin: adminUsers })
    .from(sessions)
    .innerJoin(adminUsers, eq(adminUsers.id, sessions.adminId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), eq(adminUsers.isActive, true)))
    .limit(1);
  return row?.admin ?? null;
}

export async function customerForToken(db: Executor, token: string | undefined) {
  if (!token) return null;
  const [row] = await db
    .select({ customer: customers })
    .from(sessions)
    .innerJoin(customers, eq(customers.id, sessions.customerId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.customer ?? null;
}

export async function destroySession(db: Executor, token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function destroyAllCustomerSessions(db: Executor, customerId: string) {
  await db.delete(sessions).where(eq(sessions.customerId, customerId));
}

export async function pruneSessions(db: Executor) {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
