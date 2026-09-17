import { normalizeDomain } from "@/lib/domain";
import { hasMxRecord } from "./mx";

/**
 * Email validation for outreach.
 *
 * The question is not only "is this address syntactically legal" but "is it worth
 * a rep's time". For SMB acquisition outreach that judgement is different from
 * generic B2B sales: a shared info@ inbox is often the *only* published address a
 * 30-year-old family business has, so it is downgraded rather than discarded.
 */

export type EmailStatus = "valid" | "risky" | "invalid" | "unknown";

export interface EmailVerdict {
  email: string;
  status: EmailStatus;
  /** 0-1, how much a rep should trust this address. */
  confidence: number;
  isRole: boolean;
  isFreeProvider: boolean;
  isDisposable: boolean;
  /** null when DNS was not consulted or was inconclusive. */
  hasMx: boolean | null;
  matchesCompanyDomain: boolean | null;
  reasons: string[];
}

// Deliberately practical rather than RFC-exhaustive: rejects what actually
// appears in scraped data without failing on legal-but-rare addresses.
const SYNTAX = /^[^\s@,;:<>()[\]\\"]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const ROLE_LOCALPARTS = new Set([
  "info", "sales", "support", "admin", "contact", "hello", "office", "team",
  "help", "billing", "accounts", "accounting", "service", "services", "enquiries",
  "inquiries", "marketing", "webmaster", "postmaster", "noreply", "no-reply",
  "mail", "general", "reception", "frontdesk",
]);

const FREE_PROVIDERS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com",
  "protonmail.com", "proton.me", "gmx.com", "mail.com", "yandex.com", "live.com",
  "msn.com", "me.com", "comcast.net", "sbcglobal.net", "verizon.net", "att.net",
]);

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "throwawaymail.com", "yopmail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "temp-mail.org", "fakeinbox.com", "maildrop.cc",
]);

export function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return { local: email.slice(0, at).toLowerCase(), domain: email.slice(at + 1).toLowerCase() };
}

/**
 * Validate an address. DNS is consulted unless `checkMx` is false, which keeps
 * the function usable synchronously-ish in tests and on the client.
 */
export async function verifyEmail(
  rawEmail: string | null,
  opts: { companyDomain?: string | null; checkMx?: boolean } = {},
): Promise<EmailVerdict> {
  const email = (rawEmail ?? "").trim().toLowerCase();
  const base: EmailVerdict = {
    email,
    status: "unknown",
    confidence: 0,
    isRole: false,
    isFreeProvider: false,
    isDisposable: false,
    hasMx: null,
    matchesCompanyDomain: null,
    reasons: [],
  };

  if (!email) return { ...base, status: "unknown", reasons: ["No email on file"] };
  if (!SYNTAX.test(email)) {
    return { ...base, status: "invalid", reasons: ["Malformed address"] };
  }

  const parts = splitEmail(email);
  if (!parts) return { ...base, status: "invalid", reasons: ["Malformed address"] };

  const { local, domain } = parts;
  const reasons: string[] = [];
  let confidence = 1;

  const isDisposable = DISPOSABLE.has(domain);
  if (isDisposable) {
    return {
      ...base,
      isDisposable: true,
      status: "invalid",
      reasons: ["Disposable mailbox provider"],
    };
  }

  const isRole = ROLE_LOCALPARTS.has(local.split("+")[0]);
  if (isRole) {
    confidence -= 0.25;
    reasons.push("Shared inbox — reaches the business, not a named decision-maker");
  }

  const isFreeProvider = FREE_PROVIDERS.has(domain);
  if (isFreeProvider) {
    confidence -= 0.2;
    reasons.push("Consumer mailbox rather than a company domain");
  }

  const companyDomain = normalizeDomain(opts.companyDomain ?? null);
  let matchesCompanyDomain: boolean | null = null;
  if (companyDomain) {
    matchesCompanyDomain = normalizeDomain(domain) === companyDomain;
    if (matchesCompanyDomain) {
      reasons.push("Matches the company's own domain");
    } else if (!isFreeProvider) {
      confidence -= 0.15;
      reasons.push("Domain does not match the company website");
    }
  }

  let hasMx: boolean | null = null;
  if (opts.checkMx !== false) {
    hasMx = await hasMxRecord(domain);
    if (hasMx === false) {
      return {
        ...base,
        isRole,
        isFreeProvider,
        hasMx: false,
        matchesCompanyDomain,
        status: "invalid",
        reasons: [...reasons, "Domain does not accept mail (no MX record)"],
      };
    }
    if (hasMx === null) {
      confidence -= 0.1;
      reasons.push("MX lookup inconclusive");
    }
  } else {
    confidence -= 0.1;
    reasons.push("Deliverability not checked");
  }

  confidence = Math.max(0, Math.round(confidence * 100) / 100);
  const status: EmailStatus = confidence >= 0.75 ? "valid" : "risky";

  return {
    email,
    status,
    confidence,
    isRole,
    isFreeProvider,
    isDisposable: false,
    hasMx,
    matchesCompanyDomain,
    reasons,
  };
}
