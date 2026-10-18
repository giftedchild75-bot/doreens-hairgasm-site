"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useBag } from "./CartProvider";
import { useQuote } from "./useQuote";
import { formatNaira } from "@/lib/money";
import { track } from "./track";

const NG_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
const COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"], ["GH", "Ghana"], ["GB", "United Kingdom"], ["US", "United States"], ["CA", "Canada"], ["IE", "Ireland"],
  ["ZA", "South Africa"], ["KE", "Kenya"], ["AE", "United Arab Emirates"], ["DE", "Germany"], ["FR", "France"], ["IT", "Italy"],
  ["NL", "Netherlands"], ["AU", "Australia"],
];

interface Prefill { email?: string; name?: string; phone?: string }

export function CheckoutForm({ prefill, initialCoupon }: { prefill: Prefill; initialCoupon: string | null }) {
  const bag = useBag();
  const [f, setF] = useState({
    email: prefill.email ?? "", name: prefill.name ?? "", phone: prefill.phone ?? "",
    addressLine1: "", city: "", region: "", country: "NG", deliveryInstructions: "",
  });
  const [shippingMethodId, setShip] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // One idempotency key per checkout attempt, so a double-click can't create two orders.
  const checkoutKey = useMemo(() => crypto.randomUUID(), []);
  const { quote, loading } = useQuote(
    bag.lines,
    { couponCode: initialCoupon, country: f.country, region: f.region || null, shippingMethodId },
    bag.ready,
  );

  useEffect(() => {
    if (bag.ready && bag.lines.length) track("checkout_start", { items: bag.count });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bag.ready]);

  // Drop a selected method that no longer applies to the address.
  useEffect(() => {
    if (quote && shippingMethodId && !quote.shippingOptions.some((o) => o.id === shippingMethodId)) setShip(null);
    if (quote && !shippingMethodId && quote.shippingOptions.length === 1) setShip(quote.shippingOptions[0].id);
  }, [quote, shippingMethodId]);

  if (!bag.ready) return <p className="muted">Loading…</p>;
  if (!bag.lines.length) {
    return <div className="empty-state"><p>Your bag is empty.</p><Link className="btn btn-primary" href="/shop">Shop the collection</Link></div>;
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (k: string) => errors[k]?.[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setProblems([]);
    setErrors({});
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          deliveryInstructions: f.deliveryInstructions || null,
          shippingMethodId,
          couponCode: initialCoupon,
          checkoutKey,
          lines: bag.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(d.fields ?? {});
        setProblems(d.problems ?? []);
        setMessage(d.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      bag.clear();
      if (d.paymentUrl) window.location.href = d.paymentUrl;
      else window.location.href = `/orders/${d.reference}`;
    } catch {
      setMessage("Network problem — check your connection and try again. You won't be charged twice.");
      setBusy(false);
    }
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, full = false) => (
    <div className={`form-field${full ? " full" : ""}`}>
      <label htmlFor={`co-${k}`}>{label}</label>
      <input id={`co-${k}`} className="field" value={f[k]} onChange={set(k)} aria-invalid={!!err(k)} aria-describedby={err(k) ? `co-${k}-err` : undefined} {...props} />
      {err(k) && <div className="err" id={`co-${k}-err`}>{err(k)}</div>}
    </div>
  );

  return (
    <form className="cart-layout" onSubmit={submit} noValidate>
      <div>
        {message && (
          <div className="notice error" role="alert" style={{ marginBottom: 24 }}>
            {message}
            {problems.length > 0 && <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            {problems.length > 0 && <p><Link className="mini-link" href="/cart">Review your bag</Link></p>}
          </div>
        )}
        <div className="form-section">
          <h2>Contact</h2>
          <div className="form-grid">
            {field("email", "Email", { type: "email", autoComplete: "email", required: true }, true)}
            {field("name", "Full name", { autoComplete: "name", required: true })}
            {field("phone", "Phone (WhatsApp preferred)", { type: "tel", autoComplete: "tel", required: true })}
          </div>
        </div>
        <div className="form-section">
          <h2>Delivery address</h2>
          <div className="form-grid">
            <div className="form-field full">
              <label htmlFor="co-country">Country</label>
              <select id="co-country" className="field" value={f.country} onChange={(e) => { set("country")(e); setF((s) => ({ ...s, region: "" })); }} autoComplete="country">
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </div>
            {field("addressLine1", "Street address", { autoComplete: "street-address", required: true }, true)}
            {field("city", "City / town", { autoComplete: "address-level2", required: true })}
            {f.country === "NG" ? (
              <div className="form-field">
                <label htmlFor="co-region">State</label>
                <select id="co-region" className="field" value={f.region} onChange={set("region")} required aria-invalid={!!err("region")}>
                  <option value="">Select state…</option>
                  {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {err("region") && <div className="err">{err("region")}</div>}
              </div>
            ) : (
              field("region", "State / region / county", { autoComplete: "address-level1", required: true })
            )}
            <div className="form-field full">
              <label htmlFor="co-notes">Delivery instructions (optional)</label>
              <textarea id="co-notes" className="field" rows={2} maxLength={500} value={f.deliveryInstructions} onChange={set("deliveryInstructions")} />
            </div>
          </div>
        </div>
        <div className="form-section">
          <h2>Delivery method</h2>
          {!f.region ? (
            <p className="muted">Enter your address to see delivery options.</p>
          ) : quote && quote.shippingOptions.length === 0 ? (
            <p className="notice">We don&apos;t have an online delivery option for this address yet — please order on WhatsApp and we&apos;ll arrange delivery with you.</p>
          ) : (
            quote?.shippingOptions.map((o) => (
              <label className="radio-card" key={o.id}>
                <input type="radio" name="shipping" checked={shippingMethodId === o.id} onChange={() => setShip(o.id)} />
                <span style={{ flex: 1 }}>
                  <strong>{o.name}</strong> — {formatNaira(o.feeKobo)}
                  {o.estimatedDays && <span className="muted"> · {o.estimatedDays}</span>}
                  {o.description && <span className="muted" style={{ display: "block", fontSize: 13 }}>{o.description}</span>}
                </span>
              </label>
            ))
          )}
          {err("shippingMethodId") && <div className="err">{err("shippingMethodId")}</div>}
        </div>
        <div className="form-section">
          <h2>Payment</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            You&apos;ll be taken to Paystack&apos;s secure page to pay by card, bank transfer or USSD. Your card details never touch our site.
            Your order is confirmed once payment is verified.
          </p>
        </div>
      </div>
      <aside className="summary" aria-busy={loading}>
        <h2>Order summary</h2>
        {quote?.lines.map((l) => (
          <div className="summary-row" key={l.variantId}>
            <span>{l.quantity} × {l.productName}{l.variantTitle !== "Default" ? ` (${l.variantTitle})` : ""}</span>
            <span>{formatNaira(l.lineTotalKobo)}</span>
          </div>
        ))}
        <div className="summary-row" style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 12 }}><span>Subtotal</span><span>{quote ? formatNaira(quote.subtotalKobo) : "…"}</span></div>
        {quote && quote.discountKobo > 0 && <div className="summary-row"><span>Discount ({quote.coupon?.code})</span><span>−{formatNaira(quote.discountKobo)}</span></div>}
        {quote?.coupon && !quote.coupon.applied && <p className="line-problem" style={{ fontSize: 13 }}>{quote.coupon.code}: {quote.coupon.message}</p>}
        <div className="summary-row"><span>Delivery</span><span>{quote?.selectedShipping ? formatNaira(quote.shippingKobo) : "—"}</span></div>
        <div className="summary-row total"><span>Total</span><span>{quote ? formatNaira(quote.totalKobo) : "…"}</span></div>
        {quote && quote.problems.length > 0 && (
          <ul className="notice error" style={{ listStyle: "none", marginTop: 12 }}>{quote.problems.map((p) => <li key={p}>{p}</li>)}</ul>
        )}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18 }}
          disabled={busy || !quote || quote.problems.length > 0 || !shippingMethodId || (quote.coupon !== null && !quote.coupon.applied)}>
          {busy ? "Placing order…" : quote ? `Pay ${formatNaira(quote.totalKobo)}` : "Pay"}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Prices, discounts and delivery are re-checked on our server when you place the order.</p>
      </aside>
    </form>
  );
}
