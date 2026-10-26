import type { Metadata } from "next";
import Link from "next/link";
import { brand, whatsappLink } from "@/lib/env";

export const metadata: Metadata = {
  title: "About",
  description: "Doreen's Hairgasm — wigs, closures, ponytail combos and styling from Owerri, Nigeria, since 2021.",
};

// Facts only: location, year (printed on the packaging), tagline, services, range.
// No founder history or sourcing claims until the owner supplies them.
export default function AboutPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="section-eyebrow">Our story</div>
          <h1>Your hair, your crown</h1>
          <p>Wigs, closures and styling from {brand.location} — since 2021.</p>
        </div>
        <div className="prose">
          <p>
            Doreen&apos;s Hairgasm began with a simple belief, printed on every box we send out: your hair is your crown.
            The right unit doesn&apos;t just change how you look — it changes how you walk into a room.
          </p>
          <h2>What we do</h2>
          <p>
            We stock wigs, closures, frontals and ponytail combos — from sleek bone straight bobs to full pixie curls —
            and we photograph them ourselves, in the studio and on clients, so you can see the hair as it really is.
            Every length, colour and lace option on the site carries its own price.
          </p>
          <p>
            Doreen also offers straightening and custom installs, so a unit can be cut, coloured and finished to suit you.
          </p>
          <h2>How we look after you</h2>
          <p>
            Buying hair online shouldn&apos;t feel like a gamble. If you&apos;re unsure about lace, length or shade, message us on
            WhatsApp before you order — we&apos;ll answer honestly, including about hair type and density for the exact piece.
            Orders leave in our branded packaging, and we deliver nationwide across Nigeria and internationally.
          </p>
          <p style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/shop">Shop the collection</Link>
            <Link className="btn btn-outline" href="/guide">Read the wig guide</Link>
            <a className="btn btn-outline" href={whatsappLink("Hi Doreen! 💛")} target="_blank" rel="noopener">Say hello on WhatsApp</a>
          </p>
        </div>
      </div>
    </div>
  );
}
