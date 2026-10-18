import { describe, it, expect, beforeAll } from "vitest";
import { asc, eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/db/client";
import { products, productVariants } from "@/db/schema";
import { seedCatalog } from "@/server/seed";
import { STORE_CATALOG } from "@/catalog/store-catalog";
import fs from "node:fs";
import path from "node:path";

let db: Db;
beforeAll(async () => {
  db = await createTestDb();
  await seedCatalog(db, STORE_CATALOG);
});

const variantsOf = async (slug: string) => {
  const [p] = await db.select().from(products).where(eq(products.slug, slug));
  const vs = await db.select().from(productVariants).where(eq(productVariants.productId, p.id)).orderBy(asc(productVariants.position));
  return { p, vs };
};

describe("owner's catalogue", () => {
  it("contains only the owner's current products and services (the 41-wig range is retired)", async () => {
    const names = (await db.select({ n: products.name }).from(products)).map((r) => r.n).sort();
    expect(names).toEqual([
      "13x4 Swiss Frontal Lace", "Custom Install", "Deepwave Ponytail & Swiss Lace Frontal Combo", "Futura Wig",
      "Messy Bun & Swiss Frontal Combo", "SDD Pixie Curls", "Straightening Service",
    ]);
  });

  it("uses her prices exactly", async () => {
    const pixie = await variantsOf("sdd-pixie-curls");
    expect(pixie.vs.map((v) => [v.title, v.priceKobo / 100])).toEqual([
      ['12"', 170000], ['14"', 195000], ['16"', 220000], ['18"', 250000], ['20"', 300000], ['22"', 350000], ['24"', 420000], ['26"', 445000],
    ]);
    const lace = await variantsOf("13x4-swiss-frontal-lace");
    expect(lace.vs.map((v) => [v.title, v.priceKobo / 100])).toEqual([['12"', 30000], ['14"', 35000], ['16"', 45000], ['18"', 55000]]);
    expect((await variantsOf("futura-wig")).vs[0].priceKobo).toBe(7_000_000);
    expect((await variantsOf("deepwave-ponytail-swiss-lace-frontal-combo")).vs[0].priceKobo).toBe(5_800_000);
    expect((await variantsOf("messy-bun-swiss-frontal-combo")).vs[0].priceKobo).toBe(5_500_000);
  });

  it("does not create buyable options she gave no price for", async () => {
    const pixie = await variantsOf("sdd-pixie-curls");
    expect(pixie.vs.every((v) => v.color === "Black")).toBe(true);
    const lace = await variantsOf("13x4-swiss-frontal-lace");
    expect(lace.vs.some((v) => /13x6/i.test(v.title))).toBe(false);
  });

  it("keeps products without photos hidden as drafts and leaves stock untracked", async () => {
    const all = await db.select().from(products);
    for (const p of all) {
      const item = STORE_CATALOG.find((i) => i.name === p.name)!;
      expect(p.status, p.name).toBe(item.images.length ? "published" : "draft");
    }
    expect((await db.select().from(productVariants)).every((v) => v.stockQuantity === null)).toBe(true);
  });

  it("only references photos that exist in the site", () => {
    for (const item of STORE_CATALOG) {
      for (const img of item.images) expect(fs.existsSync(path.join(process.cwd(), "public", img.url)), img.url).toBe(true);
    }
  });
});
