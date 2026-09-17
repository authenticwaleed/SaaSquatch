import { Redis } from "@upstash/redis";

/**
 * Generic key/value cache.
 *
 * Upstash Redis when configured, an in-process Map when it is not — so the repo
 * clones and runs with no environment at all, which matters more for a reviewer
 * than shaving a cold start. A cache outage is always caught: callers get a miss,
 * never an exception.
 */

interface Backend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  readonly kind: "redis" | "memory";
}

function memoryBackend(): Backend {
  const store = new Map<string, { value: unknown; expires: number }>();
  return {
    kind: "memory",
    async get<T>(key: string) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expires < Date.now()) {
        store.delete(key);
        return null;
      }
      return hit.value as T;
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
    },
  };
}

function redisBackend(url: string, token: string): Backend {
  const redis = new Redis({ url, token });
  return {
    kind: "redis",
    async get<T>(key: string) {
      try {
        return (await redis.get<T>(key)) ?? null;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, ttlSeconds: number) {
      try {
        await redis.set(key, value, { ex: ttlSeconds });
      } catch {
        /* non-fatal */
      }
    },
  };
}

let backend: Backend | null = null;

export function getCache(): Backend {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  backend = url && token ? redisBackend(url, token) : memoryBackend();
  return backend;
}

export const cacheGet = <T>(key: string) => getCache().get<T>(key);
export const cacheSet = <T>(key: string, value: T, ttlSeconds: number) =>
  getCache().set(key, value, ttlSeconds);
