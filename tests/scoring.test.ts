import { describe, expect, it } from "vitest";
import { classifyIndustry, rankLeads, scoreFit, scoreLead, scoreUpside } from "@/lib/scoring";
import type { DigitalSignals, Lead } from "@/lib/types";

const NOW = new Date("2026-01-01T00:00:00Z");

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: "1",
  companyName: "Acme Co",
  domain: "acme.com",
  website: "https://acme.com",
  industry: "HVAC",
  city: "Toledo",
  state: "OH",
  country: "US",
  revenueUsd: 3_200_000,
  employeeCount: 24,
  ownerName: "Dale Brennan",
  ownerTitle: "Owner",
  yearFounded: 1996,
  email: "dale@acme.com",
  phone: "+1-419-555-0100",
  linkedinUrl: null,
  ...over,
});

const signals = (over: Partial<DigitalSignals> = {}): DigitalSignals => ({
  hasWebsite: true,
  reachable: true,
  https: true,
  mobileResponsive: true,
  copyrightYear: 2026,
  hasOnlineBooking: true,
  hasEcommerce: true,
  hasChatWidget: true,
  hasAnalytics: true,
  hasContactForm: true,
  cms: "WordPress",
  pageBytes: 50_000,
  socialLinks: 3,
  fetchedAt: NOW.toISOString(),
  ...over,
});

describe("classifyIndustry", () => {
  it("tiers fragmented owner-operated services highest", () => {
    expect(classifyIndustry("Plumbing & Drain")).toBe("A");
    expect(classifyIndustry("Dental Practice")).toBe("A");
  });

  it("checks tier C before tier B so 'software consulting' is not credited for 'consulting'", () => {
    expect(classifyIndustry("Software Consulting")).toBe("C");
  });

  it("returns null for anything unrecognised", () => {
    expect(classifyIndustry("Underwater Basket Weaving")).toBeNull();
    expect(classifyIndustry(null)).toBeNull();
  });
});

describe("scoreFit", () => {
  it("scores a textbook ETA target highly with full confidence", () => {
    const fit = scoreFit(lead(), NOW);
    expect(fit.score).toBeGreaterThanOrEqual(90);
    expect(fit.confidence).toBe(1);
  });

  it("scores a venture-shaped company poorly", () => {
    const fit = scoreFit(
      lead({ industry: "SaaS Startup", yearFounded: 2023, revenueUsd: 400_000, employeeCount: 6 }),
      NOW,
    );
    expect(fit.score).toBeLessThan(40);
  });

  it("lowers confidence for missing data instead of penalising the score", () => {
    const sparse = scoreFit(lead({ revenueUsd: null, employeeCount: null }), NOW);
    expect(sparse.confidence).toBeLessThan(1);
    // Remaining signals are still strong, so the score holds up.
    expect(sparse.score).toBeGreaterThanOrEqual(90);
  });

  it("rewards a confirmed owner title over a bare name", () => {
    const titled = scoreFit(lead(), NOW);
    const untitled = scoreFit(lead({ ownerTitle: null }), NOW);
    expect(titled.score).toBeGreaterThan(untitled.score);
  });

  it("treats a 25-year-old business as higher succession likelihood than a new one", () => {
    const old = scoreFit(lead({ yearFounded: 1990 }), NOW);
    const young = scoreFit(lead({ yearFounded: 2024 }), NOW);
    expect(old.score).toBeGreaterThan(young.score);
  });
});

describe("scoreUpside", () => {
  it("scores a fully modern business near zero — there is little left to unlock", () => {
    const up = scoreUpside(lead(), signals(), NOW);
    expect(up.score).toBeLessThanOrEqual(10);
  });

  it("scores a neglected site highly — this is the inversion the model depends on", () => {
    const up = scoreUpside(
      lead(),
      signals({
        https: false,
        mobileResponsive: false,
        copyrightYear: 2014,
        hasOnlineBooking: false,
        hasChatWidget: false,
        hasAnalytics: false,
        cms: null,
      }),
      NOW,
    );
    expect(up.score).toBeGreaterThanOrEqual(80);
  });

  it("treats a total absence of web presence as the strongest single signal", () => {
    const up = scoreUpside(lead(), signals({ hasWebsite: false }), NOW);
    expect(up.score).toBe(90);
    expect(up.contributions).toHaveLength(1);
  });

  it("flags an unreachable site without scoring it as modern", () => {
    const up = scoreUpside(lead(), signals({ reachable: false }), NOW);
    expect(up.score).toBe(70);
    expect(up.confidence).toBeLessThan(1);
  });

  it("excludes booking from the denominator when the industry does not use it", () => {
    const up = scoreUpside(lead({ industry: "Software" }), signals({ hasOnlineBooking: false }), NOW);
    const booking = up.contributions.find((c) => c.key === "onlineBooking")!;
    expect(booking.earned).toBe(0);
    expect(booking.detail).toMatch(/not applicable/i);
  });

  it("does not penalise a machine shop for having no online checkout", () => {
    const up = scoreUpside(lead({ industry: "Machining" }), signals({ hasEcommerce: false }), NOW);
    expect(up.contributions.find((c) => c.key === "ecommerce")!.earned).toBe(0);
  });
});

describe("scoreLead", () => {
  it("ranks a strong-fit, low-maturity business in band A", () => {
    const s = scoreLead(lead(), signals({ hasOnlineBooking: false, mobileResponsive: false, cms: null }), NOW);
    expect(s.band).toBe("A");
    expect(s.priority).toBeGreaterThanOrEqual(75);
  });

  it("gates priority on fit so an unacquirable company cannot float to the top", () => {
    // Maximum upside, but far too small to buy.
    const weak = scoreLead(
      lead({ revenueUsd: 40_000, employeeCount: 1, yearFounded: 2025, industry: "Crypto", ownerName: null }),
      signals({ hasWebsite: false }),
      NOW,
    );
    expect(weak.score ?? weak.upside.score).toBeGreaterThan(0);
    expect(weak.upside.score).toBe(90);
    expect(weak.priority).toBeLessThan(45);
    expect(weak.band).toBe("D");
  });

  it("builds a headline naming the top gaps", () => {
    const s = scoreLead(lead(), signals({ hasOnlineBooking: false, mobileResponsive: false }), NOW);
    expect(s.headline).toMatch(/30-yr, owner-operated, hvac/);
    expect(s.headline).toMatch(/gaps:/);
  });
});

describe("rankLeads", () => {
  it("orders by priority and breaks ties toward the better fit", () => {
    const ranked = rankLeads(
      [
        { lead: lead({ id: "startup", industry: "SaaS", yearFounded: 2024, revenueUsd: 300_000, employeeCount: 4 }), signals: signals() },
        { lead: lead({ id: "target" }), signals: signals({ hasOnlineBooking: false, mobileResponsive: false, cms: null }) },
        { lead: lead({ id: "modern" }), signals: signals() },
      ],
      NOW,
    );
    expect(ranked[0].lead.id).toBe("target");
    expect(ranked[ranked.length - 1].lead.id).toBe("startup");
  });
});
