import { cacheGet, cacheSet } from "@/lib/cache/provider";
import type { NormalizedProduct } from "./product";
import type { ProductQuery } from "./providers/types";

function cacheKey(q: ProductQuery): string {
  return `products:${q.region}:${q.category}:${q.query}:${q.budgetMin ?? ""}:${q.budgetMax ?? ""}`;
}

export async function getCachedProducts(
  q: ProductQuery
): Promise<NormalizedProduct[] | null> {
  return cacheGet<NormalizedProduct[]>(cacheKey(q));
}

export async function setCachedProducts(
  q: ProductQuery,
  products: NormalizedProduct[]
): Promise<void> {
  const ttl = Number(process.env.PRODUCT_SEARCH_CACHE_TTL_SECONDS ?? 86400);
  await cacheSet(cacheKey(q), products, ttl);
}
