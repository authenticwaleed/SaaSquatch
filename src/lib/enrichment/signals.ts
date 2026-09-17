import * as cheerio from "cheerio";
import type { DigitalSignals } from "@/lib/types";
import {
  ANALYTICS_VENDORS, BOOKING_PHRASES, BOOKING_VENDORS, CHAT_VENDORS, CMS_SIGNATURES,
  COPYRIGHT_YEAR, ECOMMERCE_PHRASES, ECOMMERCE_VENDORS, SOCIAL_HOSTS,
} from "./patterns";

const hasVendor = (haystack: string, vendors: readonly string[]) =>
  vendors.some((v) => haystack.includes(v));

/**
 * Phrases are matched only against interactive elements. "Book now" inside a
 * paragraph is marketing copy; "Book now" on a button is a booking flow.
 */
function hasInteractivePhrase($: cheerio.CheerioAPI, phrases: readonly string[]): boolean {
  let found = false;
  $("a, button, input[type=submit]").each((_, el) => {
    if (found) return;
    const node = $(el);
    const text = `${node.text()} ${node.attr("value") ?? ""} ${node.attr("href") ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (phrases.some((p) => text.includes(p))) found = true;
  });
  return found;
}

function detectCms($: cheerio.CheerioAPI, haystack: string): string | null {
  const generator = $('meta[name="generator"]').attr("content")?.toLowerCase() ?? "";
  for (const [name, markers] of CMS_SIGNATURES) {
    if (generator.includes(name.toLowerCase())) return name;
    if (markers.some((m) => haystack.includes(m))) return name;
  }
  return null;
}

function detectCopyrightYear(text: string, now: Date): number | null {
  const years: number[] = [];
  for (const match of text.matchAll(COPYRIGHT_YEAR)) {
    const year = Number(match[1]);
    // Ignore obvious junk and future-dated boilerplate.
    if (year >= 1990 && year <= now.getFullYear() + 1) years.push(year);
  }
  return years.length ? Math.max(...years) : null;
}

function detectContactForm($: cheerio.CheerioAPI, haystack: string): boolean {
  if (haystack.includes("mailto:")) return true;
  let found = false;
  $("form").each((_, el) => {
    if (found) return;
    const form = $(el);
    const fields = form.find("input, textarea").toArray();
    const signature = fields
      .map((f) => `${$(f).attr("type") ?? ""} ${$(f).attr("name") ?? ""} ${$(f).attr("id") ?? ""}`)
      .join(" ")
      .toLowerCase();
    // A search box is not a contact form.
    if (/email|message|phone|name|comment|enquir|inquir/.test(signature)) found = true;
  });
  return found;
}

function countSocialLinks($: cheerio.CheerioAPI): number {
  const hosts = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    for (const host of SOCIAL_HOSTS) if (href.includes(host)) hosts.add(host);
  });
  return hosts.size;
}

/**
 * Extract digital-maturity signals from a fetched page.
 *
 * Absence of evidence is reported as absence here — a site may well use a vendor
 * we do not fingerprint. That bias is deliberate and documented: it inflates
 * Upside slightly rather than hiding a genuine gap, and Upside is a
 * prioritisation hint, not a diligence finding.
 */
export function extractSignals(
  html: string,
  finalUrl: string,
  bytes: number,
  now = new Date(),
): DigitalSignals {
  const $ = cheerio.load(html);
  const haystack = html.toLowerCase();
  const visibleText = $("body").text().toLowerCase();

  const viewport = $('meta[name="viewport"]').attr("content")?.toLowerCase() ?? "";

  return {
    hasWebsite: true,
    reachable: true,
    https: finalUrl.startsWith("https://"),
    mobileResponsive: viewport.includes("width=device-width"),
    copyrightYear: detectCopyrightYear(`${visibleText} ${haystack}`, now),
    hasOnlineBooking:
      hasVendor(haystack, BOOKING_VENDORS) || hasInteractivePhrase($, BOOKING_PHRASES),
    hasEcommerce:
      hasVendor(haystack, ECOMMERCE_VENDORS) || hasInteractivePhrase($, ECOMMERCE_PHRASES),
    hasChatWidget: hasVendor(haystack, CHAT_VENDORS),
    hasAnalytics: hasVendor(haystack, ANALYTICS_VENDORS),
    hasContactForm: detectContactForm($, haystack),
    cms: detectCms($, haystack),
    pageBytes: bytes,
    socialLinks: countSocialLinks($),
    fetchedAt: now.toISOString(),
  };
}

/** Signals for a lead we could not reach, so downstream scoring stays total. */
export function unreachableSignals(hasWebsite: boolean, now = new Date()): DigitalSignals {
  return {
    hasWebsite,
    reachable: false,
    https: false,
    mobileResponsive: false,
    copyrightYear: null,
    hasOnlineBooking: false,
    hasEcommerce: false,
    hasChatWidget: false,
    hasAnalytics: false,
    hasContactForm: false,
    cms: null,
    pageBytes: 0,
    socialLinks: 0,
    fetchedAt: now.toISOString(),
  };
}
