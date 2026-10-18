import path from "node:path";
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createTestDb, type Db } from "@/db/client";
import { products, productVariants, shippingMethods } from "@/db/schema";
import { seedCatalog } from "@/server/seed";
import { setPaystackFetchForTesting, type VerifiedTransaction } from "@/server/paystack";

export const TEST_SECRET = "sk_test_unit_secret";
process.env.PAYMENTS_ENABLED = "true";
process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
process.env.SITE_URL = "http://localhost:3000";
delete process.env.RESEND_API_KEY;

export async function seededDb(): Promise<Db> {
  const db = await createTestDb();
  await seedCatalog(db, path.join(__dirname, "..", "..", "config.js"));
  await db.update(shippingMethods).set({ isActive: true, feeKobo: 500_000 }).where(eq(shippingMethods.name, "Nationwide delivery (Nigeria)"));
  return db;
}

export async function variantFor(db: Db, slug: string) {
  const [row] = await db
    .select({ v: productVariants })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(products.slug, slug));
  return row.v;
}

export async function nationwideId(db: Db) {
  const [m] = await db.select().from(shippingMethods).where(eq(shippingMethods.name, "Nationwide delivery (Nigeria)"));
  return m.id;
}

export function checkoutInput(lines: { variantId: string; quantity: number }[], shippingMethodId: string, extra: Record<string, unknown> = {}) {
  return {
    lines,
    shippingMethodId,
    checkoutKey: randomUUID(),
    email: "ada@example.com",
    name: "Ada Test",
    phone: "+234 800 000 0000",
    addressLine1: "12 Test Street",
    city: "Lagos",
    region: "Lagos",
    country: "NG",
    ...extra,
  };
}

/** Fake Paystack: records calls; verify answers from a programmable table. */
export function fakePaystack() {
  const verify = new Map<string, Partial<VerifiedTransaction>>();
  const calls: { url: string; body?: unknown }[] = [];
  setPaystackFetchForTesting(async (url, init) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const ok = (data: unknown) => new Response(JSON.stringify({ status: true, message: "ok", data }), { status: 200 });
    if (url.endsWith("/transaction/initialize")) {
      const body = JSON.parse(String(init!.body));
      return ok({ authorization_url: `https://checkout.paystack.test/${body.reference}`, access_code: "x", reference: body.reference });
    }
    const m = url.match(/\/transaction\/verify\/(.+)$/);
    if (m) {
      const ref = decodeURIComponent(m[1]);
      const t = verify.get(ref);
      if (!t) return new Response(JSON.stringify({ status: false, message: "Transaction reference not found" }), { status: 400 });
      return ok({ id: 1, reference: ref, currency: "NGN", channel: "card", ...t });
    }
    if (url.endsWith("/refund")) return ok({ id: Math.floor(Math.random() * 1e9), status: "pending" });
    return new Response("not found", { status: 404 });
  });
  return { verify, calls };
}

export function signedWebhook(payload: unknown) {
  const raw = JSON.stringify(payload);
  return { raw, sig: createHmac("sha512", TEST_SECRET).update(raw).digest("hex") };
}
