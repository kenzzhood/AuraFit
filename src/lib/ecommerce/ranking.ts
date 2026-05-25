import type { ProductQuery } from "./providers/types";
import type { NormalizedProduct } from "./providers/types";
import { normalizedToProduct, productToNormalized } from "./product";
import {
  rankProducts as rankProductsEngine,
  type RankingContext,
} from "./ranking/engine";
import type { Product } from "./product";

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

/** Sync heuristic rank for legacy callers */
export function rankProducts(
  products: NormalizedProduct[],
  query: ProductQuery
): NormalizedProduct[] {
  if (process.env.PRODUCT_RANKING_ENABLED === "false") return products;
  return [...products].sort((a, b) => {
    const score = (p: NormalizedProduct) =>
      titleMatchScore(p.title, query.query) * 3 +
      budgetFitScore(p.price, query.budgetMin, query.budgetMax) * 2 +
      (p.imageUrl ? 0.8 : 0);
    return score(b) - score(a);
  });
}

export async function rankProductList(
  products: Product[],
  context: RankingContext
): Promise<Product[]> {
  return rankProductsEngine(products, context);
}

export type { RankingContext } from "./ranking/engine";
