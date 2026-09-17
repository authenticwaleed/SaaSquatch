import { describe, expect, it } from "vitest";
import { extractSignals, isAllowed, parseRobots, unreachableSignals } from "@/lib/enrichment";
import { normalizeCompanyName, normalizeDomain, toUrl } from "@/lib/domain";
import { scoreUpside } from "@/lib/scoring";
import type { Lead } from "@/lib/types";

const NOW = new Date("2026-01-01T00:00:00Z");

const LEGACY_HTML = `<!DOCTYPE html><html><head><title>Brennan Heating</title></head>
<body><table><tr><td>Call us at 419-555-0100</td></tr></table>
<p>We have been serving Toledo since 1994. Book now by calling the office.</p>
<form><input type="text" name="q" placeholder="Search"></form>
<footer>&copy; 2013 Brennan Heating &amp; Air</footer></body></html>`;

const MODERN_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="WordPress 6.4">
<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>
<script src="https://widget.intercom.io/widget/abc"></script>
<link rel="stylesheet" href="/wp-content/themes/x/style.css"></head>
<body><a class="btn" href="https://calendly.com/brennan/service">Book an appointment</a>
<form><input type="email" name="email"><textarea name="message"></textarea></form>
<a href="https://facebook.com/brennan">FB</a><a href="https://instagram.com/brennan">IG</a>
<footer>&copy; 2026 Brennan Heating</footer></body></html>`;

describe("normalizeDomain", () => {
  it("strips scheme, www and path", () => {
    expect(normalizeDomain("HTTPS://WWW.Acme.com/contact?x=1")).toBe("acme.com");
    expect(normalizeDomain("acme.com")).toBe("acme.com");
  });

  it("rejects values that are not registrable domains", () => {
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("  ")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
  });

  it("collapses variants of one company to a single cache key", () => {
    const variants = ["http://acme.com", "https://www.acme.com/", "ACME.com/about"];
    expect(new Set(variants.map(normalizeDomain)).size).toBe(1);
  });
});

describe("normalizeCompanyName", () => {
  it("ignores legal suffixes and punctuation so duplicates collapse", () => {
    expect(normalizeCompanyName("Brennan Heating, Inc.")).toBe("brennan heating");
    expect(normalizeCompanyName("Brennan Heating LLC")).toBe("brennan heating");
  });
});

describe("toUrl", () => {
  it("prefers the explicit website and adds a scheme when missing", () => {
    expect(toUrl("acme.com", null)).toBe("https://acme.com/");
    expect(toUrl(null, "acme.com")).toBe("https://acme.com/");
    expect(toUrl(null, null)).toBeNull();
  });
});

describe("extractSignals", () => {
  it("reads a neglected site as low maturity across the board", () => {
    const s = extractSignals(LEGACY_HTML, "http://brennan.com", 2_400, NOW);
    expect(s.https).toBe(false);
    expect(s.mobileResponsive).toBe(false);
    expect(s.copyrightYear).toBe(2013);
    expect(s.cms).toBeNull();
    expect(s.hasAnalytics).toBe(false);
    expect(s.hasChatWidget).toBe(false);
  });

  it("does not count 'book now' in body copy as a booking flow", () => {
    // The legacy page says "Book now by calling the office" in a paragraph.
    expect(extractSignals(LEGACY_HTML, "http://brennan.com", 2_400, NOW).hasOnlineBooking).toBe(false);
  });

  it("does count a booking vendor behind a real link", () => {
    expect(extractSignals(MODERN_HTML, "https://brennan.com", 4_000, NOW).hasOnlineBooking).toBe(true);
  });

  it("does not count a search box as a contact form", () => {
    expect(extractSignals(LEGACY_HTML, "http://brennan.com", 2_400, NOW).hasContactForm).toBe(false);
  });

  it("identifies vendors, CMS and socials on a modern site", () => {
    const s = extractSignals(MODERN_HTML, "https://brennan.com", 4_000, NOW);
    expect(s.https).toBe(true);
    expect(s.mobileResponsive).toBe(true);
    expect(s.cms).toBe("WordPress");
    expect(s.hasAnalytics).toBe(true);
    expect(s.hasChatWidget).toBe(true);
    expect(s.hasContactForm).toBe(true);
    expect(s.socialLinks).toBe(2);
    expect(s.copyrightYear).toBe(2026);
  });
});

describe("robots.txt", () => {
  const body = `
User-agent: *
Disallow: /private
Crawl-delay: 2

User-agent: SaaSquatchSignalBot
Disallow: /nope
Allow: /nope/ok
`;

  it("prefers the group naming our bot over the wildcard", () => {
    const p = parseRobots(body);
    expect(isAllowed(p, "/private")).toBe(true); // wildcard rule does not apply to us
    expect(isAllowed(p, "/nope")).toBe(false);
  });

  it("lets the longest match win, so a nested Allow overrides a Disallow", () => {
    const p = parseRobots(body);
    expect(isAllowed(p, "/nope/ok")).toBe(true);
  });

  it("treats an empty Disallow as permission and a missing file as permissive", () => {
    expect(isAllowed(parseRobots("User-agent: *\nDisallow:"), "/anything")).toBe(true);
    expect(isAllowed(parseRobots(""), "/anything")).toBe(true);
  });

  it("caps an abusive crawl-delay", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 9999").crawlDelayMs).toBe(10_000);
  });
});

describe("scoreUpside null-signals contract", () => {
  const lead: Lead = {
    id: "1", companyName: "Acme", domain: "acme.com", website: "https://acme.com",
    industry: "HVAC", city: null, state: null, country: "US", revenueUsd: 3_000_000,
    employeeCount: 20, ownerName: "Dale", ownerTitle: "Owner", yearFounded: 1995,
    email: null, phone: null, linkedinUrl: null,
  };

  it("reports zero confidence when a lead was never enriched", () => {
    const up = scoreUpside(lead, null, NOW);
    expect(up.confidence).toBe(0);
    expect(up.score).toBe(0);
  });

  it("does not reward a site that merely blocks crawlers", () => {
    // Blocked by robots -> null signals. This must not look like 'no web presence'.
    const blocked = scoreUpside(lead, null, NOW);
    const absent = scoreUpside(lead, unreachableSignals(false, NOW), NOW);
    expect(absent.score).toBe(90);
    expect(blocked.score).toBeLessThan(absent.score);
  });
});
