import Link from "next/link";
import Image from "next/image";
import type { ProductCard as Card } from "@/server/catalog";
import { formatNaira } from "@/lib/money";
import { swatch } from "@/lib/swatch";
import { SaveButton } from "./SaveButton";

const SIZES = "(max-width: 720px) 90vw, (max-width: 1140px) 45vw, 360px";

export function ProductCard({ p, index }: { p: Card; index?: number }) {
  const shown = p.colors.slice(0, 6);
  return (
    <article className="card">
      <Link href={`/products/${p.slug}`} aria-label={`${p.name} — view details`}>
        <div className={`card-media${p.hoverImage ? " has-alt" : ""}`}>
          {index !== undefined && <span className="card-index">{String(index + 1).padStart(2, "0")} /</span>}
          {!p.inStock && <span className="card-badge">Sold out</span>}
          {p.inStock && p.compareAtKobo && <span className="card-badge">Sale</span>}
          {p.image && <Image className="card-img" src={p.image.url} alt={p.image.alt} fill sizes={SIZES} />}
          {p.hoverImage && <Image className="card-img-alt" src={p.hoverImage.url} alt="" fill sizes={SIZES} aria-hidden="true" />}
          <div className="card-media-hover" aria-hidden="true">{p.kind === "service" ? "Book now" : "View piece"}</div>
        </div>
      </Link>
      {p.kind === "physical" && <SaveButton slug={p.slug} name={p.name} />}
      <div className="card-body">
        <h3><Link href={`/products/${p.slug}`}>{p.name}</Link></h3>
        <p className="desc">{p.description}</p>
        {shown.length > 1 && (
          <ul className="swatches" aria-label={`Available in ${p.colors.join(", ")}`}>
            {shown.map((c) => <li key={c} title={c} style={{ background: swatch(c) }} />)}
            {p.colors.length > shown.length && <li className="more">+{p.colors.length - shown.length}</li>}
          </ul>
        )}
        <div className="card-foot">
          <span className="price">
            {p.priceVaries && <small>From </small>}
            {p.compareAtKobo && <s>{formatNaira(p.compareAtKobo)}</s>}
            {formatNaira(p.priceKobo)}
          </span>
          <Link className="mini-link" href={`/products/${p.slug}`}>{p.kind === "service" ? "Book" : "Shop"}</Link>
        </div>
      </div>
    </article>
  );
}
