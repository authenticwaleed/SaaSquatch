import type { Lead } from "@/lib/types";
import { normalizeCompanyName, normalizeDomain } from "@/lib/domain";
import { diceCoefficient, normalizePhone } from "./similarity";

/**
 * Deduplication for scraped lead lists.
 *
 * Scraped exports duplicate constantly: the same company appears under
 * "Brennan Heating & Air", "Brennan Heating and Air, Inc." and a bare domain row.
 * Paying twice to contact one prospect is the visible cost; the worse one is two
 * reps calling the same owner in the same week.
 *
 * Every merge records *why* it happened, so a user can audit a cluster rather
 * than trust a black box that silently dropped a row.
 */

export type MatchRule = "domain" | "email" | "phone+name" | "name+location";

export interface MatchReason {
  rule: MatchRule;
  detail: string;
  confidence: number;
}

export interface DuplicateCluster {
  primaryId: string;
  memberIds: string[];
  reasons: MatchReason[];
  merged: Lead;
}

export interface DedupeResult {
  /** Canonical set: one merged record per real company. */
  leads: Lead[];
  clusters: DuplicateCluster[];
  duplicatesRemoved: number;
}

const NAME_LOCATION_THRESHOLD = 0.85;
const PHONE_NAME_THRESHOLD = 0.5;

class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

const emailKey = (email: string | null) => email?.trim().toLowerCase() || null;
const locationKey = (lead: Lead) =>
  [lead.city?.trim().toLowerCase(), lead.state?.trim().toLowerCase()].filter(Boolean).join(",");

/** How many fields this record actually populates — used to pick the survivor. */
function completeness(lead: Lead): number {
  return Object.values(lead).filter((v) => v !== null && v !== undefined && v !== "").length;
}

/**
 * Blocking keys. Two leads are only compared if they share at least one, which
 * keeps the comparison count near-linear instead of quadratic on large exports.
 */
function blockingKeys(lead: Lead): string[] {
  const keys: string[] = [];
  const domain = normalizeDomain(lead.website ?? lead.domain);
  const phone = normalizePhone(lead.phone);
  const email = emailKey(lead.email);
  const name = normalizeCompanyName(lead.companyName);

  if (domain) keys.push(`d:${domain}`);
  if (phone) keys.push(`p:${phone}`);
  if (email) keys.push(`e:${email}`);
  if (name.length >= 3) keys.push(`n:${name.slice(0, 4)}:${locationKey(lead)}`);
  return keys;
}

/** Decide whether two leads are the same company, and say why. */
export function matchLeads(a: Lead, b: Lead): MatchReason | null {
  const domainA = normalizeDomain(a.website ?? a.domain);
  const domainB = normalizeDomain(b.website ?? b.domain);
  if (domainA && domainB && domainA === domainB) {
    return { rule: "domain", detail: `Same domain (${domainA})`, confidence: 0.98 };
  }

  const emailA = emailKey(a.email);
  const emailB = emailKey(b.email);
  if (emailA && emailB && emailA === emailB) {
    return { rule: "email", detail: `Same contact email (${emailA})`, confidence: 0.95 };
  }

  const nameA = normalizeCompanyName(a.companyName);
  const nameB = normalizeCompanyName(b.companyName);
  const nameScore = diceCoefficient(nameA, nameB);

  // Phone alone is not enough: franchises and answering services share numbers,
  // so we require the names to at least loosely agree.
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  if (phoneA && phoneB && phoneA === phoneB && nameScore >= PHONE_NAME_THRESHOLD) {
    return {
      rule: "phone+name",
      detail: `Same phone (${phoneA}) and similar name (${nameScore.toFixed(2)})`,
      confidence: 0.9,
    };
  }

  const locA = locationKey(a);
  const locB = locationKey(b);
  if (nameScore >= NAME_LOCATION_THRESHOLD && locA && locA === locB) {
    return {
      rule: "name+location",
      detail: `Near-identical name (${nameScore.toFixed(2)}) in the same location`,
      confidence: 0.85,
    };
  }

  return null;
}

/** Field-by-field merge: the most complete record wins, gaps fill from the rest. */
export function mergeCluster(members: Lead[]): Lead {
  const ordered = [...members].sort((x, y) => completeness(y) - completeness(x));
  const merged = { ...ordered[0] };

  for (const candidate of ordered.slice(1)) {
    for (const key of Object.keys(merged) as Array<keyof Lead>) {
      if (key === "id") continue;
      const current = merged[key];
      const incoming = candidate[key];
      if ((current === null || current === undefined || current === "") && incoming) {
        // Each field is independently typed; the merge is uniform by construction.
        (merged as Record<string, unknown>)[key] = incoming;
      }
    }
  }
  return merged;
}

export function dedupeLeads(leads: readonly Lead[]): DedupeResult {
  const uf = new UnionFind(leads.length);
  const buckets = new Map<string, number[]>();

  leads.forEach((lead, i) => {
    for (const key of blockingKeys(lead)) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    }
  });

  const reasonsByPair = new Map<string, MatchReason>();
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        const pairKey = a < b ? `${a}:${b}` : `${b}:${a}`;
        if (reasonsByPair.has(pairKey)) continue;

        const reason = matchLeads(leads[a], leads[b]);
        if (reason) {
          reasonsByPair.set(pairKey, reason);
          uf.union(a, b);
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  leads.forEach((_, i) => {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  });

  const clusters: DuplicateCluster[] = [];
  const canonical: Lead[] = [];

  for (const indices of groups.values()) {
    const members = indices.map((i) => leads[i]);
    if (members.length === 1) {
      canonical.push(members[0]);
      continue;
    }

    const merged = mergeCluster(members);
    const memberSet = new Set(indices);
    const reasons = [...reasonsByPair.entries()]
      .filter(([pair]) => pair.split(":").every((n) => memberSet.has(Number(n))))
      .map(([, reason]) => reason);

    clusters.push({
      primaryId: merged.id,
      memberIds: members.map((m) => m.id),
      reasons,
      merged,
    });
    canonical.push(merged);
  }

  return {
    leads: canonical,
    clusters,
    duplicatesRemoved: leads.length - canonical.length,
  };
}

export { diceCoefficient, normalizePhone } from "./similarity";
