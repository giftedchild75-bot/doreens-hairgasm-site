/**
 * Test fixture: the original 43-item catalogue (frozen snapshot of the old
 * config.js), so tests don't change when the real catalogue does. Its photos
 * were retired, so every item uses one stand-in image that ships with the site.
 */
import raw from "./legacy-catalog.json";
import type { CatalogItem } from "@/server/seed";

type T = CatalogItem["texture"];
type L = CatalogItem["lengthGroup"];
type C = CatalogItem["colorFamily"];

// [texture, length group, colour family, inches, lace] — classified from each listing's own copy.
const ATTRS: Record<string, [T, L, C, number | null, string | null]> = {
  "Alicia": ["wavy", "long", "brown", 26, "Lace front"],
  "Brooklyn Dark Auburn": ["curly", "long", "red", 26, "13x4 Swiss lace"],
  "Brooklyn Grey": ["wavy", null, "grey", null, "Lace front"],
  "Brown Wavy": ["wavy", null, "brown", null, "Lace front"],
  "Clara": ["wavy", "long", "brown", null, "Lace front"],
  "Clara Black": ["wavy", null, "black", null, null],
  "Evelyn": ["wavy", "long", "brown", null, "Lace front"],
  "Evelyn — Wine": ["wavy", "long", "red", null, "Lace front"],
  "Freya": ["wavy", "long", "grey", null, "Lace front"],
  "Grey Bob": [null, "bob", "grey", null, "Lace front"],
  "Jasmine — Vintage Curls": ["curly", null, "brown", null, null],
  "Jasmine Chestnut": ["wavy", null, "brown", null, "Lace front"],
  "Jasmine — Dark Root": ["wavy", null, "brown", null, null],
  "Jasmine — Ginger": ["curly", null, "red", null, null],
  "Jasmine — Piano": ["straight", "long", "brown", null, null],
  "Karen": ["straight", "long", "fashion", 30, "13x3 frontal lace"],
  "Karen II": ["curly", null, "red", null, null],
  "Kimmie — Orange Mix": ["wavy", "mid", "brown", 14, "5x5 Swiss lace"],
  "Kimmie — Piano": ["wavy", "mid", "brown", 14, "5x5 Swiss lace"],
  "Kira": ["curly", null, "brown", null, null],
  "Lara Bounce": ["wavy", null, "blonde", null, "Lace front"],
  "Lara — Fringe": ["wavy", "long", "brown", null, null],
  "Miami Black": ["wavy", "mid", "black", 14, "13x4 Swiss lace"],
  "Miami Black Root": ["wavy", "long", "black", null, null],
  "Miami Dirty Blonde": ["wavy", "long", "blonde", null, null],
  "Miami Fringe": ["wavy", null, "red", null, null],
  "Miami Ginger Mix": ["wavy", null, "red", null, null],
  "Miami Pink Mix": ["wavy", "long", "fashion", null, null],
  "Miami Two Toned": ["wavy", "long", "blonde", null, null],
  "Monica": ["wavy", "long", "brown", null, null],
  "Nelly Gold": ["curly", null, "red", null, null],
  "Nelly Wine": ["curly", null, "red", null, null],
  "Nia": ["wavy", "long", "brown", null, null],
  "Nova": ["wavy", "long", "grey", null, "Lace front"],
  "Octavia": ["straight", "bob", "red", null, "Lace front"],
  "Olivia": ["wavy", null, "brown", null, "Lace front"],
  "Paris Fringe Natural": ["wavy", "long", "brown", 26, null],
  "Paris Piano": ["wavy", null, "brown", null, "Lace front"],
  "RiRi": ["straight", "bob", "red", null, "Lace front"],
  "SDD Bob": [null, "bob", "red", 8, "2x6 lace"],
  "Brooklyn Red Mix": [null, null, "red", null, "Lace front"],
};

const SERVICES = new Set(["Straightening Service", "Custom Install"]);
const STAND_IN = "/assets/hero-install.jpg";

export const LEGACY_CATALOG: CatalogItem[] = (raw as { name: string; desc: string; price: string; specs: string[] }[]).map((p) => {
  const service = SERVICES.has(p.name);
  const [texture, lengthGroup, colorFamily, inches, lace] = ATTRS[p.name] ?? [null, null, null, null, null];
  return {
    name: p.name,
    description: p.desc,
    kind: service ? "service" : "physical",
    category: service ? "services" : "wigs",
    texture, lengthGroup, colorFamily,
    specs: p.specs,
    variants: [{ title: "Default", price: Number(p.price.replace(/[^0-9]/g, "")), lengthInches: inches, laceType: lace }],
    images: [{ url: STAND_IN, alt: `${p.name} — ${p.desc.split("—")[0].trim()}` }],
    publishedAt: new Date(service ? "2026-08-10T09:22:16+01:00" : "2026-09-01T15:16:50+01:00"),
  };
});
