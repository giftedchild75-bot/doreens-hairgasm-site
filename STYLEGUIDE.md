# Doreen's Hairgasm — Brand Style Guide & Front-End Spec

Scope note: this site takes orders via WhatsApp/DM, not online checkout. Everything
below is written for that reality — no cart/payment system, no video assets (only
one real TikTok clip exists today). Where the aspirational brief called for things
this business can't yet support honestly (video hero, full checkout flow), this
guide substitutes the closest achievable equivalent rather than faking it.

Positioning note (revised): earlier copy over-narrowed the brand to "skull cap
wigs" as the whole identity. Her real content (straightening, layering, custom
installs, curls, multiple colors/textures) is broader than one construction type.
Copy now leads with wigs + styling generally; "skull cap" only appears where it's
the literal name of one specific real product (Honey Blonde), not as the site's
overall category.

---

## 1. Palette — Burgundy & White

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FFFFFF` | Primary backdrop (default site background) |
| `--blush` | `#F6E9EB` | Soft burgundy-tinted panel backdrop — section breaks, feature/order cards |
| `--cream` | `#F7EDE1` | Light text/accents on the dark hero |
| `--ink` | `#1C1211` | Primary text |
| `--muted` | `#786C65` | Secondary/body text |
| `--burgundy` | `#6D1029` | Primary accent — CTAs, underlines, numerals, links |
| `--burgundy-deep` | `#430A1A` | Burgundy hover/active state; the hero's dark cinematic gradient |
| `--burgundy-light` | `#9C3350` | Burgundy hover tint, headline emphasis word (as `#E8A9BB` on the dark hero) |
| `--line` | `rgba(109,16,41,.16)` | Hairline borders on paper/blush |
| `--onyx-line` | `rgba(28,18,16,.1)` | Neutral hairline where a burgundy tint would compete (swatches, pills) |

**Distribution:** the site reads white + burgundy throughout. The one deliberate
exception is the hero, which stays a dark, cinematic burgundy-black (never neutral
black) for photographic drama — everything from the marquee strip down is
paper/blush with burgundy as the accent. Glassmorphism (`backdrop-filter: blur`) is
used only where there's real content behind it to diffuse — the floating nav and
the mobile menu drawer — not applied to cards sitting on a flat page, where blur
has nothing to blur and just adds noise.

## 2. Typography

- **Display / Headings:** Playfair Display, weight 500 (not 600+ — thinner reads
  more heritage), `letter-spacing: 0.01em` on H1/H2, italic used only for a single
  emphasis word per headline (matches existing `<em>` pattern).
- **Nav / Labels / Eyebrows:** Montserrat / system sans, 11px, `letter-spacing: 0.28em`,
  uppercase, low-contrast (`--muted`, not `--cream`).
- **Body:** 13–15px, `letter-spacing: 0.01em`, `line-height: 1.7`, `--muted` on dark.
- **Numerals (section index, price):** Playfair Display italic — never sans-serif.

## 3. Spacing Scale

`8 · 16 · 24 · 32 · 48 · 64 · 96 · 128` (px). Product grid items: **minimum 48px**
gutter (was 26px — corrected in this pass). Section vertical rhythm: 128px desktop,
64px mobile (already in place from the prior pass).

## 4. Grid Rule

**Maximum 2–3 visible columns**, generous gutter, horizontal scroll for overflow
(kin-style) rather than compressing to 4-up. Card width increased so ~2.5 cards
show per viewport on desktop instead of ~4.

## 5. Hover Behavior

No cross-fade to alternate video/angle exists yet (no second asset per product).
Implemented instead: a **restrained cross-fade between the placeholder state and
a caption reveal** (name + "view" cue fades in, icon fades out) — same fluid
opacity-transition language the brief asked for, honestly scoped to assets that
exist.

## 6. CTA Hierarchy

- **Primary (Order on WhatsApp):** solid burgundy pill (white on the dark hero) —
  the one moment of visual weight.
- **Secondary (per-product "Enquire", nav links, footer):** no fill, no border —
  a single elegant underline in burgundy, per the brief's "un-bordered, underlined
  button" instruction.

## 7. Section-by-Section

1. **Hero** — full-bleed real product photo (burgundy layered wig, pulled from the
   TikTok account), slow Ken Burns zoom (18s ease loop) under the same dark
   cinematic scrim to imply motion and keep text legible. Caption-anchored copy,
   bottom-left. Numbered index, top-right. Still a studio product shot rather than
   an in-motion install/transformation video — see deferred items below.
2. **Marquee strip** — unchanged (floating glass pill, kin-style).
3. **Collection** — 2–3 column horizontal-scroll gallery, 48px gutter, underline CTA.
   Now carries a `03` scene numeral in its section-head (see §9).
4. **Find Your Shade** *(new)* — alabaster contrast break. 3-step front-end-only
   swatch picker (undertone → length → texture) that resolves to a recommended
   product and a pre-filled WhatsApp message. This is the achievable version of
   the "Virtual Color Match Protocol" — a real consultation still happens over
   WhatsApp, this just routes the customer there with context instead of a cold DM.
   Carries `04`.
5. **Why Us** — unchanged (numbered glass tiles). Section-head now carries `05`.
6. **Featured TikTok** — unchanged (real embed). Section-head now carries `06`.
7. **FAQ** *(new)* — plain stacked list, hairline dividers, carries `07`. Answers
   the top real objections (human hair confirmation, price, delivery, customization,
   longevity) honestly — every unconfirmed spec routes to "message us" rather than
   asserting a number or fact the business hasn't actually provided. Placed right
   before the order CTA so objections are handled before the ask, not after.
8. **Order band / Footer** — unchanged, CTA hierarchy applied. No numeral — this
   section has no eyebrow/section-head slot to attach one to, and restructuring
   it just to force a numeral in would trade coherence for completionism.

## 9. Scene numerals (cinematic-environment pass)

The hero index (`01 / 04`), product card indices, and `why-item` numbers already
implied a "numbered scenes" motif. Extended that consistently to every section-head
that has an eyebrow slot (`.section-num`, Playfair italic, burgundy at 55% opacity)
rather than inventing new floating UI to chase a camera/scene metaphor literally —
the site already embodies most of it structurally: Ken Burns as a slow dolly-in,
scroll-driven hero parallax as camera movement, magnetic buttons and card
tilt-follow as physical object response, and the hard dark-to-white cut from hero
into the marquee as a deliberate scene change (already documented in §1's
distribution note). No new effects were added solely to fit the metaphor —
coherence and restraint took priority over literalism.

## 8. Explicitly deferred (needs real assets/infra, not faked here)

- Atmospheric video hero — a real photo now fills this slot (see §7); actual
  motion footage of an install/transformation would still be the upgrade over that.
- Slide-out cart / checkout drawer — needs a payment backend; this business
  currently sells via WhatsApp, so a cart has nothing to check out into.
