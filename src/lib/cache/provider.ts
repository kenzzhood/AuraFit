import { memoryCacheProvider } from "./providers/memory";
import { redisCacheProvider } from "./providers/redis";
import type { CacheProvider } from "./providers/types";

export function getCacheProvider(): CacheProvider {
  const name = (process.env.CACHE_PROVIDER ?? "memory").toLowerCase();
  if (name === "redis" && redisCacheProvider.isConfigured()) {
    return redisCacheProvider;
  }
  return memoryCacheProvider;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  return getCacheProvider().get<T>(key);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  return getCacheProvider().set(key, value, ttlSeconds);
}

export type { CacheProvider } from "./providers/types";
