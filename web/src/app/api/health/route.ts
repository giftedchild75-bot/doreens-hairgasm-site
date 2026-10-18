import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { env } from "@/lib/env";
import { json } from "@/server/http";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return json({ ok: true, db: "up", payments: env.paymentsMode, email: env.resendKey && env.emailFrom ? "configured" : "not_configured" });
  } catch {
    return json({ ok: false, db: "down" }, 503);
  }
}
