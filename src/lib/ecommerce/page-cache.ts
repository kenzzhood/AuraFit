import { createHash } from "crypto";
import { cacheGet, cacheSet } from "@/lib/cache/provider";

const PAGE_TTL = Number(process.env.CRAWL_PAGE_CACHE_TTL_SECONDS ?? 604800);

export function pageCacheKey(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return `crawl:page:${hash}`;
}

export async function getCachedPage(url: string): Promise<string | null> {
  return cacheGet<string>(pageCacheKey(url));
}

export async function setCachedPage(url: string, content: string): Promise<void> {
  await cacheSet(pageCacheKey(url), content, PAGE_TTL);
}

export function thumbnailCacheKey(productUrl: string): string {
  const hash = createHash("sha256").update(productUrl).digest("hex");
  return `crawl:thumb:${hash}`;
}

export async function getCachedThumbnail(url: string): Promise<string | null> {
  return cacheGet<string>(thumbnailCacheKey(url));
}

export async function setCachedThumbnail(
  productUrl: string,
  cdnUrl: string
): Promise<void> {
  await cacheSet(thumbnailCacheKey(productUrl), cdnUrl, PAGE_TTL * 4);
}
