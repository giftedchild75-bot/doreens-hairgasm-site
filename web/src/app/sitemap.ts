import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories, products } from "@/db/schema";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [ps, cs] = await Promise.all([
    db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.status, "published")),
    db.select({ slug: categories.slug }).from(categories).where(eq(categories.isVisible, true)),
  ]);
  const base = env.siteUrl;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...cs.map((c) => ({ url: `${base}/shop?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...ps.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...["about", "contact", "policies/delivery", "policies/returns", "policies/privacy"].map((p) => ({ url: `${base}/${p}`, priority: 0.4 })),
  ];
}
