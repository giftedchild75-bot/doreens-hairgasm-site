import type { Metadata } from "next";
import Link from "next/link";
import { brand, whatsappLink } from "@/lib/env";

export const metadata: Metadata = {
  title: "About",
  description: "Doreen's Hairgasm — luxury wigs and hair styling from Owerri, Nigeria, since 2021.",
};

export default function AboutPage() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="section-eyebrow">Our story</div>
          <h1>About Doreen&apos;s Hairgasm</h1>
          <p>Luxury wigs and expert styling from {brand.location} — since 2021.</p>
        </div>
        <div className="prose">
          <p>
            Doreen&apos;s Hairgasm is built around one idea: hair that fits flawlessly and makes you feel like yourself, only more so.
            Every piece is handpicked, glueless and install-ready — from affordable everyday essentials to exotic showstoppers.
          </p>
          <p>
            Beyond the collection, Doreen offers straightening, custom installs and styling, finished with the same attention to fit
            and detail. Real results are shared, unfiltered, on TikTok and Instagram.
          </p>
          <p>We deliver nationwide across Nigeria and internationally.</p>
          <p style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/shop">Shop the collection</Link>
            <a className="btn btn-outline" href={whatsappLink("Hi Doreen! 💛")} target="_blank" rel="noopener">Say hello on WhatsApp</a>
          </p>
        </div>
      </div>
    </div>
  );
}
