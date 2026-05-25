import type { PersonAnalysis, PlannedLook } from "@/types/generation";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";
import type { Product } from "@/lib/ecommerce/product";
import { getOrCreateTextEmbedding } from "@/lib/ecommerce/index/embeddings";

export type RankingContext = {
  query: ProductQuery;
  personAnalysis?: PersonAnalysis | null;
  plannedLook?: PlannedLook | null;
};

function titleMatchScore(title: string, query: string): number {
  const t = title.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return 0;
  return words.filter((w) => t.includes(w)).length / words.length;
}

function budgetFitScore(
  price: number | undefined,
  min?: number,
  max?: number
): number {
  if (price == null) return 0.3;
  if (min != null && price < min * 0.5) return 0.2;
  if (max != null && price > max * 1.2) return 0.1;
  if (min != null && max != null && price >= min && price <= max) return 1;
  if (max != null && price <= max) return 0.7;
  return 0.5;
}

function sourceScore(source: string): number {
  if (["amazon", "myntra", "flipkart", "crawl", "index"].includes(source))
    return 0.9;
  if (source === "serpapi") return 0.75;
  if (source === "demo" || source === "cached") return 0.2;
  return 0.5;
}

function colorHarmonyScore(
  product: Product,
  person?: PersonAnalysis | null
): number {
  if (!person?.bestColors?.length || !product.colors?.length) return 0.5;
  const best = person.bestColors.map((c) => c.toLowerCase());
  const prod = product.colors.map((c) => c.toLowerCase());
  const hits = prod.filter((c) => best.some((b) => c.includes(b) || b.includes(c)));
  return hits.length ? Math.min(1, hits.length / prod.length + 0.3) : 0.4;
}

function bodyCompatibilityScore(
  product: Product,
  person?: PersonAnalysis | null
): number {
  if (!person?.bestSilhouettes?.length) return 0.5;
  const text = `${product.title} ${product.category ?? ""} ${(product.aestheticTags ?? []).join(" ")}`.toLowerCase();
  const hits = person.bestSilhouettes.filter((s) =>
    text.includes(s.toLowerCase())
  );
  return hits.length ? 0.85 : 0.5;
}

function cosineSimilarity(a: number[], b: number[]): number {
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

async function semanticScore(
  product: Product,
  queryEmbedding: number[],
  lookEmbedding?: number[]
): Promise<number> {
  if (product.embeddings?.length) {
    const q = cosineSimilarity(queryEmbedding, product.embeddings);
    const l = lookEmbedding
      ? cosineSimilarity(lookEmbedding, product.embeddings)
      : 0;
    return q * 0.6 + l * 0.4;
  }

  const text = [product.title, product.brand, product.category].filter(Boolean).join(" ");
  try {
    const prodEmb = await getOrCreateTextEmbedding(text);
    const q = cosineSimilarity(queryEmbedding, prodEmb);
    const l = lookEmbedding ? cosineSimilarity(lookEmbedding, prodEmb) : 0;
    return q * 0.6 + l * 0.4;
  } catch {
    return titleMatchScore(product.title, "") * 0.3;
  }
}

export async function rankProducts(
  products: Product[],
  context: RankingContext
): Promise<Product[]> {
  if (process.env.PRODUCT_RANKING_ENABLED === "false") return products;
  if (!products.length) return products;

  const q = context.query;
  const queryText = [q.query, q.category, ...(q.aestheticKeywords ?? [])]
    .filter(Boolean)
    .join(" ");

  let queryEmbedding: number[] = [];
  let lookEmbedding: number[] | undefined;

  try {
    queryEmbedding = await getOrCreateTextEmbedding(queryText);
    if (context.plannedLook) {
      const lookText = [
        context.plannedLook.label,
        context.plannedLook.description,
        context.plannedLook.productSearchQuery,
        context.plannedLook.tagline,
      ]
        .filter(Boolean)
        .join(" ");
      lookEmbedding = await getOrCreateTextEmbedding(lookText);
    }
  } catch {
    /* heuristic-only fallback */
  }

  const scored = await Promise.all(
    products.map(async (p) => {
      let s = 0;
      s += titleMatchScore(p.title, q.query) * 2;
      s += budgetFitScore(p.price, q.budgetMin, q.budgetMax) * 2;
      s += sourceScore(p.source) * 1.2;
      s += p.image ? 0.6 : 0;
      s += (p.rating ?? 0) * 0.15;
      s += p.region === q.region ? 0.5 : 0;
      s += colorHarmonyScore(p, context.personAnalysis) * 1;
      s += bodyCompatibilityScore(p, context.personAnalysis) * 0.8;

      if (queryEmbedding.length) {
        s += (await semanticScore(p, queryEmbedding, lookEmbedding)) * 3;
      }

      if (q.aestheticKeywords?.length) {
        const t = p.title.toLowerCase();
        const hits = q.aestheticKeywords.filter((k) =>
          t.includes(k.toLowerCase())
        ).length;
        s += (hits / q.aestheticKeywords.length) * 1;
      }

      return { p, s };
    })
  );

  return scored.sort((a, b) => b.s - a.s).map((x) => x.p);
}
