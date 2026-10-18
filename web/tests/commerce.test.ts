import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { checkoutInput, nationwideId, seededDb, variantFor } from "./helpers";
import type { Db } from "@/db/client";
import { coupons, inventoryMovements, orders, products, productVariants, shippingMethods } from "@/db/schema";
import { quoteCart } from "@/server/pricing";
import { createOrder, CheckoutError, expireStaleOrders, staffUpdateStatus } from "@/server/orders";

let db: Db;
let shipId: string;

beforeAll(async () => {
  db = await seededDb();
  shipId = await nationwideId(db);
});

describe("catalogue import", () => {
  it("imports every product in the catalogue it is given", async () => {
    const all = await db.select().from(products);
    expect(all).toHaveLength(43);
    expect(all.filter((p) => p.kind === "service").map((p) => p.name).sort()).toEqual(["Custom Install", "Straightening Service"]);
  });

  it("keeps the original prices", async () => {
    expect((await variantFor(db, "alicia")).priceKobo).toBe(7_000_000);
    expect((await variantFor(db, "nelly-wine")).priceKobo).toBe(2_850_000);
  });

  it("does not invent stock or activate delivery fees", async () => {
    const fresh = await (await import("./helpers")).seededDb();
    const vs = await fresh.select().from(productVariants);
    expect(vs.every((v) => v.stockQuantity === null)).toBe(true);
    const ms = await fresh.select().from(shippingMethods);
    // helpers activates exactly one for tests; the seed itself activates none
    expect(ms.filter((m) => m.isActive)).toHaveLength(1);
    expect(ms.filter((m) => m.name !== "Nationwide delivery (Nigeria)").every((m) => !m.isActive && m.feeKobo === 0)).toBe(true);
  });
});

describe("server-side pricing", () => {
  it("computes totals from the database, not the client", async () => {
    const v = await variantFor(db, "alicia");
    const q = await quoteCart(db, { lines: [{ variantId: v.id, quantity: 2 }], country: "NG", region: "Lagos", shippingMethodId: shipId });
    expect(q.subtotalKobo).toBe(14_000_000);
    expect(q.shippingKobo).toBe(500_000);
    expect(q.totalKobo).toBe(14_500_000);
    expect(q.problems).toEqual([]);
  });

  it("ignores price fields smuggled into a checkout payload", async () => {
    const v = await variantFor(db, "octavia");
    const { order } = await createOrder(db, {
      ...checkoutInput([{ variantId: v.id, quantity: 1 }], shipId),
      totalKobo: 100,
      subtotalKobo: 100,
      lines: [{ variantId: v.id, quantity: 1, priceKobo: 1 }],
    });
    expect(order.subtotalKobo).toBe(3_350_000);
    expect(order.totalKobo).toBe(3_350_000 + 500_000);
  });

  it("uses the sale price when one is set", async () => {
    const v = await variantFor(db, "kira");
    await db.update(productVariants).set({ salePriceKobo: 6_000_000 }).where(eq(productVariants.id, v.id));
    const q = await quoteCart(db, { lines: [{ variantId: v.id, quantity: 1 }] });
    expect(q.subtotalKobo).toBe(6_000_000);
    await db.update(productVariants).set({ salePriceKobo: null }).where(eq(productVariants.id, v.id));
  });

  it("refuses services and unpublished products", async () => {
    const svc = await variantFor(db, "custom-install");
    const q = await quoteCart(db, { lines: [{ variantId: svc.id, quantity: 1 }] });
    expect(q.lines[0].problem).toBe("not_purchasable");

    const v = await variantFor(db, "freya");
    await db.update(products).set({ status: "draft" }).where(eq(products.id, v.productId));
    const q2 = await quoteCart(db, { lines: [{ variantId: v.id, quantity: 1 }] });
    expect(q2.lines[0].problem).toBe("unavailable");
    await expect(createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId))).rejects.toBeInstanceOf(CheckoutError);
    await db.update(products).set({ status: "published" }).where(eq(products.id, v.productId));
  });

  it("only offers delivery methods that cover the address", async () => {
    const [intl] = await db.select().from(shippingMethods).where(eq(shippingMethods.name, "International delivery"));
    await db.update(shippingMethods).set({ isActive: true, feeKobo: 4_000_000 }).where(eq(shippingMethods.id, intl.id));
    const v = await variantFor(db, "alicia");
    const ng = await quoteCart(db, { lines: [{ variantId: v.id, quantity: 1 }], country: "NG", region: "Lagos" });
    expect(ng.shippingOptions.map((o) => o.name)).toEqual(["Nationwide delivery (Nigeria)"]);
    const gb = await quoteCart(db, { lines: [{ variantId: v.id, quantity: 1 }], country: "GB", region: "London", shippingMethodId: shipId });
    expect(gb.shippingOptions.map((o) => o.name)).toEqual(["International delivery"]);
    expect(gb.problems).toContain("The selected delivery method isn't available for this address.");
    await db.update(shippingMethods).set({ isActive: false }).where(eq(shippingMethods.id, intl.id));
  });
});

