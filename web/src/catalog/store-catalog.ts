/**
 * The store's real catalogue, as supplied by the owner.
 *
 * Source: the owner's WhatsApp messages (pinned albums), 2026-10-15. Names,
 * prices and lengths are hers, word for word. Where she named an option but gave
 * no price (Pixie Curls in burgundy/brown, 13x6 lace) it is NOT created as a
 * buyable option — the description points to WhatsApp instead.
 *
 * Products with no photo yet are created as hidden drafts; upload photos in
 * Admin → Products and publish. The previous 41-wig range was retired at the
 * owner's request (it lives on only as a test fixture).
 */
import type { CatalogItem } from "@/server/seed";

const SERVICES_LIVE = new Date("2026-08-10T09:22:16+01:00");

export const STORE_CATALOG: CatalogItem[] = [
  {
    name: "Straightening Service",
    description: "Sleek, salon-straight and glueless — the exact finish from Doreen's own straightening service, camera-ready with zero frizz.",
    kind: "service",
    category: "services",
    specs: ["Salon service", "Glueless finish", "Zero-frizz result", "Bring your own unit or natural hair"],
    // Price carried over from the original site, where it was marked "confirm with Doreen".
    variants: [{ title: "Default", price: 15_000 }],
    images: [{ url: "/assets/products/product-straightening-service.jpg", alt: "Straightening Service — sleek, salon-straight finish" }],
    publishedAt: SERVICES_LIVE,
  },
  {
    name: "Custom Install",
    description: "Your color, cut, and texture — booked as a custom install and finished with the same glueless precision as every piece. Bring a reference photo or trust us to style it for you.",
    kind: "service",
    category: "services",
    specs: ["Custom color & cut", "Glueless install", "Pre-plucked hairline finish", "Book with a reference photo"],
    variants: [{ title: "Default", price: 45_000 }],
    images: [{ url: "/assets/products/product-custom-install.jpg", alt: "Custom Install — custom colour, cut and texture" }],
    publishedAt: SERVICES_LIVE,
  },
  {
    name: "SDD Pixie Curls",
    description: "200g SDD Pixie Curls. Prices shown are for black. Burgundy and brown are also available — message us on WhatsApp for those.",
    kind: "physical",
    category: "wigs",
    texture: "curly",
    colorFamily: "black",
    specs: ["200g", "SDD", "Pixie curls", "Black (burgundy & brown on request)"],
    variants: [
      { title: '12"', price: 170_000, lengthInches: 12, color: "Black" },
      { title: '14"', price: 195_000, lengthInches: 14, color: "Black" },
      { title: '16"', price: 220_000, lengthInches: 16, color: "Black" },
      { title: '18"', price: 250_000, lengthInches: 18, color: "Black" },
      { title: '20"', price: 300_000, lengthInches: 20, color: "Black" },
      { title: '22"', price: 350_000, lengthInches: 22, color: "Black" },
      { title: '24"', price: 420_000, lengthInches: 24, color: "Black" },
      { title: '26"', price: 445_000, lengthInches: 26, color: "Black" },
    ],
    images: [],
  },
  {
    name: "Deepwave Ponytail & Swiss Lace Frontal Combo",
    description: 'Deepwave ponytail (30") with a 14" Swiss lace frontal. Other lengths of frontal are available to shop.',
    kind: "physical",
    category: "ponytails",
    texture: "wavy",
    lengthGroup: "long",
    specs: ['Deepwave ponytail 30"', 'Swiss lace frontal 14"', "Combo"],
    variants: [{ title: "Default", price: 58_000, lengthInches: 30, laceType: "Swiss lace frontal" }],
    images: [],
  },
  {
    name: "13x4 Swiss Frontal Lace",
    description: '13x4 Swiss frontal lace. Also available in 13x6 (14" and 16" only for now) — message us on WhatsApp for 13x6.',
    kind: "physical",
    category: "frontals",
    specs: ["13x4", "Swiss lace", "Frontal"],
    variants: [
      { title: '12"', price: 30_000, lengthInches: 12, laceType: "13x4 Swiss lace" },
      { title: '14"', price: 35_000, lengthInches: 14, laceType: "13x4 Swiss lace" },
      { title: '16"', price: 45_000, lengthInches: 16, laceType: "13x4 Swiss lace" },
      { title: '18"', price: 55_000, lengthInches: 18, laceType: "13x4 Swiss lace" },
    ],
    images: [],
  },
  {
    name: "Futura Wig",
    description: 'Futura wig, 30", brown.',
    kind: "physical",
    category: "wigs",
    lengthGroup: "long",
    colorFamily: "brown",
    specs: ['30" length', "Brown"],
    variants: [{ title: "Default", price: 70_000, lengthInches: 30, color: "Brown" }],
    images: [],
  },
  {
    name: "Messy Bun & Swiss Frontal Combo",
    description: 'Messy bun with a 14" Swiss frontal.',
    kind: "physical",
    category: "ponytails",
    specs: ["Messy bun", 'Swiss frontal 14"', "Combo"],
    variants: [{ title: "Default", price: 55_000, laceType: "Swiss lace frontal" }],
    images: [],
  },
];
