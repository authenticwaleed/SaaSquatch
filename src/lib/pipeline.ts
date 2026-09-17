import type { DigitalSignals, Lead, LeadScore } from "@/lib/types";
import { dedupeLeads, type MatchReason } from "@/lib/dedupe";
import { scoreLead } from "@/lib/scoring";
import { verifyEmail, type EmailVerdict } from "@/lib/validation/email";

/** One row as the dashboard renders it: the company, why it ranks, and how good its data is. */
export interface LeadRow {
  lead: Lead;
  score: LeadScore;
  email: EmailVerdict;
  signals: DigitalSignals | null;
  /** Source row ids folded into this record; length > 1 means it was merged. */
  mergedFrom: string[];
  mergeReasons: MatchReason[];
}

export interface PipelineSummary {
  inputRows: number;
  companies: number;
  duplicatesRemoved: number;
  enriched: number;
  bandCounts: Record<"A" | "B" | "C" | "D", number>;
}

export interface PipelineResult {
  rows: LeadRow[];
  summary: PipelineSummary;
}

/**
 * Dedupe, score and validate a raw lead list into a ranked board.
 *
 * Dedupe runs first on purpose: scoring a company three times then ranking the
 * duplicates separately would be both wasteful and misleading, and the merged
 * record is more complete than any single source row, so it scores more fairly.
 */
export async function runPipeline(
  leads: readonly Lead[],
  signalsById: Record<string, DigitalSignals | null>,
  opts: { checkMx?: boolean; now?: Date } = {},
): Promise<PipelineResult> {
  const now = opts.now ?? new Date();
  const { leads: canonical, clusters, duplicatesRemoved } = dedupeLeads(leads);

  const clusterByPrimary = new Map(clusters.map((c) => [c.primaryId, c]));

  const rows = await Promise.all(
    canonical.map(async (lead): Promise<LeadRow> => {
      const cluster = clusterByPrimary.get(lead.id);
      const memberIds = cluster?.memberIds ?? [lead.id];

      // A merged record inherits signals from whichever source row was enriched.
      const signals =
        memberIds.map((id) => signalsById[id]).find((s) => s != null) ?? null;

      const [score, email] = [
        scoreLead(lead, signals, now),
        await verifyEmail(lead.email, {
          companyDomain: lead.website ?? lead.domain,
          checkMx: opts.checkMx,
        }),
      ];

      return {
        lead,
        score,
        email,
        signals,
        mergedFrom: memberIds,
        mergeReasons: cluster?.reasons ?? [],
      };
    }),
  );

  rows.sort(
    (a, b) => b.score.priority - a.score.priority || b.score.fit.score - a.score.fit.score,
  );

  const bandCounts = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of rows) bandCounts[row.score.band]++;

  return {
    rows,
    summary: {
      inputRows: leads.length,
      companies: rows.length,
      duplicatesRemoved,
      enriched: rows.filter((r) => r.signals?.reachable).length,
      bandCounts,
    },
  };
}