describe("coupons", () => {
  beforeEach(async () => {
    await db.delete(coupons);
  });

  async function quoteWith(code: string, slug = "alicia", qty = 1) {
    const v = await variantFor(db, slug);
    return quoteCart(db, { lines: [{ variantId: v.id, quantity: qty }], couponCode: code });
  }

  it("applies percentage and fixed discounts", async () => {
    await db.insert(coupons).values([
      { code: "TEN", type: "percent", value: 10 },
      { code: "FIVEK", type: "fixed", value: 500_000 },
    ]);
    expect((await quoteWith("ten")).discountKobo).toBe(700_000);
    expect((await quoteWith("FIVEK")).discountKobo).toBe(500_000);
  });

  it("never discounts below zero", async () => {
    await db.insert(coupons).values({ code: "HUGE", type: "fixed", value: 99_000_000 });
    const q = await quoteWith("HUGE");
    expect(q.discountKobo).toBe(q.subtotalKobo);
    expect(q.totalKobo).toBe(0);
  });

  it("rejects expired, not-yet-active, exhausted and under-minimum codes", async () => {
    const past = new Date(Date.now() - 86400_000);
    const future = new Date(Date.now() + 86400_000);
    await db.insert(coupons).values([
      { code: "OLD", type: "percent", value: 10, expiresAt: past },
      { code: "SOON", type: "percent", value: 10, startsAt: future },
      { code: "USED", type: "percent", value: 10, usageLimit: 1, usageCount: 1 },
      { code: "BIGSPEND", type: "percent", value: 10, minSubtotalKobo: 50_000_000 },
    ]);
    for (const code of ["OLD", "SOON", "USED", "BIGSPEND", "NOPE"]) {
      const q = await quoteWith(code);
      expect(q.coupon?.applied, code).toBe(false);
      expect(q.discountKobo, code).toBe(0);
    }
  });

  it("restricts scoped codes to eligible products", async () => {
    const alicia = await variantFor(db, "alicia");
    const octavia = await variantFor(db, "octavia");
    await db.insert(coupons).values({ code: "ALICIA", type: "percent", value: 50, productIds: [alicia.productId] });
    const q = await quoteCart(db, {
      lines: [{ variantId: alicia.id, quantity: 1 }, { variantId: octavia.id, quantity: 1 }],
      couponCode: "ALICIA",
    });
    expect(q.discountKobo).toBe(3_500_000); // half of Alicia only
  });

  it("refuses to place an order with an invalid code instead of silently dropping it", async () => {
    const v = await variantFor(db, "alicia");
    await expect(createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId, { couponCode: "FAKE" }))).rejects.toThrow(/isn't valid/);
  });

  it("cannot be over-redeemed by concurrent checkouts", async () => {
    await db.insert(coupons).values({ code: "ONCE", type: "percent", value: 10, usageLimit: 1 });
    const v = await variantFor(db, "monica");
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId, { couponCode: "ONCE" }))),
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const [c] = await db.select().from(coupons).where(eq(coupons.code, "ONCE"));
    expect(c.usageCount).toBe(1);
  });
});

