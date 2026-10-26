import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { availableFacets, catalogQuerySchema, LABELS, listCategories, PAGE_SIZE, searchCatalog, SORTS } from "@/server/catalog";
import { ProductCard } from "@/components/ProductCard";
import { FilterForm } from "@/components/FilterForm";
import { SearchIcon } from "@/components/Icons";
import { whatsappLink } from "@/lib/env";

export const dynamic = "force-dynamic";

const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  featured: "Featured",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  name: "Name: A–Z",
  popular: "Most popular",
};

export async function generateMetadata({ searchParams }: PageProps<"/shop">): Promise<Metadata> {
  const q = catalogQuerySchema.parse(await searchParams);
  const title = q.category === "wigs" ? "Wigs" : q.category === "services" ? "Services" : "Shop the Collection";
  // Filtered/sorted variants of a listing all canonicalise to the category page.
  return { title, alternates: { canonical: q.category ? `/shop?category=${q.category}` : "/shop" } };
}

function Chip({ name, value, checked, label }: { name: string; value: string; checked: boolean; label: string }) {
  return (
    <label className="filter-chip">
      <input type="radio" name={name} value={value} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const q = catalogQuerySchema.parse(await searchParams);
  const db = await getDb();
  const [result, cats, facets] = await Promise.all([searchCatalog(db, q), listCategories(db), availableFacets(db)]);
  const active = Object.entries(q).filter(([k, v]) => v !== undefined && k !== "page" && k !== "sort");
  const activeCat = cats.find((c) => c.slug === q.category);
  const heading = activeCat?.name ?? "The Collection";

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => {
      if (v !== undefined && k !== "page") sp.set(k, String(v));
    });
    if (p > 1) sp.set("page", String(p));
    return `/shop?${sp.toString()}`;
  };

  const facetGroup = (legend: string, name: "texture" | "length" | "color", values: readonly string[]) =>
    values.length > 0 && (
      <fieldset>
        <legend>{legend}</legend>
        <div className="filter-options">
          <Chip name={name} value="" checked={!q[name]} label="Any" />
          {values.map((v) => <Chip key={v} name={name} value={v} checked={q[name] === v} label={LABELS[v]} />)}
        </div>
      </fieldset>
    );

  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="section-eyebrow">Shop</div>
          <h1>{heading}</h1>
          {activeCat?.description && <p className="cat-intro">{activeCat.description}</p>}
          <p aria-live="polite">
            {result.total} {result.total === 1 ? "piece" : "pieces"}
            {active.length ? " match your filters" : ""}
          </p>
        </div>
        <FilterForm key={JSON.stringify(q)}>
          <div className="shop-toolbar">
            <div className="catalog-search">
              <SearchIcon />
              <label className="sr-only" htmlFor="shop-q">Search the collection</label>
              <input id="shop-q" type="search" name="q" defaultValue={q.q ?? ""} placeholder="Search by name, colour or style…" autoComplete="off" />
            </div>
            <div className="catalog-sort">
              <label className="sr-only" htmlFor="shop-sort">Sort by</label>
              <select id="shop-sort" name="sort" defaultValue={q.sort ?? "featured"}>
                {SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="shop-layout">
            <aside className="filters" id="shop-filters" aria-label="Filters">
              <fieldset>
                <legend>Category</legend>
                <div className="filter-options">
                  <Chip name="category" value="" checked={!q.category} label="All" />
                  {cats.filter((c) => c.count > 0).map((c) => (
                    <Chip key={c.slug} name="category" value={c.slug} checked={q.category === c.slug} label={c.name} />
                  ))}
                </div>
              </fieldset>
              {facetGroup("Texture", "texture", facets.textures)}
              {facetGroup("Length", "length", facets.lengths)}
              {facetGroup("Colour", "color", facets.colors)}
              <fieldset>
                <legend>Price (₦)</legend>
                <div className="price-range">
                  <label className="sr-only" htmlFor="pmin">Minimum price in naira</label>
                  <input id="pmin" type="number" name="min" min={0} step={1000} placeholder="Min" defaultValue={q.min ?? ""} />
                  <span aria-hidden="true">–</span>
                  <label className="sr-only" htmlFor="pmax">Maximum price in naira</label>
                  <input id="pmax" type="number" name="max" min={0} step={1000} placeholder="Max" defaultValue={q.max ?? ""} />
                </div>
              </fieldset>
              <div className="filters-actions">
                <noscript><button className="btn btn-primary">Apply</button></noscript>
                {active.length > 0 && <Link className="mini-link" href="/shop">Clear all</Link>}
              </div>
            </aside>
            <div>
              {result.items.length > 0 ? (
                <div className="grid-products">
                  {result.items.map((p, i) => <ProductCard key={p.id} p={p} index={(result.page - 1) * PAGE_SIZE + i} />)}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No pieces match {q.q ? <>“{q.q}”</> : "these filters"}.</p>
                  <p>
                    <Link className="mini-link" href="/shop">Clear filters</Link> or{" "}
                    <a className="mini-link" href={whatsappLink(`Hi Doreen! I'm looking for ${q.q ?? "a specific style"} — can you help?`)} target="_blank" rel="noopener">
                      ask us on WhatsApp
                    </a>
                  </p>
                </div>
              )}
              {result.pages > 1 && (
                <nav className="pagination" aria-label="Pages">
                  {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) =>
                    p === result.page ? (
                      <span key={p} aria-current="page">{p}</span>
                    ) : (
                      <Link key={p} href={pageHref(p)}>{p}</Link>
                    ),
                  )}
                </nav>
              )}
            </div>
          </div>
        </FilterForm>
      </div>
    </div>
  );
}
