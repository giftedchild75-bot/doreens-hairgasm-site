/**
 * Server-side cart quoting. The browser only ever sends {variantId, quantity}
 * pairs plus an optional coupon code and destination; every price, discount,
 * delivery fee and stock check is recomputed here from the database.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { coupons, products, productVariants, shippingMethods } from "@/db/schema";
import { effectivePrice } from "@/lib/money";

export type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const MAX_QTY_PER_LINE = 20;

export const cartLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

export const quoteInputSchema = z.object({
  lines: z.array(cartLineSchema).min(1).max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
  shippingMethodId: z.string().uuid().optional().nullable(),
  country: z.string().trim().length(2).optional().nullable(),
  region: z.string().trim().max(80).optional().nullable(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export type LineProblem = "unavailable" | "insufficient_stock" | "not_purchasable";

export interface QuotedLine {
  variantId: string;
  productId: string | null;
  productName: string;
  productSlug: string | null;
  variantTitle: string;
  sku: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
  stockTracked: boolean;
  /** Units available when tracked; null when not tracked. */
  available: number | null;
  categoryId: string | null;
  problem?: LineProblem;
}

export interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  feeKobo: number;
  estimatedDays: string | null;
}

export interface Quote {
  lines: QuotedLine[];
  subtotalKobo: number;
  discountKobo: number;
  shippingKobo: number;
  totalKobo: number;
  coupon: { code: string; id: string; applied: boolean; message: string } | null;
  shippingOptions: ShippingOption[];
  selectedShipping: ShippingOption | null;
  /** Human-readable reasons this cart cannot be checked out as-is. */
  problems: string[];
}

function mergeLines(lines: { variantId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity: Math.min(quantity, MAX_QTY_PER_LINE) }));
}

export async function listShippingOptions(db: Executor, country?: string | null, region?: string | null) {
  if (!country) return [];
  const rows = await db
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(shippingMethods.sortOrder);
  const c = country.toUpperCase();
  const r = (region ?? "").trim().toLowerCase();
  const exact = rows.filter((m) => m.country === c);
  const pool = exact.length ? exact : rows.filter((m) => m.country === "*");
  return pool
    .filter((m) => m.regions.length === 0 || m.regions.some((x) => x.toLowerCase() === r))
    .map<ShippingOption>((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      feeKobo: m.feeKobo,
      estimatedDays: m.estimatedDays,
    }));
}

export async function quoteCart(db: Executor, input: QuoteInput, now = new Date()): Promise<Quote> {
  const wanted = mergeLines(input.lines);
  const ids = wanted.map((l) => l.variantId);
  const rows = ids.length
    ? await db
        .select({ v: productVariants, p: products })
        .from(productVariants)
        .leftJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, ids))
    : [];
  const byId = new Map(rows.map((r) => [r.v.id, r]));
  const problems: string[] = [];

  const lines: QuotedLine[] = wanted.map(({ variantId, quantity }) => {
    const row = byId.get(variantId);
    if (!row || !row.p) {
      problems.push("An item in your bag is no longer available.");
      return {
        variantId, productId: null, productName: "Unavailable item", productSlug: null, variantTitle: "",
        sku: "", unitPriceKobo: 0, quantity, lineTotalKobo: 0, stockTracked: false, available: 0,
        categoryId: null, problem: "unavailable",
      };
    }
    const { v, p } = row;
    const unit = effectivePrice(v);
    const line: QuotedLine = {
      variantId, productId: p.id, productName: p.name, productSlug: p.slug, variantTitle: v.title,
      sku: v.sku, unitPriceKobo: unit, quantity, lineTotalKobo: unit * quantity,
      stockTracked: v.stockQuantity !== null, available: v.stockQuantity, categoryId: p.categoryId,
    };
    if (p.status !== "published" || !v.isActive) {
      line.problem = "unavailable";
      problems.push(`${p.name} is no longer available.`);
    } else if (p.kind !== "physical") {
      line.problem = "not_purchasable";
      problems.push(`${p.name} is a service — book it on WhatsApp.`);
    } else if (v.stockQuantity !== null && v.stockQuantity < quantity) {
      line.problem = "insufficient_stock";
      problems.push(
        v.stockQuantity === 0
          ? `${p.name} (${v.title}) is sold out.`
          : `Only ${v.stockQuantity} of ${p.name} (${v.title}) left.`,
      );
    }
    return line;
  });

  const valid = lines.filter((l) => !l.problem);
  const subtotalKobo = valid.reduce((s, l) => s + l.lineTotalKobo, 0);

  // Coupon
  let discountKobo = 0;
  let coupon: Quote["coupon"] = null;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    const result = evaluateCoupon(c, valid, subtotalKobo, now);
    discountKobo = result.discountKobo;
    coupon = c
      ? { code: c.code, id: c.id, applied: result.ok, message: result.message }
      : { code, id: "", applied: false, message: "That code isn't valid." };
  }

  // Shipping
  const shippingOptions = await listShippingOptions(db, input.country, input.region);
  const selectedShipping = input.shippingMethodId
    ? shippingOptions.find((o) => o.id === input.shippingMethodId) ?? null
    : null;
  if (input.shippingMethodId && !selectedShipping) problems.push("The selected delivery method isn't available for this address.");
  const shippingKobo = selectedShipping?.feeKobo ?? 0;

  return {
    lines,
    subtotalKobo,
    discountKobo,
    shippingKobo,
    totalKobo: subtotalKobo - discountKobo + shippingKobo,
    coupon,
    shippingOptions,
    selectedShipping,
    problems,
  };
}

type CouponRow = typeof coupons.$inferSelect;

export function evaluateCoupon(
  c: CouponRow | undefined,
  lines: Pick<QuotedLine, "productId" | "categoryId" | "lineTotalKobo">[],
  subtotalKobo: number,
  now: Date,
): { ok: boolean; discountKobo: number; message: string } {
  const no = (message: string) => ({ ok: false, discountKobo: 0, message });
  if (!c || !c.isActive) return no("That code isn't valid.");
  if (c.startsAt && now < c.startsAt) return no("That code isn't active yet.");
  if (c.expiresAt && now >= c.expiresAt) return no("That code has expired.");
  if (c.usageLimit !== null && c.usageCount >= c.usageLimit) return no("That code has reached its usage limit.");
  if (subtotalKobo < c.minSubtotalKobo) return no("Your bag doesn't meet this code's minimum spend.");

  const scoped = c.productIds.length > 0 || c.categoryIds.length > 0;
  const eligible = lines
    .filter((l) => !scoped || (l.productId && c.productIds.includes(l.productId)) || (l.categoryId && c.categoryIds.includes(l.categoryId)))
    .reduce((s, l) => s + l.lineTotalKobo, 0);
  if (eligible === 0) return no("This code doesn't apply to the items in your bag.");

  const raw = c.type === "percent" ? Math.floor((eligible * c.value) / 100) : c.value;
  const discountKobo = Math.min(raw, eligible);
  return { ok: true, discountKobo, message: "Code applied." };
}

/** Lookup used by the product page / cart to validate a variant exists and is buyable. */
export async function getPurchasableVariant(db: Executor, variantId: string) {
  const [row] = await db
    .select({ v: productVariants, p: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.id, variantId), eq(products.status, "published"), eq(productVariants.isActive, true)))
    .limit(1);
  return row ?? null;
}
