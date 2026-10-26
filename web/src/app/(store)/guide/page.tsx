import type { Metadata } from "next";
import Link from "next/link";
import { whatsappLink } from "@/lib/env";

export const metadata: Metadata = {
  title: "Wig Guide",
  description: "How to choose lace, length, texture and colour — and how to care for your unit. A plain-English guide from Doreen's Hairgasm.",
  alternates: { canonical: "/guide" },
};

// General hair knowledge only. Anything specific to one piece (hair type, density,
// heat tolerance) is confirmed per piece on WhatsApp, never stated here.
const LACE: [string, string][] = [
  ["2x6 closure", "A strip of lace 2 inches wide and 6 inches deep down the centre. Made for a sharp, natural middle part — the look on our bone straight units."],
  ["5x5 closure", "A 5-by-5-inch square of lace at the crown. Room to part in the middle or slightly to either side."],
  ["13x4 frontal", "Lace from ear to ear, 4 inches back from the hairline. Lets you part anywhere along the front and style the edges."],
  ["13x6 frontal", "The same ear-to-ear width, 6 inches deep — more space for deep side parts and pulled-back styles."],
];

const LENGTHS: [string, string][] = [
  ['10"–12"', "Bob territory — around the jaw to the chin."],
  ['14"–16"', "Around the collarbone to the shoulders."],
  ['18"–22"', "Past the shoulders to mid-back."],
  ['24" and longer', "Mid-back and beyond — the dramatic end of the range."],
];

export default function GuidePage() {
  const ask = whatsappLink("Hi Doreen! I read the wig guide and I'd like help choosing. My budget is … and I like …");
  return (
    <div className="page">
      <div className="container guide">
        <div className="page-head">
          <div className="section-eyebrow">The Wig Guide</div>
          <h1>Choosing your first unit</h1>
          <p>Lace, length, texture, colour and care, in plain words. Still unsure after reading? We&apos;ll help you choose on WhatsApp.</p>
        </div>

        <nav className="guide-toc" aria-label="On this page">
          <a href="#lace">Lace &amp; closures</a>
          <a href="#length">Length</a>
          <a href="#texture">Texture &amp; fringe</a>
          <a href="#colour">Colour</a>
          <a href="#care">Care</a>
          <a href="#ordering">Ordering</a>
        </nav>

        <section id="lace" className="guide-section">
          <h2>Lace &amp; closures</h2>
          <p>The lace is the part that sits at your parting or hairline, so it decides how you can wear your hair. The numbers are its size in inches: width, then depth.</p>
          <dl className="guide-grid">
            {LACE.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="muted">Rule of thumb: a closure is the simplest to wear; a frontal gives the most styling freedom.</p>
        </section>

        <section id="length" className="guide-section">
          <h2>Length</h2>
          <p>Lengths are measured in inches, straight, from the top of the unit to the ends. Where they fall on you depends on your height and how the unit is cut.</p>
          <dl className="guide-grid">
            {LENGTHS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="muted">Curls and waves sit shorter than the same length worn straight, because the pattern takes up length.</p>
        </section>

        <section id="texture" className="guide-section">
          <h2>Texture &amp; fringe</h2>
          <p><strong>Bone straight</strong> is sleek and flat from root to tip. <strong>Bouncy</strong> styles have soft, loose movement. <strong>Pixie curls</strong> are tight, defined curls with plenty of volume.</p>
          <p>A <strong>fringe</strong> (bangs) frames the face and hides the hairline, so there&apos;s no lace to blend at the front — a good choice if you&apos;re new to wigs. Where a style comes with or without a fringe, you pick on the product page.</p>
        </section>

        <section id="colour" className="guide-section">
          <h2>Colour</h2>
          <p>Every colour you can select on a product page is in our price list. Some pieces come in more colours than we list for checkout — the description says which, and you can order those on WhatsApp.</p>
          <p>A <strong>dark root</strong> means the hair is darker at the parting and lighter through the lengths, which softens the line between the lace and your scalp.</p>
          <p>Screens show colour differently. If the exact shade matters, ask us for a photo or video of the unit in daylight before you order.</p>
        </section>

        <section id="care" className="guide-section">
          <h2>Care</h2>
          <ul className="guide-list">
            <li>Detangle gently with a wide-tooth comb, starting at the ends and working up.</li>
            <li>Wash only when it needs it, with a gentle shampoo and conditioner. Let it dry on a wig stand, not in a heap.</li>
            <li>For curls, refresh with water and a leave-in conditioner instead of brushing them dry.</li>
            <li>Store your unit on a stand or in its box, away from direct sun.</li>
            <li>Ask us before using heat. The safe temperature depends on the unit, and we&apos;ll tell you for your piece.</li>
          </ul>
        </section>

        <section id="ordering" className="guide-section">
          <h2>Ordering</h2>
          <p>Prices are on every product page. Choose your length, colour or lace option, add it to your bag, and check out — or send us the piece on WhatsApp and we&apos;ll take your order there.</p>
          <p>
            <Link className="mini-link" href="/policies/delivery">Delivery</Link> ·{" "}
            <Link className="mini-link" href="/policies/returns">Returns</Link> ·{" "}
            <Link className="mini-link" href="/orders/lookup">Track an order</Link>
          </p>
        </section>

        <div className="guide-cta">
          <h2>Still deciding?</h2>
          <p>Tell us your budget and the look you&apos;re after. We&apos;ll suggest pieces and answer questions about hair type, density and fit.</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <a className="btn btn-primary" href={ask} target="_blank" rel="noopener">Help me choose</a>
            <Link className="btn btn-outline" href="/shop">Browse the collection</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
