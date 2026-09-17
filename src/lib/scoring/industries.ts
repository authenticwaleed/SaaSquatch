/**
 * Industry fit for acquisition-through-search.
 *
 * Tier A is the classic ETA profile: fragmented, owner-operated, recurring
 * demand, and largely insulated from the tech cycle. Tier C covers businesses
 * that look attractive to a VC but are poor search-fund targets — venture-backed
 * software has no succession event, and the multiple is set by growth, not cash flow.
 */

export type IndustryTier = "A" | "B" | "C";

export const INDUSTRY_TIER_POINTS: Record<IndustryTier, number> = { A: 15, B: 8, C: 3 };

const TIER_A = [
  "hvac", "heating", "air conditioning", "plumbing", "electrical", "electrician",
  "roofing", "landscaping", "lawn care", "pest control", "septic", "restoration",
  "dental", "dentist", "orthodont", "veterinary", "vet clinic", "optometr",
  "home health", "medical billing", "physical therapy", "pharmacy",
  "auto repair", "collision", "auto body", "tire", "fleet service",
  "accounting", "bookkeeping", "tax prep", "payroll", "insurance agency",
  "staffing", "commercial cleaning", "janitorial", "facilities", "security",
  "alarm", "fire protection", "waste", "logistics", "freight", "moving",
  "machining", "fabrication", "industrial supply", "specialty manufacturing",
];

const TIER_B = [
  "restaurant", "food service", "catering", "retail", "e-commerce", "ecommerce",
  "construction", "contractor", "remodeling", "fitness", "gym", "salon", "spa",
  "real estate", "property management", "childcare", "education", "training",
  "printing", "signage", "events", "hospitality", "travel", "automotive sales",
];

const TIER_C = [
  "software", "saas", "startup", "venture", "crypto", "blockchain", "web3",
  "fintech", "app development", "artificial intelligence", "machine learning",
  "media", "publishing", "advertising agency", "social media", "influencer",
  "consulting", "coaching", "freelance", "nonprofit", "charity",
];

const TIERS: ReadonlyArray<[IndustryTier, readonly string[]]> = [
  ["A", TIER_A],
  ["C", TIER_C],
  ["B", TIER_B],
];

/**
 * Tier C is checked before Tier B so that "software consulting" classifies as
 * poor fit rather than getting Tier B credit for the word "consulting".
 */
export function classifyIndustry(industry: string | null): IndustryTier | null {
  if (!industry) return null;
  const needle = industry.toLowerCase();
  for (const [tier, keywords] of TIERS) {
    if (keywords.some((k) => needle.includes(k))) return tier;
  }
  return null;
}

export const TIER_LABELS: Record<IndustryTier, string> = {
  A: "Fragmented owner-operated services — prime ETA category",
  B: "Fragmented but cyclical or margin-pressured",
  C: "Growth-stage or venture-shaped — weak succession profile",
};
