import { getDb } from "@/db/client";
import { currentAdmin } from "@/server/auth";
import { listAdminOrders, ordersToCsv } from "@/server/admin";
import { audit } from "@/server/audit";

/** CSV export of the filtered order list (contains personal data — staff only, audited). */
export async function GET(req: Request) {
  const a = await currentAdmin();
  if (!a) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const db = await getDb();
  const rows = await listAdminOrders(db, {
    q: sp.get("q") ?? undefined,
    status: sp.get("status") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    attention: sp.get("attention") === "1",
  });
  await audit(db, a.id, "orders.export", "order", null, { count: rows.length, filters: Object.fromEntries(sp) });
  return new Response(ordersToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
