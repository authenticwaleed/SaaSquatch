/**
 * A lead as it arrives from SaaSquatch (CSV export or scrape).
 * Every enrichment field is nullable — real exports are sparse, and the
 * scoring engine has to degrade gracefully rather than guess.
 */
export interface Lead {
  id: string;
  companyName: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  revenueUsd: number | null;
  employeeCount: number | null;
  ownerName: string | null;
  ownerTitle: string | null;
  yearFounded: number | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
}

/**
 * Digital-maturity observations pulled from the company's own website.
 * `reachable: false` means we tried and failed — distinct from `hasWebsite: false`,
 * which means SaaSquatch gave us no URL at all.
 */
export interface DigitalSignals {
  hasWebsite: boolean;
  reachable: boolean;
  https: boolean;
  mobileResponsive: boolean;
  copyrightYear: number | null;
  hasOnlineBooking: boolean;
  hasEcommerce: boolean;
  hasChatWidget: boolean;
  hasAnalytics: boolean;
  hasContactForm: boolean;
  cms: string | null;
  pageBytes: number;
  socialLinks: number;
  fetchedAt: string;
}

export type Direction = "positive" | "negative" | "neutral";

/** One line in the "Why this score" panel. */
export interface SignalContribution {
  key: string;
  label: string;
  detail: string;
  weight: number;
  earned: number;
  direction: Direction;
}

export interface ScoreBreakdown {
  /** 0-100, normalised over the signals we actually had data for. */
  score: number;
  contributions: SignalContribution[];
  /** Share of total possible weight that had data behind it. */
  confidence: number;
}

export type Band = "A" | "B" | "C" | "D";

export interface LeadScore {
  fit: ScoreBreakdown;
  upside: ScoreBreakdown;
  priority: number;
  band: Band;
  headline: string;
}
