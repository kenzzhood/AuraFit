import type { CacheProvider } from "./types";

let client: import("ioredis").default | null = null;

async function getClient(): Promise<import("ioredis").default | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    const Redis = (await import("ioredis")).default;
    client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    try {
      await client.connect();
    } catch {
      client = null;
      return null;
    }
  }
  return client;
}

export const redisCacheProvider: CacheProvider = {
  name: "redis",
  isConfigured: () => !!process.env.REDIS_URL,
  async get<T>(key: string): Promise<T | null> {
    const c = await getClient();
    if (!c) return null;
    try {
      const raw = await c.get(`aurafit:cache:${key}`);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T, ttlSeconds = 3600) {
    const c = await getClient();
    if (!c) return;
    try {
      await c.setex(
        `aurafit:cache:${key}`,
        ttlSeconds,
        JSON.stringify(value)
      );
    } catch {
      /* ignore */
    }
  },
  async delete(key: string) {
    const c = await getClient();
    if (!c) return;
    try {
      await c.del(`aurafit:cache:${key}`);
    } catch {
      /* ignore */
    }
  },
};
