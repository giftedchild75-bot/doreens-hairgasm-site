/**
 * Admin-side business logic. Every mutation records an audit event. Callers
 * (server actions) are responsible for authenticating the admin first.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import {
  analyticsEvents, categories, coupons, customers, emailMessages, inventoryMovements, orderEvents, orderItems, orders,
  payments, productImages, products, productVariants, refunds, shippingMethods, storeSettings,
} from "@/db/schema";
import { slugify } from "@/lib/slug";
import { nairaToKobo } from "@/lib/money";
import { audit } from "./audit";

const PAID_STATES = ["paid", "processing", "shipped", "delivered", "refunded"] as const;

// ---------------------------------------------------------------- products

const optText = z.string().trim().max(2000).optional().transform((v) => (v ? v : null));
const nairaField = z.coerce.number().min(0).max(100_000_000);

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).default(""),
  kind: z.enum(["physical", "service"]),
  status: z.enum(["draft", "published", "archived"]),
  categoryId: z.string().uuid().optional().or(z.literal("")).transform((v) => v || null),
  isFeatured: z.coerce.boolean().default(false),
  texture: z.enum(["straight", "wavy", "curly", ""]).optional().transform((v) => v || null),
  lengthGroup: z.enum(["bob", "mid", "long", ""]).optional().transform((v) => v || null),
  colorFamily: z.enum(["black", "brown", "blonde", "red", "grey", "fashion", ""]).optional().transform((v) => v || null),
  specs: z.string().max(2000).default("").transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12)),
  seoTitle: optText,
  seoDescription: optText,
});

export async function saveProduct(db: Db, actor: string, id: string | null, raw: unknown) {
  const input = productSchema.parse(raw);
  const slug = slugify(input.slug || input.name);
  if (!slug) throw new Error("Slug cannot be empty");
  const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (clash && clash.id !== id) throw new Error(`Another product already uses the URL "${slug}"`);

  const values = { ...input, slug, updatedAt: new Date() };
  if (id) {
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) throw new Error("Product not found");
    const publishedAt = input.status === "published" && !before.publishedAt ? new Date() : before.publishedAt;
    const [p] = await db.update(products).set({ ...values, publishedAt }).where(eq(products.id, id)).returning();
    await audit(db, actor, "product.update", "product", id, { name: p.name, status: p.status, slugChanged: before.slug !== p.slug ? [before.slug, p.slug] : undefined });
    return p;
  }
  const [{ max }] = await db.select({ max: sql<number>`COALESCE(MAX(${products.sortOrder}), 0)::int` }).from(products);
  const [p] = await db
    .insert(products)
    .values({ ...values, sortOrder: max + 1, publishedAt: input.status === "published" ? new Date() : null })
    .returning();
  await audit(db, actor, "product.create", "product", p.id, { name: p.name });
  return p;
}

export const variantSchema = z.object({
  title: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, dash and underscore"),
  price: nairaField,
  salePrice: z.union([z.literal(""), nairaField]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  lengthInches: z.union([z.literal(""), z.coerce.number().int().min(1).max(60)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  color: optText,
  density: optText,
  laceType: optText,
  capSize: optText,
  trackStock: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
});

export async function saveVariant(db: Db, actor: string, productId: string, variantId: string | null, raw: unknown) {
  const v = variantSchema.parse(raw);
  const priceKobo = nairaToKobo(v.price);
  const salePriceKobo = v.salePrice === null ? null : nairaToKobo(v.salePrice);
  if (salePriceKobo !== null && salePriceKobo >= priceKobo) throw new Error("Sale price must be lower than the regular price");
  const base = {
    title: v.title, sku: v.sku.toUpperCase(), priceKobo, salePriceKobo, lengthInches: v.lengthInches,
    color: v.color, density: v.density, laceType: v.laceType, capSize: v.capSize, isActive: v.isActive, updatedAt: new Date(),
  };
  if (variantId) {
    const [before] = await db.select().from(productVariants).where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).limit(1);
    if (!before) throw new Error("Variant not found");
    // Turning tracking on starts at 0 (set real stock with an adjustment); turning it off clears the count.
    const stockQuantity = v.trackStock ? (before.stockQuantity ?? 0) : null;
    const [row] = await db.update(productVariants).set({ ...base, stockQuantity }).where(eq(productVariants.id, variantId)).returning();
    await audit(db, actor, "variant.update", "variant", variantId, { sku: row.sku, priceKobo, salePriceKobo, from: { priceKobo: before.priceKobo, salePriceKobo: before.salePriceKobo } });
    return row;
  }
  const [row] = await db.insert(productVariants).values({ ...base, productId, stockQuantity: v.trackStock ? 0 : null }).returning();
  await audit(db, actor, "variant.create", "variant", row.id, { sku: row.sku, priceKobo });
  return row;
}

/** Stock adjustment with an inventory movement; atomic and can't go below zero. */
export async function adjustStock(db: Db, actor: string, variantId: string, delta: number, note: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error("Enter a whole number other than 0");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(productVariants)
      .set({ stockQuantity: sql`${productVariants.stockQuantity} + ${delta}`, updatedAt: new Date() })
      .where(and(eq(productVariants.id, variantId), sql`${productVariants.stockQuantity} IS NOT NULL`, sql`${productVariants.stockQuantity} + ${delta} >= 0`))
      .returning();
    if (!row) throw new Error("Stock isn't tracked for this option, or the adjustment would take it below zero");
    await tx.insert(inventoryMovements).values({ variantId, delta, reason: "adjustment", note: note.slice(0, 300) || null, actorAdminId: actor });
    await audit(tx, actor, "stock.adjust", "variant", variantId, { delta, note, newQuantity: row.stockQuantity });
    return row;
  });
}

