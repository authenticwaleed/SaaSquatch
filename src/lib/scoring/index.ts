import type { Band, DigitalSignals, Lead, LeadScore } from "@/lib/types";
import {
  BAND_THRESHOLDS,
  FIT_FLOOR,
  FIT_FLOOR_ALLOWANCE,
  PRIORITY_BLEND,
} from "./config";
import { scoreFit } from "./fit";
import { scoreUpside } from "./upside";

export * from "./config";
export { scoreFit } from "./fit";
export { scoreUpside } from "./upside";
export { classifyIndustry } from "./industries";

function toBand(priority: number): Band {
  if (priority >= BAND_THRESHOLDS.A) return "A";
  if (priority >= BAND_THRESHOLDS.B) return "B";
  if (priority >= BAND_THRESHOLDS.C) return "C";
  return "D";
}

const compactUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;

/** One scannable line for the table row, built from whichever facts we have. */
function buildHeadline(lead: Lead, score: LeadScore["upside"], now: Date): string {
  const profile: string[] = [];

  if (lead.yearFounded && lead.yearFounded > 1800) {
    profile.push(`${now.getFullYear() - lead.yearFounded}-yr`);
  }
  if (lead.ownerName) profile.push("owner-operated");
  if (lead.industry) profile.push(lead.industry.toLowerCase());
  if (lead.revenueUsd) profile.push(compactUsd(lead.revenueUsd));

  const gaps = score.contributions
    .filter((c) => c.earned > 0)
    .sort((a, b) => b.earned - a.earned)
    .slice(0, 2)
    .map((c) => c.label.toLowerCase());

  const left = profile.length ? profile.join(", ") : lead.companyName;
  return gaps.length ? `${left} · gaps: ${gaps.join(", ")}` : `${left} · digitally mature`;
}

/**
 * Score a lead on both axes and blend them into a single sortable priority.
 *
 * Fit and Upside are deliberately kept separate in the output so the UI can show
 * *why* a lead ranks where it does. Priority is gated on Fit: a company that
 * cannot realistically be acquired should never outrank one that can, however
 * much transformation headroom it shows.
 */
export function scoreLead(
  lead: Lead,
  signals: DigitalSignals | null,
  now = new Date(),
): LeadScore {
  const fit = scoreFit(lead, now);
  const upside = scoreUpside(lead, signals, now);

  const blended = PRIORITY_BLEND.fit * fit.score + PRIORITY_BLEND.upside * upside.score;
  const priority =
    fit.score < FIT_FLOOR
      ? Math.round(Math.min(blended, fit.score + FIT_FLOOR_ALLOWANCE))
      : Math.round(blended);

  return {
    fit,
    upside,
    priority,
    band: toBand(priority),
    headline: buildHeadline(lead, upside, now),
  };
}

/** Rank a batch, highest priority first. Ties break toward the better-fitting target. */
export function rankLeads(
  input: ReadonlyArray<{ lead: Lead; signals: DigitalSignals | null }>,
  now = new Date(),
): Array<{ lead: Lead; score: LeadScore }> {
  return input
    .map(({ lead, signals }) => ({ lead, score: scoreLead(lead, signals, now) }))
    .sort((a, b) => b.score.priority - a.score.priority || b.score.fit.score - a.score.fit.score);
}
