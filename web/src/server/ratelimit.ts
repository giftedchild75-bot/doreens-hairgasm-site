import { sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import type { Executor } from "./pricing";

/**
 * Fixed-window rate limiter stored in Postgres, so it works across serverless
 * instances. Returns true when the call is allowed.
 */
export async function rateLimit(db: Executor, key: string, limit: number, windowSeconds: number, now = new Date()) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return row.count <= limit;
}

/** Housekeeping: drop windows older than a day. */
export async function pruneRateLimits(db: Executor, now = new Date()) {
  await db.delete(rateLimits).where(sql`${rateLimits.windowStart} < ${new Date(now.getTime() - 86_400_000)}`);
}
