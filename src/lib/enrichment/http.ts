/**
 * Polite HTTP layer for enrichment.
 *
 * Every outbound request is identifiable, time-boxed and size-capped. We only
 * ever issue GETs against pages a site already serves publicly, and we back off
 * rather than hammer a host that is struggling.
 */

export const USER_AGENT =
  "SaaSquatchSignalBot/1.0 (+https://github.com/authenticwaleed/SaaSquatch; lead qualification research)";

const DEFAULT_TIMEOUT_MS = 8_000;
/** Enough for any reasonable landing page; stops us streaming a 40MB asset. */
const MAX_BYTES = 1_500_000;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  html: string;
  bytes: number;
  error?: string;
}

/** Reads a response body but stops once the cap is hit. */
async function readCapped(res: Response): Promise<{ text: string; bytes: number }> {
  if (!res.body) return { text: "", bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      bytes += value.byteLength;
    }
  }
  reader.cancel().catch(() => {});

  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c.subarray(0, Math.min(c.byteLength, bytes - offset)), offset);
    offset += c.byteLength;
    if (offset >= bytes) break;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(merged), bytes };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function politeFetch(
  url: string,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = opts.retries ?? 2;
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isHtml = contentType.includes("html") || contentType === "";

      if (RETRYABLE.has(res.status) && attempt < retries) {
        lastError = `HTTP ${res.status}`;
        await sleep(2 ** attempt * 500);
        continue;
      }

      const { text, bytes } = isHtml ? await readCapped(res) : { text: "", bytes: 0 };
      return { ok: res.ok, status: res.status, finalUrl: res.url || url, html: text, bytes };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // A timeout or DNS failure is worth one retry; a third attempt rarely helps.
      if (attempt < retries) await sleep(2 ** attempt * 500);
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: 0, finalUrl: url, html: "", bytes: 0, error: lastError };
}
