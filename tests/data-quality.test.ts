import { describe, expect, it } from "vitest";
import { dedupeLeads, diceCoefficient, matchLeads, mergeCluster, normalizePhone } from "@/lib/dedupe";
import { verifyEmail } from "@/lib/validation/email";
import type { Lead } from "@/lib/types";

const lead = (over: Partial<Lead> & { id: string }): Lead => ({
  companyName: "Brennan Heating & Air", domain: null, website: null, industry: "HVAC",
  city: "Toledo", state: "OH", country: "US", revenueUsd: null, employeeCount: null,
  ownerName: null, ownerTitle: null, yearFounded: null, email: null, phone: null,
  linkedinUrl: null, ...over,
});

describe("similarity", () => {
  it("scores suffix and conjunction variants as near-identical", () => {
    expect(diceCoefficient("brennan heating air", "brennan heating and air")).toBeGreaterThan(0.85);
  });

  it("keeps unrelated names far apart", () => {
    expect(diceCoefficient("brennan heating", "toledo dental group")).toBeLessThan(0.3);
  });

  it("normalises phone formatting to the last ten digits", () => {
    expect(normalizePhone("+1 (419) 555-0100")).toBe("4195550100");
    expect(normalizePhone("419-555-0100")).toBe("4195550100");
    expect(normalizePhone("555-0100")).toBeNull();
  });
});

describe("matchLeads", () => {
  it("treats a shared domain as the strongest signal", () => {
    const m = matchLeads(
      lead({ id: "a", website: "https://www.brennanhvac.com" }),
      lead({ id: "b", companyName: "Brennan H&A", domain: "brennanhvac.com" }),
    );
    expect(m?.rule).toBe("domain");
    expect(m?.confidence).toBeGreaterThan(0.95);
  });

  it("matches legal-suffix variants in the same location", () => {
    const m = matchLeads(
      lead({ id: "a", companyName: "Brennan Heating & Air" }),
      lead({ id: "b", companyName: "Brennan Heating and Air, Inc." }),
    );
    expect(m?.rule).toBe("name+location");
  });

  it("does not merge two businesses that merely share a phone number", () => {
    // Franchise groups and answering services share lines constantly.
    const m = matchLeads(
      lead({ id: "a", companyName: "Brennan Heating & Air", phone: "419-555-0100" }),
      lead({ id: "b", companyName: "Toledo Dental Group", phone: "(419) 555-0100" }),
    );
    expect(m).toBeNull();
  });

  it("accepts a shared phone once the names also agree", () => {
    const m = matchLeads(
      lead({ id: "a", companyName: "Brennan Heating", phone: "419-555-0100", city: "Toledo" }),
      lead({ id: "b", companyName: "Brennan Heating & Air", phone: "4195550100", city: "Perrysburg" }),
    );
    expect(m?.rule).toBe("phone+name");
  });

  it("keeps same-name businesses in different cities apart", () => {
    expect(
      matchLeads(
        lead({ id: "a", city: "Toledo", state: "OH" }),
        lead({ id: "b", city: "Austin", state: "TX" }),
      ),
    ).toBeNull();
  });
});

describe("mergeCluster", () => {
  it("keeps the most complete record and fills its gaps from the rest", () => {
    const merged = mergeCluster([
      lead({ id: "sparse", website: "https://brennanhvac.com" }),
      lead({ id: "rich", revenueUsd: 3_200_000, employeeCount: 24, ownerName: "Dale Brennan", phone: "419-555-0100" }),
    ]);
    expect(merged.id).toBe("rich");
    expect(merged.revenueUsd).toBe(3_200_000);
    // The gap is filled from the sparser record rather than left null.
    expect(merged.website).toBe("https://brennanhvac.com");
  });
});

