import pLimit from "p-limit";
import type { DigitalSignals, Lead } from "@/lib/types";
import { normalizeDomain, toUrl } from "@/lib/domain";
import { politeFetch } from "./http";
import { canFetch, getRobotsPolicy } from "./robots";
import { extractSignals, unreachableSignals } from "./signals";
import { readSignals, writeSignals } from "./cache";

export type EnrichmentStatus = "cached" | "fetched" | "no-website" | "unreachable" | "blocked";

export interface EnrichmentResult {
  leadId: string;
  domain: string | null;
  /** null means "we could not look" — distinct from "we looked and found nothing". */
  signals: DigitalSignals | null;
  status: EnrichmentStatus;
  note?: string;
  elapsedMs: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function enrichLead(
  lead: Lead,
  opts: { force?: boolean; now?: Date } = {},
): Promise<EnrichmentResult> {
  const startedAt = Date.now();
  const now = opts.now ?? new Date();
  const done = (r: Omit<EnrichmentResult, "leadId" | "elapsedMs">): EnrichmentResult => ({
    leadId: lead.id,
    elapsedMs: Date.now() - startedAt,
    ...r,
  });

  const domain = normalizeDomain(lead.website ?? lead.domain);
  const url = toUrl(lead.website, lead.domain);

  // SaaSquatch gave us no site at all — a real finding, not a failure.
  if (!domain || !url) {
    return done({
      domain: null,
      signals: unreachableSignals(false, now),
      status: "no-website",
      note: "No website on file",
    });
  }

  if (!opts.force) {
    const cached = await readSignals(domain);
    if (cached) return done({ domain, signals: cached, status: "cached" });
  }

  if (!(await canFetch(url))) {
    return done({
      domain,
      signals: null,
      status: "blocked",
      note: "Disallowed by robots.txt — not enriched",
    });
  }

  const policy = await getRobotsPolicy(new URL(url).origin);
  if (policy.crawlDelayMs > 0) await sleep(policy.crawlDelayMs);

  const res = await politeFetch(url);
  if (!res.ok || !res.html) {
    const signals = unreachableSignals(true, now);
    await writeSignals(domain, signals);
    return done({
      domain,
      signals,
      status: "unreachable",
      note: res.error ?? `HTTP ${res.status}`,
    });
  }

  const signals = extractSignals(res.html, res.finalUrl, res.bytes, now);
  await writeSignals(domain, signals);
  return done({ domain, signals, status: "fetched" });
}

/**
 * Enrich a batch with a global concurrency cap.
 *
 * The cap is the main politeness lever: it bounds simultaneous outbound
 * connections regardless of batch size, and keeps a serverless invocation well
 * inside its socket and memory budget.
 */
export async function enrichBatch(
  leads: readonly Lead[],
  opts: { concurrency?: number; force?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<EnrichmentResult[]> {
  const limit = pLimit(opts.concurrency ?? 5);
  let completed = 0;

  return Promise.all(
    leads.map((lead) =>
      limit(async () => {
        const result = await enrichLead(lead, { force: opts.force });
        opts.onProgress?.(++completed, leads.length);
        return result;
      }),
    ),
  );
}

export { extractSignals, unreachableSignals } from "./signals";
export { parseRobots, isAllowed } from "./robots";
export { politeFetch, USER_AGENT } from "./http";
