import type { Lead, ScoreBreakdown } from "@/lib/types";
import {
  AGE_BANDS,
  EMPLOYEE_BANDS,
  FIT_WEIGHTS,
  OWNER_TITLE_PATTERN,
  REVENUE_BANDS,
} from "./config";
import { INDUSTRY_TIER_POINTS, TIER_LABELS, classifyIndustry } from "./industries";
import { createBreakdown } from "./breakdown";

const usd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;

/**
 * Acquisition Fit: is this company a plausible target for a searcher?
 *
 * Optimises for the lower-middle-market profile Caprae sources against —
 * owner-operated, long-established, fragmented industry, small enough to buy.
 */
export function scoreFit(lead: Lead, now = new Date()): ScoreBreakdown {
  const b = createBreakdown();

  // Revenue — the primary gate on whether a deal is even in range.
  if (lead.revenueUsd != null && lead.revenueUsd >= 0) {
    const band = REVENUE_BANDS.find((r) => lead.revenueUsd! < r.max)!;
    b.add({
      key: "revenue",
      label: "Revenue in acquisition range",
      weight: FIT_WEIGHTS.revenue,
      earned: band.pts,
      detail: `${usd(lead.revenueUsd)} — ${band.label}`,
    });
  } else {
    b.unknown({ key: "revenue", label: "Revenue in acquisition range", weight: FIT_WEIGHTS.revenue });
  }

  // Headcount — corroborates revenue and signals whether the business can run
  // without the owner in every seat.
  if (lead.employeeCount != null && lead.employeeCount >= 0) {
    const band = EMPLOYEE_BANDS.find((e) => lead.employeeCount! <= e.max)!;
    b.add({
      key: "employees",
      label: "Operating scale",
      weight: FIT_WEIGHTS.employees,
      earned: band.pts,
      detail: `${lead.employeeCount} employees — ${band.label}`,
    });
  } else {
    b.unknown({ key: "employees", label: "Operating scale", weight: FIT_WEIGHTS.employees });
  }

  // Business age — cheapest reliable proxy for an approaching succession event.
  if (lead.yearFounded != null && lead.yearFounded > 1800) {
    const age = now.getFullYear() - lead.yearFounded;
    const band = AGE_BANDS.find((a) => age >= a.min)!;
    b.add({
      key: "businessAge",
      label: "Succession likelihood",
      weight: FIT_WEIGHTS.businessAge,
      earned: band.pts,
      detail: `Founded ${lead.yearFounded} (${age} years) — ${band.label}`,
    });
  } else {
    b.unknown({ key: "businessAge", label: "Succession likelihood", weight: FIT_WEIGHTS.businessAge });
  }

  // Owner-operated — a named owner with an owner-shaped title means there is a
  // decision-maker to approach directly, not a board to negotiate with.
  if (lead.ownerName) {
    const titled = lead.ownerTitle != null && OWNER_TITLE_PATTERN.test(lead.ownerTitle);
    b.add({
      key: "ownerOperated",
      label: "Owner-operated",
      weight: FIT_WEIGHTS.ownerOperated,
      earned: titled ? FIT_WEIGHTS.ownerOperated : 10,
      detail: titled
        ? `${lead.ownerName}, ${lead.ownerTitle} — direct decision-maker identified`
        : `${lead.ownerName} identified, title unconfirmed`,
    });
  } else {
    b.unknown({
      key: "ownerOperated",
      label: "Owner-operated",
      weight: FIT_WEIGHTS.ownerOperated,
      detail: "No owner contact identified",
    });
  }

  // Industry — fragmentation and cash-flow durability.
  const tier = classifyIndustry(lead.industry);
  if (tier) {
    b.add({
      key: "industry",
      label: "Industry fit",
      weight: FIT_WEIGHTS.industry,
      earned: INDUSTRY_TIER_POINTS[tier],
      detail: `${lead.industry} — ${TIER_LABELS[tier]}`,
    });
  } else {
    b.unknown({
      key: "industry",
      label: "Industry fit",
      weight: FIT_WEIGHTS.industry,
      detail: lead.industry ? `${lead.industry} — unclassified` : "No industry provided",
    });
  }

  return b.build();
}
