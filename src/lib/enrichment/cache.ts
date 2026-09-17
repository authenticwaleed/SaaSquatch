import { Redis } from "@upstash/redis";
import type { DigitalSignals } from "@/lib/types";

/**
 * Enrichment cache.
 *
 * Upstash Redis when configured, an in-process Map when it is not — so the repo
 * clones and runs with no environment at all, which matters more for a reviewer
 * than shaving a cold start.
 *
 * Bump CACHE_VERSION whenever the signal shape or detection logic changes;
 * stale entries then fall out naturally instead of poisoning scores.
 */

const CACHE_VERSION = "v1";
const TTL_SECONDS = 60 * 60 * 24 * 7;

const key = (domain: string) => `enrich:${CACHE_VERSION}:${domain}`;

interface CacheBackend {
  get(k: string): Promise<DigitalSignals | null>;
  set(k: string, v: DigitalSignals): Promise<void>;
  readonly kind: "redis" | "memory";
}

function memoryBackend(): CacheBackend {
  const store = new Map<string, { value: DigitalSignals; expires: number }>();
  return {
    kind: "memory",
    async get(k) {
      const hit = store.get(k);
      if (!hit) return null;
      if (hit.expires < Date.now()) {
        store.delete(k);
        return null;
      }
      return hit.value;
    },
    async set(k, v) {
      store.set(k, { value: v, expires: Date.now() + TTL_SECONDS * 1000 });
    },
  };
}

function redisBackend(url: string, token: string): CacheBackend {
  const redis = new Redis({ url, token });
  return {
    kind: "redis",
    async get(k) {
      try {
        return (await redis.get<DigitalSignals>(k)) ?? null;
      } catch {
        // A cache outage must never fail the enrichment run.
        return null;
      }
    },
    async set(k, v) {
      try {
        await redis.set(k, v, { ex: TTL_SECONDS });
      } catch {
        /* non-fatal */
      }
    },
  };
}

let backend: CacheBackend | null = null;

export function getCache(): CacheBackend {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  backend = url && token ? redisBackend(url, token) : memoryBackend();
  return backend;
}

export const readSignals = (domain: string) => getCache().get(key(domain));
export const writeSignals = (domain: string, signals: DigitalSignals) =>
  getCache().set(key(domain), signals);
