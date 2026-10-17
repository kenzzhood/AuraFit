import type { PersonAnalysis, PlannedLook } from "@/types/generation";
import type { Product } from "./product";

/**
 * Stylist comparison for a single garment — the same checks a person does
 * when comparing Google Shopping cards: price, fabric, design, quality cues,
 * brand, ratings, stock, and how well it matches the rest of the look.
 */

const FABRICS = [
  "linen",
  "cotton",
  "silk",
  "wool",
  "cashmere",
  "merino",
  "denim",
  "leather",
  "suede",
  "satin",
  "chiffon",
  "tweed",
  "corduroy",
  "velvet",
  "jersey",
  "viscose",
  "rayon",
  "modal",
  "organic",
  "khadi",
  "chambray",
  "poplin",
  "oxford",
  "knit",
  "fleece",
];

const PREMIUM_FABRICS = new Set([
  "linen",
  "silk",
  "wool",
  "cashmere",
  "merino",
  "leather",
  "suede",
  "tweed",
  "organic",
  "khadi",
]);

const QUALITY_WORDS = [
  "tailored",
  "premium",
  "organic",
  "handloom",
  "artisan",
  "italian",
  "japanese",
  "egyptian",
  "merino",
  "supima",
  "pima",
  "double-breasted",
  "full-grain",
];

const CHEAP_CUES = [
  "polyester",
  "synthetic",
  "costume",
  "fancy dress",
  "replica",
  "pack of",
  "combo pack",
];

const SILHOUETTES = [
  "slim",
  "skinny",
  "oversized",
  "relaxed",
  "tailored",
  "cropped",
  "midi",
  "mini",
  "maxi",
  "straight",
  "wide",
  "bootcut",
  "a-line",
  "aline",
  "wrap",
  "bodycon",
  "fitted",
  "flared",
  "pleated",
  "regular",
];

const COLOR_WORDS = [
  "navy",
  "black",
  "white",
  "ivory",
  "cream",
  "beige",
  "khaki",
  "olive",
  "maroon",
  "burgundy",
  "rust",
  "brown",
  "tan",
  "grey",
  "gray",
  "charcoal",
  "blue",
  "red",
  "pink",
  "green",
  "gold",
  "silver",
  "purple",
  "lavender",
  "coral",
  "peach",
  "teal",
  "camel",
  "cognac",
  "wine",
  "mustard",
  "mint",
  "floral",
];

export type StylistContext = {
  query?: string;
  category?: string;
  budgetMin?: number;
  budgetMax?: number;
  style?: string;
  look?: PlannedLook | null;
  person?: PersonAnalysis | null;
};

