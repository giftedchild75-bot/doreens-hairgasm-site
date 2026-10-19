import { getDb } from "@/db/client";
import { productCardsBySlugs } from "@/server/catalog";
import { json } from "@/server/http";

/** Public card data for slugs kept in the browser (recently viewed, saved pieces). */
export async function GET(req: Request) {
  const slugs = (new URL(req.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 24);
  return json({ items: await productCardsBySlugs(await getDb(), slugs) });
}
