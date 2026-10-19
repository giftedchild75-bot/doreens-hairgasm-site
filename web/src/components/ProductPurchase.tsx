"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useBag } from "./CartProvider";
import { formatNaira } from "@/lib/money";
import { swatch } from "@/lib/swatch";
import { track } from "./track";
import { SaveButton } from "./SaveButton";

export interface PurchaseVariant {
  id: string;
  title: string;
  priceKobo: number;
  salePriceKobo: number | null;
  stockQuantity: number | null;
  lengthInches: number | null;
  color: string | null;
  laceType: string | null;
  density: string | null;
  capSize: string | null;
}

export function ProductPurchase(props: {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  kind: "physical" | "service";
  variants: PurchaseVariant[];
  whatsappHref: string;
  paymentsEnabled: boolean;
}) {
  const { variants } = props;
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const bag = useBag();
  const router = useRouter();
  const v = useMemo(() => variants.find((x) => x.id === variantId) ?? variants[0], [variants, variantId]);

  useEffect(() => {
    track("product_view", { slug: props.slug }, props.productId);
    // Recently viewed (display convenience only).
    try {
      const key = "dh_recent";
      const list: string[] = JSON.parse(localStorage.getItem(key) ?? "[]").filter((s: string) => s !== props.slug);
      localStorage.setItem(key, JSON.stringify([props.slug, ...list].slice(0, 8)));
    } catch {}
  }, [props.slug, props.productId]);

  // Name the choice for what it is when every option differs by the same thing.
  const byColour = variants.every((x) => x.color && x.title === x.color);
  const byLength = !byColour && variants.every((x) => x.lengthInches && x.title === `${x.lengthInches}"`);
  const optionLabel = byColour ? "Colour" : byLength ? "Length" : "Option";

  if (!v) return <p className="notice">This piece isn&apos;t available right now.</p>;

  const tracked = v.stockQuantity !== null;
  const max = tracked ? Math.min(20, v.stockQuantity!) : 20;
  const soldOut = tracked && v.stockQuantity === 0;
  const inBag = bag.lines.find((l) => l.variantId === v.id)?.quantity ?? 0;
  const canAdd = props.kind === "physical" && !soldOut && qty >= 1 && qty + inBag <= max;

  function add(goToCheckout: boolean) {
    if (!canAdd) return;
    bag.add({ variantId: v.id, quantity: qty, slug: props.slug, name: props.name, variantTitle: v.title, image: props.image });
    track("add_to_cart", { slug: props.slug, variant: v.title, quantity: qty }, props.productId);
    if (goToCheckout) router.push("/checkout");
    else {
      setToast(`${props.name} added to your bag`);
      setTimeout(() => setToast(null), 3500);
    }
  }

  const priceBlock = (
    <div className="pdp-price">
      {v.salePriceKobo !== null && <s>{formatNaira(v.priceKobo)}</s>}
      {formatNaira(v.salePriceKobo ?? v.priceKobo)}
    </div>
  );

  if (props.kind === "service") {
    return (
      <>
        {priceBlock}
        <p className="stock-line">Booked by appointment — confirm your slot and details on WhatsApp.</p>
        <div className="buy-row">
          <a className="btn btn-primary" href={props.whatsappHref} target="_blank" rel="noopener">Book on WhatsApp</a>
        </div>
      </>
    );
  }

  return (
    <>
      {priceBlock}
      <p className={`stock-line${soldOut ? " out" : tracked && v.stockQuantity! <= 3 ? " low" : ""}`} aria-live="polite">
        {soldOut ? "Sold out" : tracked ? (v.stockQuantity! <= 3 ? `Only ${v.stockQuantity} left` : "In stock") : "Available to order"}
      </p>

      {variants.length > 1 && (
        <div className="option-group">
          <span id="variant-label">{optionLabel}</span>
          <div className="filter-options" role="radiogroup" aria-labelledby="variant-label">
            {variants.map((x) => (
              <label className="filter-chip" key={x.id}>
                <input type="radio" name="variant" value={x.id} checked={x.id === v.id} onChange={() => { setVariantId(x.id); setQty(1); }} />
                <span>
                  {byColour && x.color && <i className="chip-swatch" style={{ background: swatch(x.color) }} aria-hidden="true" />}
                  {x.title}{x.stockQuantity === 0 ? " — sold out" : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="option-group">
        <span id="qty-label">Quantity</span>
        <div className="qty" role="group" aria-labelledby="qty-label">
          <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <input aria-label="Quantity" inputMode="numeric" value={qty} onChange={(e) => {
            const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
            setQty(Number.isFinite(n) ? Math.max(1, Math.min(max, n)) : 1);
          }} />
          <button type="button" aria-label="Increase quantity" disabled={qty >= max - inBag} onClick={() => setQty((q) => Math.min(max, q + 1))}>+</button>
        </div>
        {tracked && inBag > 0 && qty + inBag > max && <p className="hint muted">You already have {inBag} in your bag.</p>}
      </div>

      <div className="buy-row">
        <button type="button" className="btn btn-primary" disabled={!canAdd} onClick={() => add(false)}>
          {soldOut ? "Sold out" : "Add to bag"}
        </button>
        {props.paymentsEnabled && (
          <button type="button" className="btn btn-outline" disabled={!canAdd} onClick={() => add(true)}>Buy now</button>
        )}
        <SaveButton slug={props.slug} name={props.name} className="save-btn pdp-save" />
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Prefer to chat? <a className="mini-link" href={props.whatsappHref} target="_blank" rel="noopener">Ask about this piece on WhatsApp</a>
      </p>
      {toast && (
        <div className="toast" role="status">
          {toast} <Link href="/cart">View bag</Link>
        </div>
      )}
    </>
  );
}
