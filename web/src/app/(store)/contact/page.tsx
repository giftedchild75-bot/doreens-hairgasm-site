import type { Metadata } from "next";
import Link from "next/link";
import { brand, env, whatsappLink } from "@/lib/env";

export const metadata: Metadata = { title: "Contact", description: "Reach Doreen's Hairgasm on WhatsApp, Instagram or TikTok." };

export default function ContactPage() {
  const display = "+" + env.whatsappNumber.replace(/^(\d{3})(\d{3})(\d{3})(\d+)$/, "$1 $2 $3 $4");
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="section-eyebrow">Get in touch</div>
          <h1>Contact Us</h1>
          <p>The fastest way to reach us is WhatsApp — for orders, sizing, delivery quotes or bookings.</p>
        </div>
        <div className="why-grid" style={{ maxWidth: 900, margin: "0 auto" }}>
          <a className="why-item" href={whatsappLink("Hi Doreen! 💛")} target="_blank" rel="noopener"><div className="num">01</div><h3>WhatsApp</h3><p>{display}</p></a>
          <a className="why-item" href={brand.instagramUrl} target="_blank" rel="noopener"><div className="num">02</div><h3>Instagram</h3><p>@{brand.instagramHandle}</p></a>
          <a className="why-item" href={brand.tiktokUrl} target="_blank" rel="noopener"><div className="num">03</div><h3>TikTok</h3><p>@{brand.tiktokHandle}</p></a>
          <div className="why-item"><div className="num">04</div><h3>Location</h3><p>{brand.location}</p></div>
        </div>
        <p style={{ textAlign: "center", marginTop: 40 }} className="muted">
          Already ordered? <Link className="mini-link" href="/orders/lookup">Find your order</Link>
        </p>
      </div>
    </div>
  );
}
