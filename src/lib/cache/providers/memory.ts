import type { CacheProvider } from "./types";

type Entry = { value: unknown; expiresAt?: number };

const store = new Map<string, Entry>();

export const memoryCacheProvider: CacheProvider = {
  name: "memory",
  isConfigured: () => true,
  async get<T>(key: string): Promise<T | null> {
    const e = store.get(key);
    if (!e) return null;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      store.delete(key);
      return null;
    }
    return e.value as T;
  },
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  },
  async delete(key: string) {
    store.delete(key);
  },
};
