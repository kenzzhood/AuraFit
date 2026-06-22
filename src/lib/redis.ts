import Redis from "ioredis";

let redis: Redis | null = null;
let redisError = false;

export function getRedis(): Redis | null {
  if (redisError) return null;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 5000,
      enableOfflineQueue: false,
    });
    redis.on("error", (err) => {
      // Avoid log spam — only warn once
      if (!redisError) {
        console.warn("[redis] Connection error, falling back to in-memory rate limiting:", err.message);
        redisError = true;
      }
    });
    redis.on("connect", () => {
      redisError = false;
    });
  }
  return redis;
}

// ─── In-memory sliding window fallback ───────────────────────────────────────
// Used when Redis is unavailable. Resets on process restart (not distributed)
// but prevents the "always allow" failure mode that existed before.

type WindowEntry = { count: number; resetAt: number };
const memoryWindows = new Map<string, WindowEntry>();

// Clean up old entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryWindows.entries()) {
    if (entry.resetAt < now) memoryWindows.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function memoryRateLimit(
  key: string,
  limit: number,
  windowSec: number
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const bucket = `${key}:${Math.floor(now / windowMs)}`;
  const entry = memoryWindows.get(bucket) ?? { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  memoryWindows.set(bucket, entry);
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number }> {
  const client = getRedis();

  if (client) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowStart = Math.floor(now / windowSec) * windowSec;
      const bucket = `rl:${key}:${windowStart}`;
      const n = await client.incr(bucket);
      if (n === 1) await client.expire(bucket, windowSec);
      const retryAfterSec = Math.max(1, windowStart + windowSec - now);
      return {
        ok: n <= limit,
        remaining: Math.max(0, limit - n),
        retryAfterSec,
      };
    } catch (err) {
      console.warn("[redis] rateLimit Redis call failed, falling back to memory:", err);
      // Fall through to memory fallback
    }
  }

  return memoryRateLimit(key, limit, windowSec);
}

/** Full outfit generation is expensive — allow a few boards per user per window. */
export const GENERATION_RATE_LIMIT = { limit: 8, windowSec: 15 * 60 } as const;

export const CHAT_RATE_LIMIT = { limit: 30, windowSec: 15 * 60 } as const;
export const SEARCH_RATE_LIMIT = { limit: 40, windowSec: 15 * 60 } as const;
export const RECOMMENDATIONS_RATE_LIMIT = { limit: 20, windowSec: 15 * 60 } as const;
export const WARDROBE_WRITE_RATE_LIMIT = { limit: 30, windowSec: 15 * 60 } as const;
export const CART_WRITE_RATE_LIMIT = { limit: 60, windowSec: 15 * 60 } as const;

export async function getCached(key: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

export async function setCached(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  } catch {
    // Non-fatal — cache write failures degrade gracefully
  }
}
