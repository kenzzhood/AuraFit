import { crawlProductsLive } from "@/lib/ecommerce/providers/crawl-live";
import { upsertProductIndexBatch } from "@/lib/ecommerce/index/persist";
import { setCachedProducts } from "@/lib/ecommerce/cache";
import { productToNormalized } from "@/lib/ecommerce/product";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";

/** Category seeds for nightly proactive indexing. */
export const FASHION_INDEX_CATEGORIES = [
  "men casual top",
  "men formal shirt",
  "women dress",
  "men trousers",
  "men sneakers",
  "women heels",
  "men jacket",
  "women kurta",
  "men chinos",
  "accessories belt watch",
] as const;

export const FASHION_INDEX_REGIONS = ["IN", "US", "UK"] as const;

/**
 * Crawl one category × region across all configured retailers, then upsert
 * into the owned pgvector index. Used by the nightly Inngest cron so user
 * searches hit warm local data instead of live crawls.
 */
export async function crawlAndIndexCategory(params: {
  category: string;
  region: "IN" | "US" | "UK";
  maxResults?: number;
}): Promise<{ indexed: number }> {
  if (!process.env.PRODUCT_CRAWLER_URL) {
    console.warn("fashion-index-crawl: PRODUCT_CRAWLER_URL not set, skipping");
    return { indexed: 0 };
  }

  const query: ProductQuery = {
    query: params.category,
    category: params.category.split(" ").slice(-1)[0] ?? "garment",
    region: params.region,
  };

  const products = await crawlProductsLive(query, {
    maxResults: params.maxResults ?? 20,
  });

  if (!products.length) {
    return { indexed: 0 };
  }

  await upsertProductIndexBatch(products, { embed: true });
  await setCachedProducts(query, products.map((p) => productToNormalized(p)));

  return { indexed: products.length };
}
