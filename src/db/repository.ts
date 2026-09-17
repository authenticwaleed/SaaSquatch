import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import { leadRows, runs, siteSignals } from "./schema";
import { normalizeDomain } from "@/lib/domain";
import type { LeadRow, PipelineResult, PipelineSummary } from "@/lib/pipeline";
import type { DigitalSignals } from "@/lib/types";

/**
 * Persistence for scoring runs and enrichment signals.
 *
 * Every function is a no-op that returns null/false when no database is
 * configured, so call sites never branch on configuration.
 */

export async function saveRun(
  rows: readonly LeadRow[],
  summary: PipelineSummary,
  source: "demo" | "import" | "enrich",
  label: string,
): Promise<string | null> {
  const db = getDb();
  if (!db || rows.length === 0) return null;

  try {
    const [run] = await db
      .insert(runs)
      .values({ label, source, summary })
      .returning({ id: runs.id });

    await db.insert(leadRows).values(
      rows.map((r) => ({
        runId: run.id,
        companyName: r.lead.companyName,
        domain: normalizeDomain(r.lead.website ?? r.lead.domain),
        priority: r.score.priority,
        band: r.score.band,
        lead: r.lead,
        score: r.score,
        email: r.email,
        signals: r.signals,
        mergedFrom: r.mergedFrom,
        mergeReasons: r.mergeReasons,
      })),
    );
    return run.id;
  } catch (err) {
    // Persistence must never break a scoring run the user is watching.
    console.error("[db] saveRun failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function loadLatestRun(): Promise<PipelineResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const [run] = await db.select().from(runs).orderBy(desc(runs.createdAt)).limit(1);
    if (!run) return null;

    const stored = await db
      .select()
      .from(leadRows)
      .where(eq(leadRows.runId, run.id))
      .orderBy(desc(leadRows.priority));

    return {
      summary: run.summary,
      rows: stored.map((r): LeadRow => ({
        lead: r.lead,
        score: r.score,
        email: r.email,
        signals: r.signals,
        mergedFrom: r.mergedFrom,
        mergeReasons: r.mergeReasons,
      })),
    };
  } catch (err) {
    console.error("[db] loadLatestRun failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Durable tier beneath the Redis enrichment cache. */
export async function lookupSignals(domains: readonly string[]): Promise<Map<string, DigitalSignals>> {
  const db = getDb();
  const found = new Map<string, DigitalSignals>();
  if (!db || domains.length === 0) return found;

  try {
    const stored = await db
      .select()
      .from(siteSignals)
      .where(inArray(siteSignals.domain, [...domains]));
    for (const row of stored) found.set(row.domain, row.signals);
  } catch (err) {
    console.error("[db] lookupSignals failed:", err instanceof Error ? err.message : err);
  }
  return found;
}

export async function persistSignals(domain: string, signals: DigitalSignals): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db
      .insert(siteSignals)
      .values({ domain, signals, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSignals.domain,
        set: { signals, fetchedAt: new Date() },
      });
  } catch (err) {
    console.error("[db] persistSignals failed:", err instanceof Error ? err.message : err);
  }
}
