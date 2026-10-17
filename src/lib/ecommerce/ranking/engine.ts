import type { PersonAnalysis, PlannedLook } from "@/types/generation";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";
import type { Product } from "@/lib/ecommerce/product";
import { getOrCreateTextEmbedding } from "@/lib/ecommerce/index/embeddings";
import { productMatchesSlot } from "@/lib/ecommerce/category-match";
import { regionTldScore } from "@/lib/ecommerce/buyability";
import { diversifyProducts } from "@/lib/ecommerce/retailer-diversity";
import { stylistGarmentScore } from "@/lib/ecommerce/stylist-score";

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

  const text = [product.title, product.brand, product.category]
    .filter(Boolean)
    .join(" ");
  try {
    const prodEmb = await getOrCreateTextEmbedding(text);
    const q = cosineSimilarity(queryEmbedding, prodEmb);
    const l = lookEmbedding ? cosineSimilarity(lookEmbedding, prodEmb) : 0;
    return q * 0.6 + l * 0.4;
  } catch {
    return titleMatchScore(product.title, "") * 0.3;
  }
}

/**
 * Rank like a shopper comparing Google results: every store stays in the
 * pool; the winner is the best material / design / price / rating / fit
 * match — not whichever domain crawled easiest.
 */
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
      s += stylistGarmentScore(p, {
        query: q.query,
        category: q.category,
        budgetMin: q.budgetMin,
        budgetMax: q.budgetMax,
        look: context.plannedLook,
        person: context.personAnalysis,
      });
      s += titleMatchScore(p.title, q.query) * 1.6;
      s += p.image ? 0.5 : 0;
      s += p.region === q.region ? 0.4 : 0;
      s += regionTldScore(p.canonicalUrl ?? p.url, q.region) * 1.0;
      if (p.verified === true) s += 0.6;

      if (queryEmbedding.length) {
        s += (await semanticScore(p, queryEmbedding, lookEmbedding)) * 2.4;
      }

      if (q.aestheticKeywords?.length) {
        const t = p.title.toLowerCase();
        const hits = q.aestheticKeywords.filter((k) =>
          t.includes(k.toLowerCase())
        ).length;
        s += (hits / q.aestheticKeywords.length) * 1;
      }

      if (q.category && productMatchesSlot(p.title, p.category, q.category)) {
        s += 4;
      } else if (q.category) {
        s -= 3;
      }

      return { p, s };
    })
  );

  const ranked = scored.sort((a, b) => b.s - a.s).map((x) => x.p);
  return diversifyProducts(ranked, 3);
}
