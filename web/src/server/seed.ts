/**
 * Imports the real catalogue from the original static site's config.js.
 *
 * Nothing is invented here:
 * - names, descriptions, prices, specs and photos come from config.js;
 * - filter attributes (texture / length / colour family) are classified from
 *   each product's own description, and left NULL where it doesn't say;
 * - stock is left NULL (= not tracked) because no stock counts exist yet;
 * - delivery methods are created INACTIVE with ₦0 fees — the owner must set
 *   real fees and switch them on before checkout can be used.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { categories, productImages, products, productVariants, shippingMethods, storeSettings } from "@/db/schema";
import { slugify } from "@/lib/slug";

interface LegacyProduct {
  name: string;
  desc: string;
  price: string;
  specs: string[];
  image: string;
}

type Texture = "straight" | "wavy" | "curly" | null;
type Length = "bob" | "mid" | "long" | null;
type Colour = "black" | "brown" | "blonde" | "red" | "grey" | "fashion" | null;

// [texture, length group, colour family, length in inches, lace type] — from each listing's own copy.
const ATTRS: Record<string, [Texture, Length, Colour, number | null, string | null]> = {
  "Alicia": ["wavy", "long", "brown", 26, "Lace front"],
  "Brooklyn Dark Auburn": ["curly", "long", "red", 26, "13x4 Swiss lace"],
  "Brooklyn Grey": ["wavy", null, "grey", null, "Lace front"],
  "Brown Wavy": ["wavy", null, "brown", null, "Lace front"],
  "Clara": ["wavy", "long", "brown", null, "Lace front"],
  "Clara Black": ["wavy", null, "black", null, null],
  "Evelyn": ["wavy", "long", "brown", null, "Lace front"],
  "Evelyn — Wine": ["wavy", "long", "red", null, "Lace front"],
  "Freya": ["wavy", "long", "grey", null, "Lace front"],
  "Grey Bob": [null, "bob", "grey", null, "Lace front"],
  "Jasmine — Vintage Curls": ["curly", null, "brown", null, null],
  "Jasmine Chestnut": ["wavy", null, "brown", null, "Lace front"],
  "Jasmine — Dark Root": ["wavy", null, "brown", null, null],
  "Jasmine — Ginger": ["curly", null, "red", null, null],
  "Jasmine — Piano": ["straight", "long", "brown", null, null],
  "Karen": ["straight", "long", "fashion", 30, "13x3 frontal lace"],
  "Karen II": ["curly", null, "red", null, null],
  "Kimmie — Orange Mix": ["wavy", "mid", "brown", 14, "5x5 Swiss lace"],
  "Kimmie — Piano": ["wavy", "mid", "brown", 14, "5x5 Swiss lace"],
  "Kira": ["curly", null, "brown", null, null],
  "Lara Bounce": ["wavy", null, "blonde", null, "Lace front"],
  "Lara — Fringe": ["wavy", "long", "brown", null, null],
  "Miami Black": ["wavy", "mid", "black", 14, "13x4 Swiss lace"],
  "Miami Black Root": ["wavy", "long", "black", null, null],
  "Miami Dirty Blonde": ["wavy", "long", "blonde", null, null],
  "Miami Fringe": ["wavy", null, "red", null, null],
  "Miami Ginger Mix": ["wavy", null, "red", null, null],
  "Miami Pink Mix": ["wavy", "long", "fashion", null, null],
  "Miami Two Toned": ["wavy", "long", "blonde", null, null],
  "Monica": ["wavy", "long", "brown", null, null],
  "Nelly Gold": ["curly", null, "red", null, null],
  "Nelly Wine": ["curly", null, "red", null, null],
  "Nia": ["wavy", "long", "brown", null, null],
  "Nova": ["wavy", "long", "grey", null, "Lace front"],
  "Octavia": ["straight", "bob", "red", null, "Lace front"],
  "Olivia": ["wavy", null, "brown", null, "Lace front"],
  "Paris Fringe Natural": ["wavy", "long", "brown", 26, null],
  "Paris Piano": ["wavy", null, "brown", null, "Lace front"],
  "RiRi": ["straight", "bob", "red", null, "Lace front"],
  "SDD Bob": [null, "bob", "red", 8, "2x6 lace"],
  "Brooklyn Red Mix": [null, null, "red", null, "Lace front"],
};

const SERVICES = new Set(["Straightening Service", "Custom Install"]);
// Dates the items first went live (git history of the original site).
const SERVICES_LIVE = new Date("2026-08-10T09:22:16+01:00");
const WIGS_LIVE = new Date("2026-09-01T15:16:50+01:00");

export function loadLegacyProducts(configPath: string): LegacyProduct[] {
  const code = fs.readFileSync(configPath, "utf8");
  const sandbox = { window: {} as { SITE_CONFIG?: { products: LegacyProduct[] } } };
  vm.runInNewContext(code, sandbox);
  const list = sandbox.window.SITE_CONFIG?.products;
  if (!Array.isArray(list)) throw new Error(`No products found in ${configPath}`);
  return list;
}

function priceToKobo(price: string) {
  const digits = price.replace(/[^0-9]/g, "");
  if (!digits) throw new Error(`Unparseable price "${price}"`);
  return Number(digits) * 100;
}

export async function seedCatalog(db: Db, configPath = path.join(process.cwd(), "..", "config.js")) {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length) return { skipped: true, products: 0 };

  const legacy = loadLegacyProducts(configPath);
  const [wigs] = await db
    .insert(categories)
    .values({ slug: "wigs", name: "Wigs", description: "Glueless, install-ready wigs.", sortOrder: 1 })
    .returning();
  const [services] = await db
    .insert(categories)
    .values({ slug: "services", name: "Services", description: "Styling and installs by Doreen — booked on WhatsApp.", sortOrder: 2 })
    .returning();

  let i = 0;
  for (const lp of legacy) {
    const isService = SERVICES.has(lp.name);
    const attrs = ATTRS[lp.name];
    if (!isService && !attrs) throw new Error(`No attribute classification for "${lp.name}" — add it to ATTRS`);
    const [texture, lengthGroup, colorFamily, inches, lace] = attrs ?? [null, null, null, null, null];
    const slug = slugify(lp.name);
    const [p] = await db
      .insert(products)
      .values({
        slug,
        name: lp.name,
        description: lp.desc,
        kind: isService ? "service" : "physical",
        status: "published",
        categoryId: isService ? services.id : wigs.id,
        texture, lengthGroup, colorFamily,
        specs: lp.specs,
        sortOrder: i++,
        publishedAt: isService ? SERVICES_LIVE : WIGS_LIVE,
        createdAt: isService ? SERVICES_LIVE : WIGS_LIVE,
      })
      .returning();
    await db.insert(productImages).values({ productId: p.id, url: "/" + lp.image, alt: `${lp.name} — ${lp.desc.split("—")[0].trim()}`, position: 0 });
    await db.insert(productVariants).values({
      productId: p.id,
      sku: `DH-${slug.toUpperCase()}`,
      title: "Default",
      priceKobo: priceToKobo(lp.price),
      lengthInches: inches,
      laceType: lace,
      stockQuantity: null,
    });
  }

  await db.insert(shippingMethods).values([
    { name: "Owerri delivery", country: "NG", regions: ["Imo"], description: "Set the real fee before activating.", sortOrder: 1 },
    { name: "Nationwide delivery (Nigeria)", country: "NG", regions: [], description: "Set the real fee before activating.", sortOrder: 2 },
    { name: "International delivery", country: "*", regions: [], description: "Set the real fee before activating.", sortOrder: 3 },
  ]);

  await db
    .insert(storeSettings)
    .values([
      { key: "announcement", value: "Now booking custom installs — DM to reserve your slot" },
      {
        key: "delivery_info",
        value: "We ship nationwide within Nigeria and internationally. Delivery options and fees for your address are shown at checkout.",
      },
      // Deliberately empty: the owner must write the real policy (shown as "contact us" until then).
      { key: "returns_policy", value: "" },
    ])
    .onConflictDoNothing();

  return { skipped: false, products: legacy.length };
}

export async function getSetting(db: Db, key: string) {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  return row?.value ?? "";
}
