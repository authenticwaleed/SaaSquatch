import type { DigitalSignals, Lead, ScoreBreakdown } from "@/lib/types";
import { STALE_SITE_YEARS, UPSIDE_WEIGHTS } from "./config";
import { createBreakdown } from "./breakdown";
import { classifyIndustry } from "./industries";

/**
 * AI-Readiness Upside: how much value could be unlocked *after* acquisition.
 *
 * The scoring here is deliberately inverted — a company earns points for what it
 * is MISSING. A profitable 30-year-old business still taking bookings by phone is
 * not a bad lead; it is the whole thesis. The gap between how the business runs
 * today and how it could run is the value a buyer creates post-close.
 *
 * Read alongside Fit, never on its own: a defunct shop also scores high here,
 * which is exactly why Priority is gated on Fit.
 */

const ECOMMERCE_RELEVANT =
  /\b(retail|e-?commerce|restaurant|food|catering|pharmacy|supply|store|shop|apparel|goods|distribut)/i;

function isEcommerceRelevant(industry: string | null): boolean {
  return industry != null && ECOMMERCE_RELEVANT.test(industry);
}

/** Booking matters for service businesses; it is noise for a machine shop. */
function isBookingRelevant(industry: string | null): boolean {
  const tier = classifyIndustry(industry);
  return tier === null || tier === "A" || tier === "B";
}

export function scoreUpside(
  lead: Lead,
  signals: DigitalSignals | null,
  now = new Date(),
): ScoreBreakdown {
  const b = createBreakdown();

  // Never enriched, or enrichment was declined (robots.txt). We genuinely do not
  // know anything about this company's digital maturity, and must not confuse
  // that with having looked and found nothing — a site that blocks crawlers is
  // often a *more* sophisticated operation, not a less one.
  if (!signals) {
    b.unknown({
      key: "digitalMaturity",
      label: "Digital maturity",
      weight: 100,
      detail: "Not enriched — no signals collected",
    });
    return b.build();
  }

  // No web presence at all. For a business with real revenue this is the
  // strongest single upside signal available, so it short-circuits the rubric.
  if (!signals.hasWebsite) {
    b.add({
      key: "noWebPresence",
      label: "No web presence",
      weight: 100,
      earned: 90,
      detail:
        "No website on file — every digital channel is greenfield. Verify the business is active before outreach.",
      direction: "positive",
    });
    return b.build();
  }

  // We had a URL but could not load it. Treat as a strong but lower-confidence
  // signal rather than silently scoring the company as fully modern.
  if (!signals.reachable) {
    b.add({
      key: "siteUnreachable",
      label: "Website unreachable",
      weight: 100,
      earned: 70,
      detail: "URL on file did not respond — likely neglected, expired, or misconfigured.",
      direction: "positive",
    });
    b.unknown({ key: "siteSignals", label: "On-site signals", weight: 100 });
    return b.build();
  }

  if (isBookingRelevant(lead.industry)) {
    b.add({
      key: "onlineBooking",
      label: "Online booking / scheduling",
      weight: UPSIDE_WEIGHTS.onlineBooking,
      earned: signals.hasOnlineBooking ? 0 : UPSIDE_WEIGHTS.onlineBooking,
      detail: signals.hasOnlineBooking
        ? "Online scheduling already in place"
        : "No online scheduling — bookings are phone-bound, the clearest automation win",
    });
  } else {
    b.unknown({
      key: "onlineBooking",
      label: "Online booking / scheduling",
      weight: UPSIDE_WEIGHTS.onlineBooking,
      detail: "Not applicable to this industry",
    });
  }

  b.add({
    key: "mobileResponsive",
    label: "Mobile-ready site",
    weight: UPSIDE_WEIGHTS.mobileResponsive,
    earned: signals.mobileResponsive ? 0 : UPSIDE_WEIGHTS.mobileResponsive,
    detail: signals.mobileResponsive
      ? "Responsive viewport present"
      : "No responsive viewport — losing mobile traffic outright",
  });

  if (signals.copyrightYear != null) {
    const staleness = now.getFullYear() - signals.copyrightYear;
    const stale = staleness >= STALE_SITE_YEARS;
    b.add({
      key: "siteFreshness",
      label: "Site maintenance",
      weight: UPSIDE_WEIGHTS.siteFreshness,
      earned: stale ? UPSIDE_WEIGHTS.siteFreshness : Math.min(staleness * 3, 6),
      detail: stale
        ? `Copyright ${signals.copyrightYear} — site untouched for ~${staleness} years`
        : `Copyright ${signals.copyrightYear} — actively maintained`,
    });
  } else {
    b.unknown({ key: "siteFreshness", label: "Site maintenance", weight: UPSIDE_WEIGHTS.siteFreshness });
  }

  b.add({
    key: "https",
    label: "Secure connection",
    weight: UPSIDE_WEIGHTS.https,
    earned: signals.https ? 0 : UPSIDE_WEIGHTS.https,
    detail: signals.https ? "HTTPS enabled" : "No HTTPS — basic trust and SEO liability",
  });

  if (isEcommerceRelevant(lead.industry)) {
    b.add({
      key: "ecommerce",
      label: "Online transactions",
      weight: UPSIDE_WEIGHTS.ecommerce,
      earned: signals.hasEcommerce ? 0 : UPSIDE_WEIGHTS.ecommerce,
      detail: signals.hasEcommerce
        ? "Online checkout present"
        : "No online checkout in a category that sells online",
    });
  } else {
    b.unknown({
      key: "ecommerce",
      label: "Online transactions",
      weight: UPSIDE_WEIGHTS.ecommerce,
      detail: "Not applicable to this industry",
    });
  }

  b.add({
    key: "cms",
    label: "Content platform",
    weight: UPSIDE_WEIGHTS.cms,
    earned: signals.cms ? 0 : UPSIDE_WEIGHTS.cms,
    detail: signals.cms
      ? `Running ${signals.cms} — staff can update content`
      : "No detectable CMS — changes likely need a developer",
  });

  b.add({
    key: "analytics",
    label: "Measurement",
    weight: UPSIDE_WEIGHTS.analytics,
    earned: signals.hasAnalytics ? 0 : UPSIDE_WEIGHTS.analytics,
    detail: signals.hasAnalytics
      ? "Analytics installed"
      : "No analytics — marketing spend is currently unmeasured",
  });

  b.add({
    key: "chatWidget",
    label: "Inbound capture",
    weight: UPSIDE_WEIGHTS.chatWidget,
    earned: signals.hasChatWidget ? 0 : UPSIDE_WEIGHTS.chatWidget,
    detail: signals.hasChatWidget
      ? "Live chat present"
      : "No chat or AI capture — after-hours enquiries go unanswered",
  });

  return b.build();
}
