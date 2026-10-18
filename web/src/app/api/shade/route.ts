import { getDb } from "@/db/client";
import { shadeMatches } from "@/server/catalog";
import { json } from "@/server/http";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const pick = (k: string, allowed: string[]) => (allowed.includes(sp.get(k) ?? "") ? sp.get(k)! : undefined);
  const items = await shadeMatches(await getDb(), {
    undertone: pick("undertone", ["warm", "cool", "neutral"]),
    length: pick("length", ["bob", "mid", "long"]),
    texture: pick("texture", ["straight", "wavy", "curly"]),
  });
  return json({ items: items.map(({ slug, name, priceKobo, image }) => ({ slug, name, priceKobo, image })) });
}
