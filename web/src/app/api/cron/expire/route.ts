import { getDb } from "@/db/client";
import { expireStaleOrders } from "@/server/orders";
import { reconcileOrder } from "@/server/payments";
import { pruneRateLimits } from "@/server/ratelimit";
import { pruneSessions } from "@/server/sessions";
import { json } from "@/server/http";

/** Scheduled housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const db = await getDb();
  const result = await expireStaleOrders(db, (id) => reconcileOrder(db, id));
  await pruneRateLimits(db);
  await pruneSessions(db);
  return json({ ok: true, ...result });
}