function hay(product: Product, extra: string[] = []): string {
  return [
    product.title,
    product.brand,
    product.category,
    product.storeName,
    ...(product.colors ?? []),
    ...(product.aestheticTags ?? []),
    ...extra,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function lookHay(look?: PlannedLook | null): string {
  if (!look) return "";
  return [
    look.label,
    look.description,
    look.tagline,
    look.productSearchQuery,
    ...(look.items ?? []).map((i) => `${i.category} ${i.description}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hits(text: string, vocab: string[]): string[] {
  return vocab.filter((w) => text.includes(w));
}

/** 0–1: listed price vs the shopper's budget. */
export function priceScore(
  price: number | undefined,
  min?: number,
  max?: number
): number {
  if (price == null) return 0.35;
  if (min != null && price < min * 0.45) return 0.2;
  if (max != null && price > max * 1.25) return 0.08;
  if (min != null && max != null && price >= min && price <= max) {
    const mid = (min + max) / 2;
    const span = Math.max(max - min, 1);
    return 0.85 + 0.15 * (1 - Math.min(1, Math.abs(price - mid) / span));
  }
  if (max != null && price <= max) return 0.75;
  return 0.45;
}

/** 0–1: fabric named in the listing vs fabric the look asked for. */
export function materialScore(product: Product, context: StylistContext): number {
  const text = hay(product);
  const wanted = hits(`${context.query ?? ""} ${lookHay(context.look)}`, FABRICS);
  const found = hits(text, FABRICS);
  if (!found.length && !wanted.length) return 0.5;
  if (!found.length) return 0.35;
  if (wanted.length && found.some((f) => wanted.includes(f))) return 1;
  if (found.some((f) => PREMIUM_FABRICS.has(f))) return 0.78;
  return 0.62;
}

/** 0–1: silhouette, color, and design words vs the planned look. */
export function designScore(product: Product, context: StylistContext): number {
  const text = hay(product);
  const wanted = `${context.query ?? ""} ${lookHay(context.look)} ${context.style ?? ""}`.toLowerCase();
  const colorHits = hits(text, COLOR_WORDS);
  const wantedColors = hits(wanted, COLOR_WORDS);
  const silHits = hits(text, SILHOUETTES);
  const wantedSil = hits(wanted, SILHOUETTES);

  let s = 0.4;
  if (colorHits.length && wantedColors.some((c) => colorHits.includes(c))) s += 0.35;
  else if (context.person?.bestColors?.length) {
    const best = context.person.bestColors.map((c) => c.toLowerCase());
    if (colorHits.some((c) => best.some((b) => c.includes(b) || b.includes(c)))) {
      s += 0.25;
    }
  }
  if (silHits.length && wantedSil.some((x) => silHits.includes(x))) s += 0.25;
  return Math.min(1, s);
}

/** 0–1: ratings, premium fabric, quality language vs cheap cues. */
export function qualityScore(product: Product): number {
  const text = hay(product);
  let s = 0.45;
  if (product.rating != null) {
    s += Math.min(0.35, (product.rating / 5) * 0.35);
  }
  if (hits(text, QUALITY_WORDS).length) s += 0.15;
  if (hits(text, [...PREMIUM_FABRICS]).length) s += 0.1;
  if (hits(text, CHEAP_CUES).length) s -= 0.25;
  return Math.max(0, Math.min(1, s));
}

/** 0–1: named brand / store vs generic marketplace title. */
export function brandScore(product: Product): number {
  const brand = (product.brand ?? product.storeName ?? "").trim();
  if (brand.length >= 2) return 0.75;
  const title = product.title.toLowerCase();
  if (/^(men|women|unisex|pack)\b/.test(title)) return 0.35;
  return 0.5;
}

/** 0–1: in-stock beats unknown; out of stock is unusable. */
export function availabilityScore(product: Product): number {
  if (product.availability === "out_of_stock") return 0;
  if (product.availability === "in_stock") return 1;
  return 0.55;
}

/** 0–1: body / silhouette notes from the photo analysis. */
export function sizeFitScore(product: Product, person?: PersonAnalysis | null): number {
  if (!person) return 0.5;
  const text = hay(product);
  const sil = person.bestSilhouettes ?? [];
  if (sil.some((s) => text.includes(s.toLowerCase()))) return 0.9;
  const build = (person.bodyBuild ?? "").toLowerCase();
  if (build.includes("slim") && /slim|skinny|tailored/.test(text)) return 0.8;
  if (build.includes("athletic") && /regular|straight|relaxed/.test(text)) return 0.75;
  if ((person.heightEstimate ?? "").toLowerCase().includes("petit") && /crop|petit/.test(text)) {
    return 0.85;
  }
  return 0.5;
}

/** Weighted 0–~10 stylist score used to pick one garment from a mixed-store pool. */
export function stylistGarmentScore(product: Product, context: StylistContext): number {
  return (
    priceScore(product.price, context.budgetMin, context.budgetMax) * 2.2 +
    materialScore(product, context) * 1.8 +
    designScore(product, context) * 2.0 +
    qualityScore(product) * 1.6 +
    brandScore(product) * 1.0 +
    availabilityScore(product) * 1.4 +
    sizeFitScore(product, context.person) * 1.2 +
    (product.rating ?? 0) * 0.2
  );
}