describe("stock", () => {
  it("prevents purchase beyond available stock", async () => {
    const v = await variantFor(db, "nova");
    await db.update(productVariants).set({ stockQuantity: 1 }).where(eq(productVariants.id, v.id));
    await expect(createOrder(db, checkoutInput([{ variantId: v.id, quantity: 2 }], shipId))).rejects.toBeInstanceOf(CheckoutError);
    const [after] = await db.select().from(productVariants).where(eq(productVariants.id, v.id));
    expect(after.stockQuantity).toBe(1);
  });

  it("never oversells under concurrent checkouts", async () => {
    const v = await variantFor(db, "olivia");
    await db.update(productVariants).set({ stockQuantity: 3 }).where(eq(productVariants.id, v.id));
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId))),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const [after] = await db.select().from(productVariants).where(eq(productVariants.id, v.id));
    expect(after.stockQuantity).toBe(0);
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, v.id));
    expect(moves.reduce((s, m) => s + m.delta, 0)).toBe(-3);
  });

  it("releases reserved stock exactly once when an unpaid order expires", async () => {
    const v = await variantFor(db, "paris-piano");
    await db.update(productVariants).set({ stockQuantity: 2 }).where(eq(productVariants.id, v.id));
    const { order } = await createOrder(db, checkoutInput([{ variantId: v.id, quantity: 2 }], shipId));
    expect((await variantFor(db, "paris-piano")).stockQuantity).toBe(0);

    const later = new Date(Date.now() + 3 * 3600_000);
    const r1 = await expireStaleOrders(db, async () => {}, later);
    const r2 = await expireStaleOrders(db, async () => {}, later);
    expect(r1.cancelled).toBeGreaterThanOrEqual(1);
    expect(r2.cancelled).toBe(0);
    expect((await variantFor(db, "paris-piano")).stockQuantity).toBe(2);
    const [o] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(o.status).toBe("cancelled");
  });
});

describe("checkout validation", () => {
  it("rejects missing or malformed customer details", async () => {
    const v = await variantFor(db, "alicia");
    const base = checkoutInput([{ variantId: v.id, quantity: 1 }], shipId);
    for (const bad of [{ email: "nope" }, { name: "" }, { phone: "abc" }, { addressLine1: "" }, { country: "Nigeria" }]) {
      await expect(createOrder(db, { ...base, checkoutKey: crypto.randomUUID(), ...bad })).rejects.toThrow();
    }
    await expect(createOrder(db, { ...base, shippingMethodId: undefined })).rejects.toThrow();
    await expect(createOrder(db, { ...base, lines: [{ variantId: v.id, quantity: 0 }] })).rejects.toThrow();
    await expect(createOrder(db, { ...base, lines: [] })).rejects.toThrow();
  });

  it("is idempotent for a double-submitted checkout", async () => {
    const v = await variantFor(db, "nia");
    const input = checkoutInput([{ variantId: v.id, quantity: 1 }], shipId);
    const a = await createOrder(db, input);
    const b = await createOrder(db, input);
    expect(b.order.id).toBe(a.order.id);
    expect(b.reused).toBe(true);
  });

  it("creates a pending order with a unique human reference", async () => {
    const v = await variantFor(db, "alicia");
    const { order } = await createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId));
    expect(order.status).toBe("pending_payment");
    expect(order.reference).toMatch(/^DH-[A-Z2-9]{8}$/);
  });
});

describe("staff transitions", () => {
  it("cannot mark an unpaid order as shipped or paid", async () => {
    const v = await variantFor(db, "alicia");
    const { order } = await createOrder(db, checkoutInput([{ variantId: v.id, quantity: 1 }], shipId));
    const fakeAdmin = crypto.randomUUID();
    await expect(staffUpdateStatus(db, order.id, "shipped", fakeAdmin)).rejects.toThrow(/cannot move/);
    await expect(staffUpdateStatus(db, order.id, "paid", fakeAdmin)).rejects.toThrow(/cannot move/);
  });
});
