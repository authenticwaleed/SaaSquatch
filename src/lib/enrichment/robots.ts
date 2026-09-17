/**
 * Minimal robots.txt support following RFC 9309.
 *
 * We check before every enrichment fetch. Missing or unparseable robots.txt is
 * treated as permissive (the standard convention), but an explicit Disallow is
 * always honoured — including when it costs us the lead.
 */

import { politeFetch, USER_AGENT } from "./http";

interface Rule {
  allow: boolean;
  path: string;
}

export interface RobotsPolicy {
  rules: Rule[];
  crawlDelayMs: number;
}

const BOT_TOKEN = "saasquatchsignalbot";
const memo = new Map<string, RobotsPolicy>();

export function parseRobots(body: string): RobotsPolicy {
  const lines = body.split(/\r?\n/);
  const groups: Array<{ agents: string[]; rules: Rule[]; crawlDelay?: number }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      // Consecutive user-agent lines share one rule group.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }

    lastWasAgent = false;
    if (!current) continue;

    if (field === "disallow") current.rules.push({ allow: false, path: value });
    else if (field === "allow") current.rules.push({ allow: true, path: value });
    else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n)) current.crawlDelay = n;
    }
  }

  // A group naming our bot wins outright; otherwise fall back to the wildcard.
  const specific = groups.find((g) => g.agents.some((a) => a.includes(BOT_TOKEN)));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  const chosen = specific ?? wildcard;

  return {
    rules: chosen?.rules ?? [],
    crawlDelayMs: Math.min((chosen?.crawlDelay ?? 0) * 1000, 10_000),
  };
}

/** RFC 9309: the longest matching path wins; Allow breaks ties. */
export function isAllowed(policy: RobotsPolicy, path: string): boolean {
  let best: Rule | null = null;
  for (const rule of policy.rules) {
    if (rule.path === "") continue;
    const pattern = rule.path.replace(/\*$/, "");
    if (!path.startsWith(pattern)) continue;
    if (!best || pattern.length > best.path.replace(/\*$/, "").length) best = rule;
    else if (pattern.length === best.path.replace(/\*$/, "").length && rule.allow) best = rule;
  }
  // An empty Disallow value means "allow everything" and is skipped above.
  return best ? best.allow : true;
}

export async function getRobotsPolicy(origin: string): Promise<RobotsPolicy> {
  const cached = memo.get(origin);
  if (cached) return cached;

  const res = await politeFetch(`${origin}/robots.txt`, { timeoutMs: 5_000, retries: 1 });
  // 4xx (including 404) means no restrictions. A 5xx technically means "stay out",
  // but for a single polite GET we follow the permissive convention and proceed.
  const policy = res.ok && res.html ? parseRobots(res.html) : { rules: [], crawlDelayMs: 0 };

  memo.set(origin, policy);
  return policy;
}

export async function canFetch(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const policy = await getRobotsPolicy(parsed.origin);
    return isAllowed(policy, parsed.pathname || "/");
  } catch {
    return false;
  }
}

export { USER_AGENT };
