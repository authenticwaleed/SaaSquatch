/**
 * All scoring weights live here so they can be tuned without touching logic.
 * Each group sums to 100 — scores are normalised over *available* weight,
 * so a sparse lead is scored on what we know rather than penalised for gaps.
 */

export const FIT_WEIGHTS = {
  revenue: 30,
  employees: 20,
  businessAge: 20,
  ownerOperated: 15,
  industry: 15,
} as const;

export const UPSIDE_WEIGHTS = {
  onlineBooking: 18,
  mobileResponsive: 15,
  siteFreshness: 13,
  https: 12,
  ecommerce: 12,
  cms: 12,
  analytics: 10,
  chatWidget: 8,
} as const;

/** Blend of the two axes into a single sortable priority. */
export const PRIORITY_BLEND = { fit: 0.6, upside: 0.4 } as const;

/**
 * A company that isn't realistically acquirable can't be a priority no matter
 * how much upside it shows — below this Fit score we clamp Priority so a
 * two-person shop with no website can't outrank a real target.
 */
export const FIT_FLOOR = 35;
export const FIT_FLOOR_ALLOWANCE = 10;

export const BAND_THRESHOLDS = { A: 75, B: 60, C: 45 } as const;

/** Copyright this many years stale counts as a neglected site. */
export const STALE_SITE_YEARS = 3;

/** Revenue bands in USD, in the ETA / lower-middle-market sweet spot. */
export const REVENUE_BANDS: ReadonlyArray<{ max: number; pts: number; label: string }> = [
  { max: 250_000, pts: 0, label: "Under $250k — below acquisition scale" },
  { max: 1_000_000, pts: 12, label: "$250k–$1M — small but viable" },
  { max: 5_000_000, pts: 30, label: "$1M–$5M — core ETA sweet spot" },
  { max: 20_000_000, pts: 26, label: "$5M–$20M — strong lower-middle-market target" },
  { max: 50_000_000, pts: 14, label: "$20M–$50M — upper end, likely competitive" },
  { max: Infinity, pts: 4, label: "Over $50M — outside typical search-fund range" },
];

export const EMPLOYEE_BANDS: ReadonlyArray<{ max: number; pts: number; label: string }> = [
  { max: 4, pts: 4, label: "1–4 staff — likely owner-only" },
  { max: 9, pts: 12, label: "5–9 staff — small but structured" },
  { max: 50, pts: 20, label: "10–50 staff — ideal operating scale" },
  { max: 100, pts: 17, label: "51–100 staff — established operation" },
  { max: 250, pts: 9, label: "101–250 staff — larger than typical target" },
  { max: Infinity, pts: 3, label: "250+ staff — institutional scale" },
];

/**
 * Business age is the strongest cheap proxy for a succession event: a 25-year-old
 * owner-operated business very often has a founder at or near retirement.
 */
export const AGE_BANDS: ReadonlyArray<{ min: number; pts: number; label: string }> = [
  { min: 25, pts: 20, label: "25+ years — high succession likelihood" },
  { min: 15, pts: 16, label: "15–24 years — established, succession plausible" },
  { min: 10, pts: 10, label: "10–14 years — mature but owner likely mid-career" },
  { min: 5, pts: 5, label: "5–9 years — still in growth phase" },
  { min: 0, pts: 2, label: "Under 5 years — too early for succession" },
];

export const OWNER_TITLE_PATTERN =
  /\b(owner|founder|co-?founder|proprietor|principal|president|managing (director|partner)|partner)\b/i;
