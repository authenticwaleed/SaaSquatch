import { resolveMx } from "node:dns/promises";
import { cacheGet, cacheSet } from "@/lib/cache";

/**
 * MX lookup: does this domain accept mail at all?
 *
 * This is the one deliverability check that is both cheap and unambiguous. We
 * deliberately stop here — SMTP probing to test individual mailboxes is
 * intrusive, frequently blocked, and gets sending domains blacklisted.
 */

const TTL_SECONDS = 60 * 60 * 24 * 30;
const key = (domain: string) => `mx:v1:${domain}`;

export async function hasMxRecord(domain: string): Promise<boolean | null> {
  const cached = await cacheGet<boolean>(key(domain));
  if (cached !== null) return cached;

  try {
    const records = await resolveMx(domain);
    const found = records.length > 0;
    await cacheSet(key(domain), found, TTL_SECONDS);
    return found;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // The domain resolved but has no MX: a definitive negative, worth caching.
    if (code === "ENOTFOUND" || code === "ENODATA") {
      await cacheSet(key(domain), false, TTL_SECONDS);
      return false;
    }
    // Timeout or resolver failure: unknown, and must not be cached as a negative.
    return null;
  }
}
