import Papa from "papaparse";
import type { LeadRow } from "@/lib/pipeline";
import type { Lead } from "@/lib/types";

/**
 * CRM-shaped export.
 *
 * Column headers match what HubSpot and Salesforce expect on import, so the file
 * maps without hand-editing. The scores ride along as custom properties — the
 * point of the tool is that a rep can sort their CRM by Priority on day one,
 * which does not happen if the ranking is stranded in our UI.
 */
const COLUMNS: Array<[string, (r: LeadRow) => string | number | null]> = [
  ["Company Name", (r) => r.lead.companyName],
  ["Website URL", (r) => r.lead.website ?? r.lead.domain],
  ["Industry", (r) => r.lead.industry],
  ["City", (r) => r.lead.city],
  ["State/Region", (r) => r.lead.state],
  ["Country", (r) => r.lead.country],
  ["Annual Revenue", (r) => r.lead.revenueUsd],
  ["Number of Employees", (r) => r.lead.employeeCount],
  ["Year Founded", (r) => r.lead.yearFounded],
  ["Contact Name", (r) => r.lead.ownerName],
  ["Job Title", (r) => r.lead.ownerTitle],
  ["Email", (r) => r.lead.email],
  ["Phone Number", (r) => r.lead.phone],
  ["Email Status", (r) => r.email.status],
  ["Email Confidence", (r) => r.email.confidence],
  ["Priority Score", (r) => r.score.priority],
  ["Priority Band", (r) => r.score.band],
  ["Acquisition Fit", (r) => r.score.fit.score],
  ["AI-Readiness Upside", (r) => r.score.upside.score],
  ["Signal Summary", (r) => r.score.headline],
  ["Top Opportunities", (r) =>
    r.score.upside.contributions.filter((c) => c.earned > 0)
      .sort((a, b) => b.earned - a.earned).slice(0, 3)
      .map((c) => c.label).join("; ")],
  ["Merged From Rows", (r) => (r.mergedFrom.length > 1 ? r.mergedFrom.join(", ") : "")],
];

export function toCsv(rows: readonly LeadRow[]): string {
  return Papa.unparse({
    fields: COLUMNS.map(([header]) => header),
    data: rows.map((row) => COLUMNS.map(([, get]) => get(row) ?? "")),
  });
}

const HEADER_ALIASES: Record<string, keyof Lead> = {
  company: "companyName", "company name": "companyName", name: "companyName", business: "companyName",
  website: "website", "website url": "website", url: "website", domain: "domain",
  industry: "industry", category: "industry",
  city: "city", state: "state", "state/region": "state", region: "state", country: "country",
  revenue: "revenueUsd", "annual revenue": "revenueUsd",
  employees: "employeeCount", "number of employees": "employeeCount", "employee count": "employeeCount",
  owner: "ownerName", "owner name": "ownerName", "contact name": "ownerName", contact: "ownerName",
  title: "ownerTitle", "job title": "ownerTitle", "owner title": "ownerTitle",
  founded: "yearFounded", "year founded": "yearFounded",
  email: "email", "email address": "email",
  phone: "phone", "phone number": "phone", telephone: "phone",
  linkedin: "linkedinUrl", "linkedin url": "linkedinUrl",
};

const NUMERIC = new Set<keyof Lead>(["revenueUsd", "employeeCount", "yearFounded"]);

/** Parse a pasted or uploaded CSV, tolerating the header names exporters actually emit. */
export function fromCsv(text: string): Lead[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return parsed.data
    .map((record, index): Lead | null => {
      const lead: Lead = {
        id: `csv-${index + 1}`, companyName: "", domain: null, website: null, industry: null,
        city: null, state: null, country: null, revenueUsd: null, employeeCount: null,
        ownerName: null, ownerTitle: null, yearFounded: null, email: null, phone: null,
        linkedinUrl: null,
      };

      for (const [rawHeader, rawValue] of Object.entries(record)) {
        const field = HEADER_ALIASES[rawHeader];
        const value = rawValue?.trim();
        if (!field || !value) continue;

        if (NUMERIC.has(field)) {
          const n = Number(value.replace(/[^0-9.]/g, ""));
          if (Number.isFinite(n) && n > 0) (lead[field] as number) = n;
        } else {
          (lead[field] as string) = value;
        }
      }

      return lead.companyName ? lead : null;
    })
    .filter((l): l is Lead => l !== null);
}
