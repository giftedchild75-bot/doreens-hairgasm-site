import Link from "next/link";
import Image from "next/image";
import type { ProductCard as Card } from "@/server/catalog";
import { formatNaira } from "@/lib/money";

export function ProductCard({ p, index }: { p: Card; index?: number }) {
  return (
    <article className="card">
      <Link href={`/products/${p.slug}`} aria-label={`${p.name} — view details`}>
        <div className="card-media">
          {index !== undefined && <span className="card-index">{String(index + 1).padStart(2, "0")} /</span>}
          {!p.inStock && <span className="card-badge">Sold out</span>}
          {p.inStock && p.compareAtKobo && <span className="card-badge">Sale</span>}
          {p.image && (
            <Image src={p.image.url} alt={p.image.alt} fill sizes="(max-width: 720px) 90vw, (max-width: 1140px) 45vw, 360px" />
          )}
          <div className="card-media-hover" aria-hidden="true">{p.name} — view</div>
        </div>
      </Link>
      <div className="card-body">
        <h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3>
        <p className="desc">{p.description}</p>
        {p.specs.length > 0 && (
          <ul className="spec-list">{p.specs.map((s) => <li key={s}>{s}</li>)}</ul>
        )}
        <div className="card-foot">
          <span className="price">
            {p.compareAtKobo && <s>{formatNaira(p.compareAtKobo)}</s>}
            {formatNaira(p.priceKobo)}
          </span>
          <Link className="mini-link" href={`/products/${p.slug}`}>{p.kind === "service" ? "Book" : "Shop"}</Link>
        </div>
      </div>
    </article>
  );
}
