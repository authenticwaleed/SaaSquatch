/**
 * Domain normalisation. Shared by enrichment (cache keys) and dedupe (identity),
 * so the two always agree on what counts as "the same company".
 */

/** `HTTPS://WWW.Acme.com/contact?x=1` -> `acme.com`. Returns null if unusable. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (!/^https?:\/\//.test(value)) value = `https://${value}`;

  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }

  host = host.replace(/^(www|web|m)\./, "").replace(/\.$/, "");
  // Reject anything that isn't plausibly a registrable domain.
  if (!host.includes(".") || host.length < 4) return null;
  return host;
}

/** Best-effort absolute URL for a lead, preferring an explicit website field. */
export function toUrl(website: string | null, domain: string | null): string | null {
  const candidate = website?.trim() || domain?.trim();
  if (!candidate) return null;
  const withScheme = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/** Strips a legal suffix so "Brennan Heating LLC" and "Brennan Heating, Inc." match. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(inc|llc|l\.l\.c|ltd|limited|co|corp|corporation|company|plc|gmbh|pllc|pc|lp|llp)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
