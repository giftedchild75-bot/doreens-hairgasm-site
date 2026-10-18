import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getProductBySlug, LABELS, relatedProducts } from "@/server/catalog";
import { getSetting } from "@/server/seed";
import { currentAdmin } from "@/server/auth";
import { Gallery } from "@/components/Gallery";
import { ProductPurchase } from "@/components/ProductPurchase";
import { ProductCard } from "@/components/ProductCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { env, whatsappLink } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(await getDb(), slug);
  if (!data) return { title: "Not found" };
  const { product: p, images } = data;
  const description = p.seoDescription || p.description.slice(0, 160);
  return {
    title: p.seoTitle || p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.seoTitle || p.name, description, images: images[0] ? [images[0].url] : undefined, url: `/products/${p.slug}` },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const preview = (await searchParams).preview === "1" && !!(await currentAdmin());
  const db = await getDb();
  const data = await getProductBySlug(db, slug, { includeDrafts: preview });
  if (!data) notFound();
  const { product: p, category, variants, images } = data;
  const [related, deliveryInfo, returnsPolicy] = await Promise.all([
    relatedProducts(db, p),
    getSetting(db, "delivery_info"),
    getSetting(db, "returns_policy"),
  ]);
  const first = variants[0];
  const wa = whatsappLink(`Hi Doreen! I'm interested in ${p.name}. ${env.siteUrl}/products/${p.slug}`);

  const specRows: [string, string][] = [
    ...(p.texture ? [["Texture", LABELS[p.texture]] as [string, string]] : []),
    ...(p.lengthGroup ? [["Length", LABELS[p.lengthGroup] + (first?.lengthInches ? ` (${first.lengthInches}")` : "")] as [string, string]] : []),
    ...(p.colorFamily ? [["Colour family", LABELS[p.colorFamily]] as [string, string]] : []),
    ...(first?.laceType ? [["Lace", first.laceType] as [string, string]] : []),
    ...(first?.density ? [["Density", first.density] as [string, string]] : []),
    ...(first?.capSize ? [["Cap size", first.capSize] as [string, string]] : []),
  ];

  // Structured data built only from real fields; availability reflects stock tracking.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: images.map((i) => `${env.siteUrl}${i.url.startsWith("/") ? i.url : "/" + i.url}`),
    sku: first?.sku,
    brand: { "@type": "Brand", name: "Doreen's Hairgasm" },
    offers: variants.map((v) => ({
      "@type": "Offer",
      price: ((v.salePriceKobo ?? v.priceKobo) / 100).toFixed(2),
      priceCurrency: "NGN",
      sku: v.sku,
      url: `${env.siteUrl}/products/${p.slug}`,
      availability: v.stockQuantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    })),
  };

  return (
    <>
      <div className="page">
        <div className="container">
          {preview && p.status !== "published" && <p className="notice" style={{ marginBottom: 20 }}>Preview — this product is <strong>{p.status}</strong> and not visible to customers.</p>}
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link> / <Link href="/shop">Shop</Link>
            {category && <> / <Link href={`/shop?category=${category.slug}`}>{category.name}</Link></>} / <span aria-current="page">{p.name}</span>
          </nav>
          <div className="pdp">
            <Gallery images={images.map((i) => ({ url: i.url, alt: i.alt || p.name }))} name={p.name} />
            <div className="pdp-info">
              <div className="section-eyebrow" style={{ textAlign: "left" }}>{category?.name ?? "Collection"}</div>
              <h1>{p.name}</h1>
              <ProductPurchase
                productId={p.id}
                slug={p.slug}
                name={p.name}
                image={images[0]?.url ?? null}
                kind={p.kind}
                variants={variants.map((v) => ({
                  id: v.id, title: v.title, priceKobo: v.priceKobo, salePriceKobo: v.salePriceKobo, stockQuantity: v.stockQuantity,
                  lengthInches: v.lengthInches, color: v.color, laceType: v.laceType, density: v.density, capSize: v.capSize,
                }))}
                whatsappHref={wa}
                paymentsEnabled={env.paymentsMode !== "disabled"}
              />
              <p className="pdp-desc">{p.description}</p>
              {p.specs.length > 0 && <ul className="spec-list">{p.specs.map((s) => <li key={s}>{s}</li>)}</ul>}
              <div className="info-list">
                {specRows.length > 0 && (
                  <details open>
                    <summary>Specifications</summary>
                    <table className="spec-table"><tbody>{specRows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
                  </details>
                )}
                <details>
                  <summary>Delivery</summary>
                  <p>{deliveryInfo || "Delivery options and fees for your address are shown at checkout."}</p>
                </details>
                <details>
                  <summary>Returns &amp; refunds</summary>
                  <p>
                    {returnsPolicy || "Please message us on WhatsApp before ordering if you have questions about returns — we'll explain exactly what applies to this piece."}{" "}
                    <Link className="mini-link" href="/policies/returns">Returns policy</Link>
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="section-tight" style={{ background: "var(--blush)" }}>
          <div className="container">
            <div className="section-head"><div className="section-eyebrow">You may also love</div><h2>Related Pieces</h2></div>
            <div className="grid-products">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
          </div>
        </section>
      )}
      <RecentlyViewed exclude={p.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