export async function addImage(db: Db, actor: string, productId: string, url: string, alt: string) {
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${productImages.position}), -1)::int` })
    .from(productImages)
    .where(eq(productImages.productId, productId));
  const [img] = await db.insert(productImages).values({ productId, url, alt: alt.slice(0, 200), position: max + 1 }).returning();
  await audit(db, actor, "image.add", "product", productId, { url });
  return img;
}

export async function moveImage(db: Db, actor: string, imageId: string, direction: -1 | 1) {
  const [img] = await db.select().from(productImages).where(eq(productImages.id, imageId)).limit(1);
  if (!img) return;
  const list = await db.select().from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.position));
  const i = list.findIndex((x) => x.id === imageId);
  const j = i + direction;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction(async (tx) => {
    for (let k = 0; k < list.length; k++) await tx.update(productImages).set({ position: k }).where(eq(productImages.id, list[k].id));
  });
  await audit(db, actor, "image.reorder", "product", img.productId, {});
}

export async function removeImage(db: Db, actor: string, imageId: string) {
  const [img] = await db.delete(productImages).where(eq(productImages.id, imageId)).returning();
  if (img) await audit(db, actor, "image.remove", "product", img.productId, { url: img.url });
  return img;
}

export async function listAdminProducts(db: Db, q?: string) {
  const term = q?.trim() ? `%${q.trim()}%` : null;
  return db
    .select({
      p: products,
      category: categories.name,
      variants: sql<number>`COUNT(${productVariants.id})::int`,
      minPrice: sql<number>`MIN(${productVariants.priceKobo})::int`,
      stock: sql<number | null>`SUM(${productVariants.stockQuantity})::int`,
      untracked: sql<boolean>`BOOL_OR(${productVariants.stockQuantity} IS NULL)`,
      image: sql<string | null>`(SELECT url FROM product_images i WHERE i.product_id = ${products.id} ORDER BY position LIMIT 1)`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(term ? or(ilike(products.name, term), ilike(productVariants.sku, term)) : undefined)
    .groupBy(products.id, categories.name)
    .orderBy(asc(products.sortOrder));
}

// ---------------------------------------------------------------- categories

export async function saveCategory(db: Db, actor: string, id: string | null, raw: unknown) {
  const c = z
    .object({
      name: z.string().trim().min(2).max(60),
      description: z.string().trim().max(300).optional().transform((v) => v || null),
      sortOrder: z.coerce.number().int().min(0).max(999).default(0),
      isVisible: z.coerce.boolean().default(false),
    })
    .parse(raw);
  const slug = slugify(c.name);
  if (id) {
    const [row] = await db.update(categories).set({ ...c }).where(eq(categories.id, id)).returning();
    await audit(db, actor, "category.update", "category", id, c);
    return row;
  }
  const [row] = await db.insert(categories).values({ ...c, slug }).returning();
  await audit(db, actor, "category.create", "category", row.id, c);
  return row;
}

// ---------------------------------------------------------------- coupons & shipping

export const couponSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dash and underscore only").transform((s) => s.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive(),
  minSubtotal: z.coerce.number().min(0).default(0),
  startsAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
  expiresAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
  usageLimit: z.union([z.literal(""), z.coerce.number().int().positive()]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
  productIds: z.array(z.string().uuid()).default([]),
  categoryIds: z.array(z.string().uuid()).default([]),
  isActive: z.coerce.boolean().default(false),
});

export async function saveCoupon(db: Db, actor: string, id: string | null, raw: unknown) {
  const c = couponSchema.parse(raw);
  if (c.type === "percent" && (c.value > 100 || !Number.isInteger(c.value))) throw new Error("Percentage must be a whole number from 1 to 100");
  const values = {
    code: c.code, type: c.type, value: c.type === "percent" ? c.value : nairaToKobo(c.value),
    minSubtotalKobo: nairaToKobo(c.minSubtotal), startsAt: c.startsAt, expiresAt: c.expiresAt, usageLimit: c.usageLimit,
    productIds: c.productIds, categoryIds: c.categoryIds, isActive: c.isActive,
  };
  const [row] = id
    ? await db.update(coupons).set(values).where(eq(coupons.id, id)).returning()
    : await db.insert(coupons).values(values).returning();
  await audit(db, actor, id ? "coupon.update" : "coupon.create", "coupon", row.id, { code: row.code, type: row.type, value: row.value, isActive: row.isActive });
  return row;
}

export const shippingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2}|\*)$/, "Use a 2-letter country code, or * for everywhere else"),
  regions: z.string().default("").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  fee: nairaField,
  estimatedDays: z.string().trim().max(60).optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.coerce.boolean().default(false),
});

export async function saveShipping(db: Db, actor: string, id: string | null, raw: unknown) {
  const s = shippingSchema.parse(raw);
  const values = { name: s.name, description: s.description, country: s.country, regions: s.regions, feeKobo: nairaToKobo(s.fee), estimatedDays: s.estimatedDays, sortOrder: s.sortOrder, isActive: s.isActive };
  const [row] = id
    ? await db.update(shippingMethods).set(values).where(eq(shippingMethods.id, id)).returning()
    : await db.insert(shippingMethods).values(values).returning();
  await audit(db, actor, id ? "shipping.update" : "shipping.create", "shipping_method", row.id, values);
  return row;
}

export const SETTING_KEYS = ["announcement", "delivery_info", "returns_policy", "privacy_policy"] as const;

export async function saveSettings(db: Db, actor: string, raw: Record<string, string>) {
  for (const key of SETTING_KEYS) {
    if (!(key in raw)) continue;
    const value = String(raw[key] ?? "").slice(0, 20_000);
    await db.insert(storeSettings).values({ key, value }).onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
  }
  await audit(db, actor, "settings.update", "settings", null, { keys: Object.keys(raw).filter((k) => (SETTING_KEYS as readonly string[]).includes(k)) });
}

// ---------------------------------------------------------------- orders

export async function listAdminOrders(db: Db, f: { q?: string; status?: string; from?: string; to?: string; attention?: boolean }) {
  const where: SQL[] = [];
  if (f.q?.trim()) {
    const t = `%${f.q.trim()}%`;
    where.push(or(ilike(orders.reference, t), ilike(orders.email, t), ilike(orders.customerName, t), ilike(orders.phone, t))!);
  }
  if (f.status) where.push(sql`${orders.status} = ${f.status}`);
  if (f.from) where.push(gte(orders.createdAt, new Date(f.from)));
  if (f.to) where.push(lt(orders.createdAt, new Date(new Date(f.to).getTime() + 86400_000)));
  if (f.attention) where.push(sql`${orders.needsAttention} IS NOT NULL`);
  return db.select().from(orders).where(where.length ? and(...where) : undefined).orderBy(desc(orders.createdAt)).limit(200);
}

export async function getAdminOrder(db: Db, id: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) return null;
  const [items, events, pays, refs, mails] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.createdAt)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(asc(refunds.createdAt)),
    db.select().from(emailMessages).where(eq(emailMessages.orderId, id)).orderBy(asc(emailMessages.createdAt)),
  ]);
  return { order: o, items, events, payments: pays, refunds: refs, emails: mails };
}

export async function resolveAttention(db: Db, actor: string, orderId: string, note: string) {
  const [o] = await db.update(orders).set({ needsAttention: null }).where(eq(orders.id, orderId)).returning();
  await db.insert(orderEvents).values({ orderId, message: `Attention flag resolved: ${note.slice(0, 300)}`, actorAdminId: actor });
  await audit(db, actor, "order.attention_resolved", "order", orderId, { note });
  return o;
}

// ---------------------------------------------------------------- customers

export async function listCustomers(db: Db, q?: string) {
  const t = q?.trim() ? `%${q.trim()}%` : null;
  return db
    .select({
      c: customers,
      orders: sql<number>`COUNT(${orders.id}) FILTER (WHERE ${orders.status} IN ('paid','processing','shipped','delivered','refunded'))::int`,
      spent: sql<number>`COALESCE(SUM(${orders.totalKobo}) FILTER (WHERE ${orders.status} IN ('paid','processing','shipped','delivered')), 0)::int`,
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(t ? or(ilike(customers.email, t), ilike(customers.name, t), ilike(customers.phone, t)) : undefined)
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(200);
}

// ---------------------------------------------------------------- reporting

/**
 * Dashboard metrics for [from, to). Revenue counts only verified payments;
 * pending, cancelled and refunded money is reported separately.
 */
export async function dashboardMetrics(db: Db, from: Date, to: Date) {
  const inRange = and(gte(orders.createdAt, from), lt(orders.createdAt, to));
  const [agg] = await db
    .select({
      paidOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('paid','processing','shipped','delivered','refunded'))::int`,
      grossPaid: sql<number>`COALESCE(SUM(${orders.totalKobo}) FILTER (WHERE ${orders.status} IN ('paid','processing','shipped','delivered','refunded')), 0)::bigint`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} IN ('pending_payment','payment_failed'))::int`,
      pendingValue: sql<number>`COALESCE(SUM(${orders.totalKobo}) FILTER (WHERE ${orders.status} IN ('pending_payment','payment_failed')), 0)::bigint`,
      cancelledCount: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'cancelled')::int`,
    })
    .from(orders)
    .where(inRange);
  const [ref] = await db
    .select({ refunded: sql<number>`COALESCE(SUM(${refunds.amountKobo}), 0)::bigint` })
    .from(refunds)
    .where(and(eq(refunds.status, "processed"), gte(refunds.updatedAt, from), lt(refunds.updatedAt, to)));
  const [{ toFulfil }] = await db
    .select({ toFulfil: sql<number>`COUNT(*)::int` })
    .from(orders)
    .where(inArray(orders.status, ["paid", "processing"]));
  const [{ attention }] = await db
    .select({ attention: sql<number>`COUNT(*)::int` })
    .from(orders)
    .where(sql`${orders.needsAttention} IS NOT NULL`);

  const best = await db
    .select({ name: orderItems.productName, units: sql<number>`SUM(${orderItems.quantity})::int`, revenue: sql<number>`SUM(${orderItems.lineTotalKobo})::bigint` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inRange, inArray(orders.status, [...PAID_STATES])))
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(5);
  const lowStock = await db
    .select({ id: productVariants.id, productId: products.id, name: products.name, title: productVariants.title, stock: productVariants.stockQuantity })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(sql`${productVariants.stockQuantity} IS NOT NULL`, sql`${productVariants.stockQuantity} <= 2`, eq(products.status, "published"), eq(productVariants.isActive, true)))
    .orderBy(asc(productVariants.stockQuantity))
    .limit(10);
  const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
  const funnel = await db
    .select({ name: analyticsEvents.name, n: sql<number>`COUNT(*)::int`, sessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})::int` })
    .from(analyticsEvents)
    .where(and(gte(analyticsEvents.createdAt, from), lt(analyticsEvents.createdAt, to)))
    .groupBy(analyticsEvents.name);

  const gross = Number(agg.grossPaid);
  const refunded = Number(ref.refunded);
  return {
    paidOrders: agg.paidOrders,
    grossPaidKobo: gross,
    refundedKobo: refunded,
    netKobo: gross - refunded,
    averageOrderKobo: agg.paidOrders ? Math.round(gross / agg.paidOrders) : 0,
    pendingCount: agg.pendingCount,
    pendingValueKobo: Number(agg.pendingValue),
    cancelledCount: agg.cancelledCount,
    toFulfil,
    attention,
    bestsellers: best.map((b) => ({ ...b, revenue: Number(b.revenue) })),
    lowStock,
    recent,
    funnel,
  };
}

export function ordersToCsv(rows: (typeof orders.$inferSelect)[]) {
  const head = ["reference", "created_at", "status", "customer", "email", "phone", "city", "region", "country", "subtotal_ngn", "discount_ngn", "delivery_ngn", "total_ngn"];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((o) =>
    [o.reference, o.createdAt.toISOString(), o.status, o.customerName, o.email, o.phone, o.city, o.region, o.country,
      o.subtotalKobo / 100, o.discountKobo / 100, o.shippingKobo / 100, o.totalKobo / 100].map(esc).join(","),
  );
  return [head.join(","), ...lines].join("\n");
}
