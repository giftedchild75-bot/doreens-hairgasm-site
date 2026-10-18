/** Read-side catalogue queries for the storefront. */
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { categories, orderItems, orders, productImages, products, productVariants } from "@/db/schema";

export const TEXTURES = ["straight", "wavy", "curly"] as const;
export const LENGTHS = ["bob", "mid", "long"] as const;
export const COLORS = ["black", "brown", "blonde", "red", "grey", "fashion"] as const;
export const SORTS = ["featured", "price-asc", "price-desc", "newest", "name", "popular"] as const;
export const PAGE_SIZE = 24;

export const LABELS: Record<string, string> = {
  straight: "Straight", wavy: "Wavy", curly: "Curly",
  bob: "Bob", mid: "Mid-length", long: "Long",
  black: "Black", brown: "Brown", blonde: "Blonde", red: "Red & Auburn", grey: "Grey & Silver", fashion: "Fashion colours",
};

const one = <T extends readonly string[]>(vals: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.enum(vals).optional().catch(undefined));
const num = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.coerce.number().int().min(0).optional().catch(undefined));
const str = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().trim().max(80).optional().catch(undefined));

export const catalogQuerySchema = z.object({
  q: str,
  category: str,
  texture: one(TEXTURES),
  length: one(LENGTHS),
  color: one(COLORS),
  min: num, // naira
  max: num, // naira
  sort: one(SORTS),
  page: num,
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: "physical" | "service";
  specs: string[];
  image: { url: string; alt: string } | null;
  priceKobo: number; // lowest effective price across active variants
  compareAtKobo: number | null; // regular price when on sale
  inStock: boolean; // false only when every variant is tracked and at 0
  categorySlug: string | null;
}

const minPrice = sql<number>`MIN(COALESCE(${productVariants.salePriceKobo}, ${productVariants.priceKobo}))`;

/** Cards for any filtered product id list, preserving the given order. */
async function cardsFor(db: Db, ids: string[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ p: products, cat: categories.slug })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(inArray(products.id, ids));
  const variants = await db
    .select()
    .from(productVariants)
    .where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true)));
  const images = await db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.position));
  const byId = new Map(rows.map((r) => [r.p.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    const vs = variants.filter((v) => v.productId === id);
    if (!vs.length) return [];
    const cheapest = vs.reduce((a, b) => ((a.salePriceKobo ?? a.priceKobo) <= (b.salePriceKobo ?? b.priceKobo) ? a : b));
    const img = images.find((i) => i.productId === id);
    return [{
      id, slug: r.p.slug, name: r.p.name, description: r.p.description, kind: r.p.kind, specs: r.p.specs,
      image: img ? { url: img.url, alt: img.alt || r.p.name } : null,
      priceKobo: cheapest.salePriceKobo ?? cheapest.priceKobo,
      compareAtKobo: cheapest.salePriceKobo !== null ? cheapest.priceKobo : null,
      inStock: vs.some((v) => v.stockQuantity === null || v.stockQuantity > 0),
      categorySlug: r.cat,
    }];
  });
}

export async function searchCatalog(db: Db, q: CatalogQuery) {
  const where: SQL[] = [eq(products.status, "published")];
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    where.push(
      or(
        ilike(products.name, term),
        ilike(products.description, term),
        sql`${products.specs}::text ILIKE ${term}`,
        ilike(products.colorFamily, term),
        ilike(products.texture, term),
      )!,
    );
  }
  if (q.category) {
    const [c] = await db.select().from(categories).where(eq(categories.slug, q.category)).limit(1);
    where.push(c ? eq(products.categoryId, c.id) : sql`false`);
  }
  if (q.texture) where.push(eq(products.texture, q.texture));
  if (q.length) where.push(eq(products.lengthGroup, q.length));
  if (q.color) where.push(eq(products.colorFamily, q.color));

  const having: SQL[] = [];
  if (q.min !== undefined) having.push(gte(minPrice, q.min * 100));
  if (q.max !== undefined) having.push(lte(minPrice, q.max * 100));

  const sales = db
    .select({ productId: orderItems.productId, units: sql<number>`SUM(${orderItems.quantity})`.as("units") })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(inArray(orders.status, ["paid", "processing", "shipped", "delivered"]))
    .groupBy(orderItems.productId)
    .as("sales");

  const sort = q.sort ?? "featured";
  const orderBy =
    sort === "price-asc" ? [asc(minPrice), asc(products.name)]
    : sort === "price-desc" ? [desc(minPrice), asc(products.name)]
    : sort === "newest" ? [desc(products.publishedAt), asc(products.sortOrder)]
    : sort === "name" ? [asc(products.name)]
    : sort === "popular" ? [sql`COALESCE(MAX(${sales.units}), 0) DESC`, asc(products.sortOrder)]
    : [desc(products.isFeatured), asc(products.sortOrder)];

  const base = db
    .select({ id: products.id })
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isActive, true)))
    .leftJoin(sales, eq(sales.productId, products.id))
    .where(and(...where))
    .groupBy(products.id)
    .having(having.length ? and(...having) : undefined)
    .orderBy(...orderBy);

  const allIds = (await base).map((r) => r.id);
  const page = Math.max(1, q.page ?? 1);
  const pageIds = allIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return {
    items: await cardsFor(db, pageIds),
    total: allIds.length,
    page,
    pages: Math.max(1, Math.ceil(allIds.length / PAGE_SIZE)),
  };
}

