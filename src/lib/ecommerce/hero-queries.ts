import { canonicalItemCategory, slotSearchQuery } from "./category-match";

const COLORS = [
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
  "aline",
  "a-line",
  "wrap",
  "bodycon",
  "empire",
  "peplum",
  "boxy",
  "fitted",
  "flared",
  "pleated",
];

const FABRICS = [
  "linen",
  "cotton",
  "silk",
  "wool",
  "denim",
  "leather",
  "knit",
  "cashmere",
  "satin",
  "chiffon",
  "tweed",
  "corduroy",
  "velvet",
  "suede",
  "jersey",
  "viscose",
  "rayon",
];

function firstHit(hay: string, vocab: string[]): string | undefined {
  return vocab.find((w) => hay.includes(w));
}

export function heroSearchVariants(params: {
  searchQuery: string;
  category: string;
  style?: string;
  lookLabel?: string;
  lookDescription?: string;
  lookTagline?: string;
  itemDescription?: string;
  budgetMax?: number;
}): string[] {
  const primary = slotSearchQuery(
    params.searchQuery,
    params.category,
    params.style
  );
  const hay = [
    params.searchQuery,
    params.itemDescription,
    params.lookLabel,
    params.lookDescription,
    params.lookTagline,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const color = firstHit(hay, COLORS);
  const silhouette = firstHit(hay, SILHOUETTES);
  const fabric = firstHit(hay, FABRICS);
  const slot = canonicalItemCategory(params.category);
  const expanded = [color, silhouette, fabric, slot, params.style]
    .filter(Boolean)
    .join(" ")
    .trim();

  const budget =
    params.budgetMax != null && params.budgetMax > 0
      ? `${primary} under ${Math.round(params.budgetMax)}`
      : "";

  const out: string[] = [];
  const seen = new Set<string>();
  for (const q of [primary, expanded, budget]) {
    const trimmed = q.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 3);
}
