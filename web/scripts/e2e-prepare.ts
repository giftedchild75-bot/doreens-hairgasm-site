/** Fresh, seeded database for the end-to-end suite (never run against production). */
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { adminUsers, products, productVariants, shippingMethods } from "../src/db/schema";
import { seedCatalog } from "../src/server/seed";
import { LEGACY_CATALOG } from "../tests/fixtures/legacy";
import { hashPassword } from "../src/server/passwords";

const url = process.env.DATABASE_URL ?? "";
if (!url.startsWith("pglite:./.data/e2e")) throw new Error("e2e-prepare only runs against the local e2e database");
fs.rmSync(".data/e2e", { recursive: true, force: true });

const db = await getDb();
await seedCatalog(db, LEGACY_CATALOG);
await db.update(shippingMethods).set({ isActive: true, feeKobo: 500_000, estimatedDays: "2–4 working days" }).where(eq(shippingMethods.name, "Nationwide delivery (Nigeria)"));
// One tracked, scarce item for the sold-out journey.
const [octavia] = await db.select().from(products).where(eq(products.slug, "octavia"));
await db.update(productVariants).set({ stockQuantity: 1 }).where(eq(productVariants.productId, octavia.id));
await db.insert(adminUsers).values([
  { email: "owner@e2e.test", name: "E2E Owner", role: "owner", passwordHash: await hashPassword("owner-password-123") },
  { email: "staff@e2e.test", name: "E2E Staff", role: "staff", passwordHash: await hashPassword("staff-password-123") },
]);
console.log("e2e database ready");
process.exit(0);
