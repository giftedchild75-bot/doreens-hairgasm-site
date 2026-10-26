import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/db/client";
import { bestsellers, categoryCovers, featuredProducts, listCategories, lookbook } from "@/server/catalog";
import { ProductCard } from "@/components/ProductCard";
import { Lookbook } from "@/components/Lookbook";
import { ShadeFinder } from "@/components/ShadeFinder";
import { Newsletter } from "@/components/Newsletter";
import { brand, env, whatsappLink } from "@/lib/env";
import type { ProductCard as Card } from "@/server/catalog";

export const dynamic = "force-dynamic";

function Rail({ id, num, eyebrow, title, intro, items, cta }: {
  id: string; num: string; eyebrow: string; title: string; intro?: string; items: Card[]; cta?: { href: string; label: string };
}) {
  if (!items.length) return null;
  return (
    <section id={id} className="section-tight">
      <div className="container">
        <div className="section-head" data-reveal>
          <div className="section-num" aria-hidden="true">{num}</div>
          <div className="section-eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
        <div className="grid-products">
          {items.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </div>
        {cta && (
          <p style={{ textAlign: "center", marginTop: 32 }}>
            <Link className="btn btn-primary" href={cta.href}>{cta.label}</Link>
          </p>
        )}
      </div>
    </section>
  );
}

export default async function Home() {
  const db = await getDb();
  const [featured, best, cats, covers, looks] = await Promise.all([
    featuredProducts(db, 6), bestsellers(db), listCategories(db), categoryCovers(db), lookbook(db),
  ]);
  const wa = whatsappLink("Hi Doreen! I'd love to place an order 💛");
  const help = whatsappLink("Hi Doreen! Can you help me choose? My budget is … and I like …");
  const payOnline = env.paymentsMode !== "disabled";
  const strip = ["Prices on every piece", "Photographed in our studio", brand.location, payOnline ? "Secure checkout by Paystack" : "Order on WhatsApp", "Nationwide & international delivery", "Since 2021"];

  return (
    <>
      <section className="hero" id="top">
        <div className="hero-media">
          {/* Approved brand image, used unaltered: salon, mannequin, mirror and the branded bag. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-media-img" src="/assets/hero-install.jpg" alt="Doreen's Hairgasm burgundy layered wig on a mannequin in the salon, beside the branded Doreen's Hairgasm bag" fetchPriority="high" />
        </div>
        <div className="hero-glow" id="hero-glow" aria-hidden="true" />
        <div className="hero-overlay">
          <div className="hero-copy">
            <div className="eyebrow">Wigs · Closures · Styling — {brand.location}</div>
            <h1>Your hair,<br /><em>your crown.</em></h1>
            <p className="lead">Wigs, frontals and ponytail combos, styled and photographed in our own studio. Every price is on the page — and a real person on WhatsApp will help you choose length, lace and colour before you buy.</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/shop">Shop the collection</Link>
              <a className="link-underline" href={help} target="_blank" rel="noopener">Help me choose</a>
            </div>
          </div>
        </div>
      </section>

      <div className="strip" aria-hidden="true">
        <div className="strip-inner">
          <div className="strip-track">{[...strip, ...strip].map((t, i) => <span key={i}>{t}</span>)}</div>
        </div>
      </div>

      <Rail id="collection" num="02" eyebrow="The Collection" title="In the Studio Now" items={featured}
        intro="Our current pieces, photographed as they are. Tap a style to see every length, colour and lace option with its price."
        cta={{ href: "/shop", label: "Shop all pieces" }} />

      {cats.some((c) => c.count > 0) && (
        <section className="section-tight" id="categories" style={{ background: "var(--blush)" }}>
          <div className="container">
            <div className="section-head" data-reveal>
              <div className="section-eyebrow">Shop by</div>
              <h2>Category</h2>
            </div>
            <div className="cat-grid">
              {cats.filter((c) => c.count > 0).map((c) => {
                const cover = covers.get(c.slug);
                return (
                  <Link key={c.id} className="cat-tile" href={`/shop?category=${c.slug}`}>
                    {cover && <Image src={cover.url} alt="" fill sizes="(max-width: 720px) 45vw, 280px" />}
                    <div className="cat-tile-body">
                      <h3>{c.name}</h3>
                      <span>{c.count} {c.count === 1 ? "piece" : "pieces"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="section-tight" id="start-here">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-eyebrow">New to wigs?</div>
            <h2>Start Here</h2>
            <p>Three things decide how a unit looks on you. Our guide explains each in a minute.</p>
          </div>
          <div className="start-grid">
            <Link className="start-card" href="/guide#lace" data-reveal><h3>Lace</h3><p>Closure or frontal, 2x6 or 13x4 — what the numbers mean for your parting.</p><span>Read →</span></Link>
            <Link className="start-card" href="/guide#length" data-reveal><h3>Length</h3><p>Where 10&quot;, 14&quot; and 30&quot; actually fall, and why curls sit shorter.</p><span>Read →</span></Link>
            <Link className="start-card" href="/guide#care" data-reveal><h3>Care</h3><p>Simple habits that keep a unit looking fresh for longer.</p><span>Read →</span></Link>
          </div>
        </div>
      </section>

      <Lookbook looks={looks} />

      <Rail id="bestsellers" num="✦" eyebrow="Most Loved" title="Bestsellers" items={best} cta={{ href: "/shop?sort=popular", label: "Shop bestsellers" }} />

      <section id="shade-finder" className="shade-finder">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-num" aria-hidden="true">03</div>
            <div className="section-eyebrow">Personal Styling</div>
            <h2>Find Your Shade</h2>
            <p>Answer three quick questions and we&apos;ll match you with real pieces from the collection — then finish the fitting over WhatsApp.</p>
          </div>
          <ShadeFinder whatsappNumber={env.whatsappNumber} />
        </div>
      </section>

      <section id="why">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-num" aria-hidden="true">04</div>
            <div className="section-eyebrow">The Difference</div>
            <h2>Why Shop With Doreen</h2>
          </div>
          <div className="why-grid">
            <div className="why-item" data-reveal><div className="num">01</div><h3>Prices You Can See</h3><p>Every length, colour and lace option shows its own price. No guessing, no &ldquo;DM for price&rdquo;.</p></div>
            <div className="why-item" data-reveal><div className="num">02</div><h3>Real Photos</h3><p>Our pieces are photographed in the studio and on clients, so you see the hair itself — not stock imagery.</p></div>
            <div className="why-item" data-reveal><div className="num">03</div><h3>Help Before You Buy</h3><p>Unsure about lace, length or shade? Message us on WhatsApp and we&apos;ll talk you through it, one to one.</p></div>
            <div className="why-item" data-reveal><div className="num">04</div><h3>Styling Under One Roof</h3><p>Straightening and custom installs by Doreen, so your unit can be finished exactly the way you want it.</p></div>
          </div>
        </div>
      </section>

      <section className="feature-video" id="featured">
        <div className="container feature-inner" data-reveal>
          <div className="feature-text">
            <div className="section-num" aria-hidden="true">05</div>
            <div className="section-eyebrow">As Seen On TikTok</div>
            <h2>Watch the Install</h2>
            <p>Follow along on TikTok for real, unfiltered wig installs, styling tips, and new arrivals as they drop.</p>
            <a className="btn btn-primary" href={brand.tiktokUrl} target="_blank" rel="noopener">Follow @{brand.tiktokHandle}</a>
          </div>
          <a className="tiktok-embed-wrap" href={brand.featuredTikTokVideoUrl} target="_blank" rel="noopener" aria-label="Watch the install on TikTok">
            <div className="tiktok-ambient">
              <svg className="tiktok-watermark" viewBox="0 0 24 16" aria-hidden="true"><path d="M1 14 L2.5 4 L7 9 L12 2 L17 9 L21.5 4 L23 14 Z" /></svg>
              <div className="tiktok-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
              <span className="tiktok-ambient-label">Watch on TikTok</span>
            </div>
          </a>
        </div>
      </section>

      <section id="faq">
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-num" aria-hidden="true">06</div>
            <div className="section-eyebrow">Before You Order</div>
            <h2>Common Questions</h2>
          </div>
          <div className="faq-list">
            <div className="faq-item" data-reveal><h3>Is this human hair?</h3><p>We confirm hair type piece by piece. Message us on WhatsApp with the item you&apos;re eyeing and we&apos;ll tell you its hair type and density before you pay.</p></div>
            <div className="faq-item" data-reveal><h3>Which length should I choose?</h3><p>Lengths are measured straight, in inches. As a guide, 10&quot; is a bob, 14&quot; sits near the shoulders and 18&quot;+ falls down the back. Curls sit shorter. <Link className="mini-link" href="/guide#length">Length guide</Link></p></div>
            <div className="faq-item" data-reveal><h3>Can I get a colour that isn&apos;t listed?</h3><p>Some pieces come in more colours than we list for checkout — the product description names them. Message us on WhatsApp to order one of those.</p></div>
            <div className="faq-item" data-reveal>
              <h3>How do I order and pay?</h3>
              <p>{payOnline
                ? "Add pieces to your bag and check out securely online — payments are processed by Paystack, so your card details never touch our site. Prefer to chat first? Order on WhatsApp any time."
                : "Message us on WhatsApp with the piece you like and we'll confirm availability, delivery and payment details with you directly."}</p>
            </div>
            <div className="faq-item" data-reveal><h3>Do you deliver?</h3><p>Yes — we ship nationwide within Nigeria and internationally. Delivery options and fees for your address are shown at checkout, or message us for a quote.</p></div>
            <div className="faq-item" data-reveal><h3>Can I customize the color, length, or style?</h3><p>Yes — that&apos;s exactly what a Custom Install is for. Send a reference photo or describe the vibe, and we&apos;ll style it to match.</p></div>
            <div className="faq-item" data-reveal><h3>How long will my unit last?</h3><p>It depends on the unit and how it&apos;s cared for. Our <Link className="mini-link" href="/guide#care">care guide</Link> covers the basics, and we&apos;ll tell you what to expect from the specific piece you&apos;re considering.</p></div>
          </div>
        </div>
      </section>

      <section className="section-tight" id="newsletter" style={{ background: "var(--blush)" }}>
        <div className="container">
          <div className="section-head" data-reveal>
            <div className="section-eyebrow">Stay in the loop</div>
            <h2>New Arrivals, First</h2>
            <p>Occasional emails when new pieces land. No spam — unsubscribe any time.</p>
          </div>
          <Newsletter />
        </div>
      </section>

      <section className="order-band" id="order">
        <div className="container">
          <div className="order-card" data-reveal>
            <h2>Ready For Your<br />New Look?</h2>
            <p>Tell us your budget and the look you&apos;re after. We&apos;ll suggest pieces from the collection and answer every question before you order.</p>
            <a className="btn btn-primary" href={wa} target="_blank" rel="noopener">Chat on WhatsApp</a>
            <div className="contact-row">
              <a href={brand.instagramUrl} target="_blank" rel="noopener">Instagram</a>
              <a href={brand.tiktokUrl} target="_blank" rel="noopener">TikTok</a>
              <span>{brand.location}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
