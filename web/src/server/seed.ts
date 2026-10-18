/**
 * Catalogue seeding. The store's real catalogue lives in src/catalog/store-catalog.ts;
 * tests seed a frozen fixture instead (tests/fixtures/legacy.ts).
 *
 * Nothing is invented here: stock is left NULL (= not tracked), delivery methods
 * are created INACTIVE with ₦0 fees, and a product without a photo is created as
 * a hidden draft until one is uploaded in the admin.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { categories, productImages, products, productVariants, shippingMethods, storeSettings } from "@/db/schema";
import { slugify } from "@/lib/slug";
import { nairaToKobo } from "@/lib/money";

export const CATEGORIES = {
  wigs: { name: "Wigs", description: "Glueless, install-ready wigs.", sortOrder: 1 },
  frontals: { name: "Frontals & Closures", description: "Swiss lace frontals and closures.", sortOrder: 2 },
  ponytails: { name: "Ponytails & Combos", description: "Ponytails, buns and frontal combos.", sortOrder: 3 },
  services: { name: "Services", description: "Styling and installs by Doreen — booked on WhatsApp.", sortOrder: 4 },
} as const;
export type CategoryKey = keyof typeof CATEGORIES;

export interface CatalogItem {
  name: string;
  description: string;
  kind: "physical" | "service";
  category: CategoryKey;
  texture?: "straight" | "wavy" | "curly" | null;
  lengthGroup?: "bob" | "mid" | "long" | null;
  colorFamily?: "black" | "brown" | "blonde" | "red" | "grey" | "fashion" | null;
  specs: string[];
  /** Prices in naira, exactly as the owner quoted them. */
  variants: { title: string; price: number; lengthInches?: number | null; color?: string | null; laceType?: string | null }[];
  /** Paths under /public, e.g. "/assets/products/futura-1.jpg". */
  images: { url: string; alt: string }[];
  publishedAt?: Date;
}

export async function seedCatalog(db: Db, items: CatalogItem[]) {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length) return { skipped: true, products: 0, drafts: 0 };

  const used = [...new Set(items.map((i) => i.category))];
  const catIds = new Map<CategoryKey, string>();
  for (const key of used) {
    const [c] = await db.insert(categories).values({ slug: slugify(CATEGORIES[key].name), ...CATEGORIES[key] }).returning();
    catIds.set(key, c.id);
  }

  let drafts = 0;
  for (const [i, item] of items.entries()) {
    if (!item.variants.length) throw new Error(`"${item.name}" has no priced option`);
    const slug = slugify(item.name);
    const publishable = item.images.length > 0;
    if (!publishable) drafts++;
    const [p] = await db
      .insert(products)
      .values({
        slug,
        name: item.name,
        description: item.description,
        kind: item.kind,
        status: publishable ? "published" : "draft",
        categoryId: catIds.get(item.category)!,
        texture: item.texture ?? null,
        lengthGroup: item.lengthGroup ?? null,
        colorFamily: item.colorFamily ?? null,
        specs: item.specs,
        sortOrder: i,
        publishedAt: publishable ? (item.publishedAt ?? new Date()) : null,
        createdAt: item.publishedAt ?? new Date(),
      })
      .returning();
    if (item.images.length) {
      await db.insert(productImages).values(item.images.map((img, pos) => ({ productId: p.id, url: img.url, alt: img.alt, position: pos })));
    }
    await db.insert(productVariants).values(
      item.variants.map((v, pos) => ({
        productId: p.id,
        sku: `DH-${slug.toUpperCase()}${item.variants.length > 1 ? `-${slugify(v.title).toUpperCase()}` : ""}`,
        title: v.title,
        priceKobo: nairaToKobo(v.price),
        lengthInches: v.lengthInches ?? null,
        color: v.color ?? null,
        laceType: v.laceType ?? null,
        stockQuantity: null,
        position: pos,
      })),
    );
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

  return { skipped: false, products: items.length, drafts };
}

export async function getSetting(db: Db, key: string) {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  return row?.value ?? "";
}