describe("dedupeLeads", () => {
  it("collapses a cluster and reports why", () => {
    const result = dedupeLeads([
      lead({ id: "1", website: "https://brennanhvac.com", revenueUsd: 3_200_000 }),
      lead({ id: "2", companyName: "Brennan Heating and Air Inc", domain: "www.brennanhvac.com" }),
      lead({ id: "3", companyName: "Toledo Dental Group", industry: "Dental" }),
    ]);

    expect(result.leads).toHaveLength(2);
    expect(result.duplicatesRemoved).toBe(1);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].memberIds.sort()).toEqual(["1", "2"]);
    expect(result.clusters[0].reasons[0].detail).toMatch(/same domain/i);
  });

  it("merges transitively: A~B by domain and B~C by phone gives one company", () => {
    const result = dedupeLeads([
      lead({ id: "a", website: "https://brennanhvac.com" }),
      lead({ id: "b", domain: "brennanhvac.com", phone: "419-555-0100" }),
      lead({ id: "c", companyName: "Brennan Heating", phone: "(419) 555-0100", city: "Perrysburg" }),
    ]);
    expect(result.leads).toHaveLength(1);
    expect(result.clusters[0].memberIds).toHaveLength(3);
  });

  it("leaves a list of genuinely distinct companies untouched", () => {
    const result = dedupeLeads([
      lead({ id: "1", companyName: "Brennan Heating", website: "https://a.com" }),
      lead({ id: "2", companyName: "Toledo Dental", website: "https://b.com", city: "Toledo" }),
      lead({ id: "3", companyName: "Valley Machining", website: "https://c.com", city: "Akron" }),
    ]);
    expect(result.leads).toHaveLength(3);
    expect(result.duplicatesRemoved).toBe(0);
  });

  it("handles an empty list", () => {
    expect(dedupeLeads([]).leads).toHaveLength(0);
  });
});

describe("verifyEmail", () => {
  const offline = { checkMx: false as const };

  it("rejects malformed addresses", async () => {
    expect((await verifyEmail("not-an-email", offline)).status).toBe("invalid");
    expect((await verifyEmail("a@b", offline)).status).toBe("invalid");
    expect((await verifyEmail("two@@at.com", offline)).status).toBe("invalid");
  });

  it("reports a missing address as unknown rather than invalid", async () => {
    expect((await verifyEmail(null, offline)).status).toBe("unknown");
  });

  it("rejects disposable mailboxes outright", async () => {
    const v = await verifyEmail("someone@mailinator.com", offline);
    expect(v.status).toBe("invalid");
    expect(v.isDisposable).toBe(true);
  });

  it("downgrades a shared inbox without discarding it", async () => {
    // info@ is often the only published address an SMB has — useful, not useless.
    const v = await verifyEmail("info@brennanhvac.com", { ...offline, companyDomain: "brennanhvac.com" });
    expect(v.isRole).toBe(true);
    expect(v.status).toBe("risky");
    expect(v.confidence).toBeGreaterThan(0.5);
    expect(v.reasons.join(" ")).toMatch(/named decision-maker/i);
  });

  it("flags a consumer mailbox on a business lead", async () => {
    const v = await verifyEmail("dalebrennan@gmail.com", { ...offline, companyDomain: "brennanhvac.com" });
    expect(v.isFreeProvider).toBe(true);
    expect(v.confidence).toBeLessThan(0.75);
  });

  it("rates a named address on the company's own domain highest", async () => {
    const named = await verifyEmail("dale@brennanhvac.com", { ...offline, companyDomain: "brennanhvac.com" });
    const role = await verifyEmail("info@brennanhvac.com", { ...offline, companyDomain: "brennanhvac.com" });
    expect(named.matchesCompanyDomain).toBe(true);
    expect(named.confidence).toBeGreaterThan(role.confidence);
  });

  it("penalises a domain that does not match the company website", async () => {
    const v = await verifyEmail("dale@someotherco.com", { ...offline, companyDomain: "brennanhvac.com" });
    expect(v.matchesCompanyDomain).toBe(false);
    expect(v.reasons.join(" ")).toMatch(/does not match/i);
  });
});
