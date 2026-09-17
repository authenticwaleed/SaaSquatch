import type { DigitalSignals } from "@/lib/types";
import { cacheGet, cacheSet } from "@/lib/cache";
import { lookupSignals, persistSignals } from "@/db/repository";

/**
 * Two-tier enrichment cache.
 *
 * Redis is the hot path. Postgres sits beneath it as the durable floor, so a
 * cache eviction or a cold deploy does not mean re-fetching every site we have
 * already politely scanned once. Both tiers are optional: with neither
 * configured this degrades to an in-process Map.
 *
 * Bump CACHE_VERSION whenever the signal shape or detection logic changes;
 * stale entries then fall out naturally instead of poisoning scores.
 */
const CACHE_VERSION = "v1";
const TTL_SECONDS = 60 * 60 * 24 * 7;

const key = (domain: string) => `enrich:${CACHE_VERSION}:${domain}`;

export async function readSignals(domain: string): Promise<DigitalSignals | null> {
  const hot = await cacheGet<DigitalSignals>(key(domain));
  if (hot) return hot;

  const durable = await lookupSignals([domain]);
  const found = durable.get(domain);
  if (found) {
    // Promote back into the hot tier so the next read is cheap.
    await cacheSet(key(domain), found, TTL_SECONDS);
    return found;
  }
  return null;
}

export async function writeSignals(domain: string, signals: DigitalSignals): Promise<void> {
  await cacheSet(key(domain), signals, TTL_SECONDS);
  await persistSignals(domain, signals);
}
