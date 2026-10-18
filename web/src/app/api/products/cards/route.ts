import { getDb } from "@/db/client";
import { productCardsBySlugs } from "@/server/catalog";
import { json } from "@/server/http";

export async function GET(req: Request) {
  const slugs = (new URL(req.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 8);
  const items = await productCardsBySlugs(await getDb(), slugs);
  return json({ items: items.map(({ slug, name, priceKobo, image }) => ({ slug, name, priceKobo, image })) });
}
