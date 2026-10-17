import type { Product } from "./product";
import { retailerDomain } from "./fingerprint";
import {
  availabilityScore,
  materialScore,
  qualityScore,
  stylistGarmentScore,
} from "./stylist-score";

export type ComboSlot = {
  category: string;
  candidates: Product[];
};

export type ComboRerankContext = {
  budgetMax?: number;
  budgetMin?: number;
  bestColors?: string[];
  query?: string;
  style?: string;
};

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
];

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

function colorsOf(product: Product): string[] {
  const fromMeta = (product.colors ?? []).map((c) => c.toLowerCase());
  const title = product.title.toLowerCase();
  const fromTitle = COLOR_WORDS.filter((c) => title.includes(c));
  return [...new Set([...fromMeta, ...fromTitle])];
}

function pairwiseCoherence(products: Product[]): number {
  if (products.length < 2) return 0.7;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i]!;
      const b = products[j]!;
      const emb =
        a.embeddings?.length && b.embeddings?.length
          ? cosine(a.embeddings, b.embeddings)
          : jaccard(titleTokens(a.title), titleTokens(b.title));
      sum += emb;
      n += 1;
    }
  }
  return n ? sum / n : 0.7;
}

function colorHarmony(products: Product[], bestColors?: string[]): number {
  const palette = products.flatMap(colorsOf);
  if (!palette.length) return 0.5;
  if (!bestColors?.length) {
    const unique = new Set(palette);
    return Math.min(1, 0.4 + unique.size * 0.15);
  }
  const wanted = bestColors.map((c) => c.toLowerCase());
  const hits = palette.filter((c) =>
    wanted.some((w) => c.includes(w) || w.includes(c))
  );
  return Math.min(1, hits.length / Math.max(1, palette.length) + 0.3);
}

function budgetFit(products: Product[], budgetMax?: number): number {
  const priced = products.filter((p) => p.price != null) as Array<
    Product & { price: number }
  >;
  if (!priced.length) return 0.5;
  const total = priced.reduce((s, p) => s + p.price, 0);
  if (budgetMax == null) return 0.6;
  if (total <= budgetMax) return 1;
  if (total <= budgetMax * 1.2) return 0.6;
  return 0.2;
}

function retailerSpread(products: Product[]): number {
  const domains = new Set(
    products.map((p) => retailerDomain(p.canonicalUrl ?? p.url)).filter(Boolean)
  );
  if (!products.length) return 0;
  return domains.size / products.length;
}

export function scoreOutfitCombo(
  products: Product[],
  context: ComboRerankContext = {}
): number {
  if (!products.length) return 0;
  const stylist = products.reduce(
    (sum, p) =>
      sum +
      stylistGarmentScore(p, {
        query: context.query,
        budgetMin: context.budgetMin,
        budgetMax: context.budgetMax,
        style: context.style,
        person: context.bestColors
          ? { bestColors: context.bestColors }
          : undefined,
      }),
    0
  ) / products.length;
  const materials = products.reduce((s, p) => s + materialScore(p, { query: context.query }), 0) /
    products.length;
  const quality =
    products.reduce((s, p) => s + qualityScore(p), 0) / products.length;
  const stock =
    products.reduce((s, p) => s + availabilityScore(p), 0) / products.length;
  return (
    pairwiseCoherence(products) * 2.4 +
    colorHarmony(products, context.bestColors) * 2.6 +
    budgetFit(products, context.budgetMax) * 2.0 +
    stylist * 1.4 +
    materials * 1.2 +
    quality * 1.0 +
    stock * 1.0 +
    retailerSpread(products) * 0.8
  );
}

function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]]
  );
}

/**
 * Score up to 27 combinations of the top-3 candidates per slot. Keep the
 * rank-order combo unless another combination scores meaningfully higher.
 * Return length matches `slots` (undefined where a slot had no candidates).
 */
export function rerankOutfitCombos(
  slots: ComboSlot[],
  context: ComboRerankContext = {}
): Array<Product | undefined> {
  const activeIdx: number[] = [];
  const lists: Product[][] = [];
  for (let i = 0; i < slots.length; i++) {
        const cands = slots[i]!.candidates.slice(0, 4);
    if (!cands.length) continue;
    activeIdx.push(i);
    lists.push(cands);
  }

  const aligned: Array<Product | undefined> = slots.map(() => undefined);
  if (!lists.length) return aligned;

  const baseline = lists.map((c) => c[0]!);
  const baselineScore = scoreOutfitCombo(baseline, context);

  const combos = cartesian(lists).slice(0, 48);
  let best = baseline;
  let bestScore = baselineScore;
  for (const combo of combos) {
    const s = scoreOutfitCombo(combo, context);
    if (s > bestScore) {
      best = combo;
      bestScore = s;
    }
  }

  const chosen = bestScore > baselineScore * 1.04 ? best : baseline;
  chosen.forEach((p, j) => {
    aligned[activeIdx[j]!] = p;
  });
  return aligned;
}
