"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useBag } from "./CartProvider";
import { useQuote } from "./useQuote";
import { formatNaira } from "@/lib/money";

export function CartView({ paymentsEnabled, whatsappNumber }: { paymentsEnabled: boolean; whatsappNumber: string }) {
  const bag = useBag();
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const { quote, loading, error } = useQuote(bag.lines, { couponCode: applied }, bag.ready);

  if (!bag.ready) return <p className="muted" style={{ textAlign: "center" }}>Loading your bag…</p>;
  if (bag.lines.length === 0) {
    return (
      <div className="empty-state">
        <p>Your bag is empty — let&apos;s find your next look.</p>
        <p style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="btn btn-primary" href="/shop">Shop the collection</Link>
          <Link className="btn btn-outline" href="/guide">New to wigs? Start here</Link>
        </p>
      </div>
    );
  }

  const lineQuote = (variantId: string) => quote?.lines.find((l) => l.variantId === variantId);
  const blocked = !quote || quote.problems.length > 0;
  const waText = encodeURIComponent(
    [
      "Hi Doreen! I'd like to order (enquiry from the website — not yet paid):",
      ...bag.lines.map((l) => `• ${l.quantity} × ${l.name}${l.variantTitle !== "Default" ? ` (${l.variantTitle})` : ""}`),
      quote ? `Items total: ${formatNaira(quote.subtotalKobo - quote.discountKobo)} (before delivery)` : "",
    ].filter(Boolean).join("\n"),
  );

  return (
    <div className="cart-layout">
      <div>
        {error && <p className="notice error" role="alert">{error}</p>}
        {bag.lines.map((l) => {
          const q = lineQuote(l.variantId);
          const max = q?.available ?? 20;
          return (
            <div className="cart-line" key={l.variantId}>
              {l.image ? <Image src={l.image} alt="" width={88} height={117} /> : <span />}
              <div>
                <h3><Link href={`/products/${l.slug}`}>{l.name}</Link></h3>
                {l.variantTitle !== "Default" && <div className="muted" style={{ fontSize: 13 }}>{l.variantTitle}</div>}
                <div className="price">{q && !q.problem ? formatNaira(q.unitPriceKobo) : "—"}</div>
                {q?.problem === "insufficient_stock" && <div className="line-problem">{q.available === 0 ? "Sold out" : `Only ${q.available} available`}</div>}
                {q?.problem === "unavailable" && <div className="line-problem">No longer available — please remove it.</div>}
                {q?.problem === "not_purchasable" && <div className="line-problem">Services are booked on WhatsApp.</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="qty" role="group" aria-label={`Quantity for ${l.name}`}>
                  <button type="button" aria-label="Decrease" disabled={l.quantity <= 1} onClick={() => bag.setQuantity(l.variantId, l.quantity - 1)}>−</button>
                  <input aria-label="Quantity" value={l.quantity} readOnly />
                  <button type="button" aria-label="Increase" disabled={l.quantity >= Math.min(20, max)} onClick={() => bag.setQuantity(l.variantId, l.quantity + 1)}>+</button>
                </div>
                <div style={{ marginTop: 8 }}><button type="button" className="link-btn" onClick={() => bag.remove(l.variantId)}>Remove</button></div>
              </div>
            </div>
          );
        })}
      </div>
      <aside className="summary" aria-busy={loading}>
        <h2>Order summary</h2>
        <form className="coupon-row" onSubmit={(e) => { e.preventDefault(); setApplied(coupon.trim() || null); }}>
          <label className="sr-only" htmlFor="coupon">Discount code</label>
          <input id="coupon" className="field" placeholder="Discount code" value={coupon} onChange={(e) => setCoupon(e.target.value)} autoComplete="off" />
          <button className="btn btn-outline" type="submit">Apply</button>
        </form>
        {quote?.coupon && <p className={quote.coupon.applied ? "muted" : "line-problem"} style={{ fontSize: 13 }} role="status">{quote.coupon.code}: {quote.coupon.message}</p>}
        <div className="summary-row"><span>Subtotal</span><span>{quote ? formatNaira(quote.subtotalKobo) : "…"}</span></div>
        {quote && quote.discountKobo > 0 && <div className="summary-row"><span>Discount</span><span>−{formatNaira(quote.discountKobo)}</span></div>}
        <div className="summary-row"><span>Delivery</span><span className="muted">Calculated at checkout</span></div>
        <div className="summary-row total"><span>Total so far</span><span>{quote ? formatNaira(quote.subtotalKobo - quote.discountKobo) : "…"}</span></div>
        {quote && quote.problems.length > 0 && (
          <ul className="notice error" role="alert" style={{ listStyle: "none", marginTop: 16 }}>
            {quote.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {paymentsEnabled ? (
            <Link className="btn btn-primary" href={blocked ? "#" : `/checkout${applied ? `?coupon=${encodeURIComponent(applied)}` : ""}`} aria-disabled={blocked} style={{ justifyContent: "center" }}>
              Checkout securely
            </Link>
          ) : (
            <p className="notice" style={{ fontSize: 13 }}>Online payment is launching soon. For now, send your bag to us on WhatsApp and we&apos;ll confirm availability, delivery and payment with you.</p>
          )}
          <a className={paymentsEnabled ? "btn btn-outline" : "btn btn-primary"} style={{ justifyContent: "center" }} href={`https://wa.me/${whatsappNumber}?text=${waText}`} target="_blank" rel="noopener">
            {paymentsEnabled ? "Or order on WhatsApp" : "Send my bag on WhatsApp"}
          </a>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>A WhatsApp message is an enquiry — your order is confirmed once Doreen replies and payment is arranged.</p>
        </div>
      </aside>
    </div>
  );
}
