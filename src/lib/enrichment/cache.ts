import type { DigitalSignals } from "@/lib/types";
import { cacheGet, cacheSet } from "@/lib/cache";

/**
 * Bump CACHE_VERSION whenever the signal shape or detection logic changes;
 * stale entries then fall out naturally instead of poisoning scores.
 */
const CACHE_VERSION = "v1";
const TTL_SECONDS = 60 * 60 * 24 * 7;

const key = (domain: string) => `enrich:${CACHE_VERSION}:${domain}`;

export const readSignals = (domain: string) => cacheGet<DigitalSignals>(key(domain));
export const writeSignals = (domain: string, signals: DigitalSignals) =>
  cacheSet(key(domain), signals, TTL_SECONDS);
