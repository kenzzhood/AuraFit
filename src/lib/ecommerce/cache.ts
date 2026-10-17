import { cacheGet, cacheSet } from "@/lib/cache/provider";
import type { NormalizedProduct } from "./product";
import type { ProductQuery } from "./providers/types";
import { pickUsableShopUrl } from "./fingerprint";

function cacheKey(q: ProductQuery): string {
  // v8: drop cached rows whose shop URL is dead Snitch (.co.in or /products/).
  return `products:v8:${q.region}:${q.category}:${q.query}:${q.budgetMin ?? ""}:${q.budgetMax ?? ""}`;
}

function withUsableShopUrl(products: NormalizedProduct[]): NormalizedProduct[] {
  return products.filter(
    (p) => pickUsableShopUrl(p.canonicalUrl, p.productUrl) != null
  );
}

export async function getCachedProducts(
  q: ProductQuery
): Promise<NormalizedProduct[] | null> {
  const rows = await cacheGet<NormalizedProduct[]>(cacheKey(q));
  if (!rows) return null;
  return withUsableShopUrl(rows);
}

export async function setCachedProducts(
  q: ProductQuery,
  products: NormalizedProduct[]
): Promise<void> {
  const ttl = Number(process.env.PRODUCT_SEARCH_CACHE_TTL_SECONDS ?? 21600);
  await cacheSet(cacheKey(q), withUsableShopUrl(products), ttl);
}