export async function listCategories(db: Db) {
  return db
    .select({
      id: categories.id, slug: categories.slug, name: categories.name, description: categories.description,
      count: sql<number>`COUNT(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.status, "published")))
    .where(eq(categories.isVisible, true))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));
}

/** Facet values that actually exist among published products (so we never show empty filters). */
export async function availableFacets(db: Db) {
  const rows = await db
    .selectDistinct({ texture: products.texture, length: products.lengthGroup, color: products.colorFamily })
    .from(products)
    .where(eq(products.status, "published"));
  const pick = <T extends string>(all: readonly T[], key: "texture" | "length" | "color") =>
    all.filter((v) => rows.some((r) => r[key] === v));
  return { textures: pick(TEXTURES, "texture"), lengths: pick(LENGTHS, "length"), colors: pick(COLORS, "color") };
}

export async function featuredProducts(db: Db, limit = 8) {
  const ids = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.status, "published"), eq(products.kind, "physical")))
    .orderBy(desc(products.isFeatured), asc(products.sortOrder))
    .limit(limit);
  return cardsFor(db, ids.map((r) => r.id));
}

/** Products published in the last `days` days (empty when nothing is genuinely new). */
export async function newArrivals(db: Db, days = 30, limit = 8) {
  const since = new Date(Date.now() - days * 86400_000);
  const ids = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.status, "published"), gte(products.publishedAt, since)))
    .orderBy(desc(products.publishedAt))
    .limit(limit);
  return cardsFor(db, ids.map((r) => r.id));
}

/** Bestsellers from real paid orders only (empty until there are sales). */
export async function bestsellers(db: Db, limit = 8) {
  const ids = await db
    .select({ id: orderItems.productId, units: sql<number>`SUM(${orderItems.quantity})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(products.id, orderItems.productId))
    .where(and(inArray(orders.status, ["paid", "processing", "shipped", "delivered"]), eq(products.status, "published")))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);
  return cardsFor(db, ids.map((r) => r.id!).filter(Boolean));
}

export async function getProductBySlug(db: Db, slug: string, opts: { includeDrafts?: boolean } = {}) {
  const [row] = await db
    .select({ p: products, cat: categories })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), opts.includeDrafts ? undefined : eq(products.status, "published")))
    .limit(1);
  if (!row) return null;
  const [variants, images] = await Promise.all([
    db.select().from(productVariants).where(and(eq(productVariants.productId, row.p.id), eq(productVariants.isActive, true))).orderBy(asc(productVariants.position), asc(productVariants.priceKobo)),
    db.select().from(productImages).where(eq(productImages.productId, row.p.id)).orderBy(asc(productImages.position)),
  ]);
  return { product: row.p, category: row.cat, variants, images };
}

export async function relatedProducts(db: Db, p: { id: string; colorFamily: string | null; texture: string | null; categoryId: string | null }, limit = 4) {
  const ids = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.status, "published"), sql`${products.id} <> ${p.id}`, p.categoryId ? eq(products.categoryId, p.categoryId) : undefined))
    .orderBy(
      sql`(CASE WHEN ${products.colorFamily} = ${p.colorFamily} THEN 2 ELSE 0 END + CASE WHEN ${products.texture} = ${p.texture} THEN 1 ELSE 0 END) DESC`,
      asc(products.sortOrder),
    )
    .limit(limit);
  return cardsFor(db, ids.map((r) => r.id));
}

export async function productCardsBySlugs(db: Db, slugs: string[]) {
  if (!slugs.length) return [];
  const rows = await db.select({ id: products.id, slug: products.slug }).from(products).where(and(inArray(products.slug, slugs), eq(products.status, "published")));
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  return cardsFor(db, slugs.map((s) => bySlug.get(s)).filter((x): x is string => !!x));
}

/**
 * Shade finder: ranks real, purchasable products by how well they match the
 * shopper's answers (replaces the old hard-coded recommendation, which pointed
 * at a product that had been removed from the catalogue).
 */
export async function shadeMatches(db: Db, a: { undertone?: string; length?: string; texture?: string }, limit = 3) {
  const colours: Record<string, string[]> = {
    warm: ["red", "blonde", "brown"],
    cool: ["black", "grey", "fashion"],
    neutral: ["brown", "black", "blonde"],
  };
  const wanted = colours[a.undertone ?? ""] ?? [];
  const ids = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.status, "published"), eq(products.kind, "physical")))
    .orderBy(
      sql`(
        CASE WHEN ${products.texture} = ${a.texture ?? ""} THEN 3 ELSE 0 END +
        CASE WHEN ${products.lengthGroup} = ${a.length ?? ""} THEN 3 ELSE 0 END +
        CASE WHEN ${products.colorFamily} = ANY(${sql.raw(`ARRAY[${wanted.map((w) => `'${w}'`).join(",") || "''"}]::text[]`)}) THEN 2 ELSE 0 END
      ) DESC`,
      asc(products.sortOrder),
    )
    .limit(limit);
  return cardsFor(db, ids.map((r) => r.id));
}
