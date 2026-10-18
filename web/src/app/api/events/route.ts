import { z } from "zod";
import { getDb } from "@/db/client";
import { analyticsEvents } from "@/db/schema";
import { rateLimit } from "@/server/ratelimit";
import { clientIpFrom, json } from "@/server/http";
import { sha256 } from "@/lib/tokens";

// Purchases are NOT tracked here — they're counted from verified, paid orders.
const NAMES = ["product_view", "search", "filter", "add_to_cart", "checkout_start", "shade_finder_complete"] as const;
const schema = z.object({
  name: z.enum(NAMES),
  sessionId: z.string().uuid().optional(),
  productId: z.string().uuid().optional().nullable(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: false }, 400);
  const db = await getDb();
  // Rate limit on a hash of the IP; the IP itself is never stored.
  if (!(await rateLimit(db, `ev:${sha256(clientIpFrom(req))}`, 120, 60))) return json({ ok: false }, 429);
  const props = JSON.stringify(parsed.data.props ?? {}).length <= 1000 ? (parsed.data.props ?? {}) : {};
  await db.insert(analyticsEvents).values({
    name: parsed.data.name,
    sessionId: parsed.data.sessionId ?? null,
    productId: parsed.data.productId ?? null,
    props,
  });
  return json({ ok: true });
}
