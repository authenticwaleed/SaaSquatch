/**
 * Runtime limits shared by the API and the UI, so the button never offers more
 * work than the endpoint will accept.
 *
 * The binding constraint is the host's synchronous function timeout. Netlify's
 * free tier cuts a synchronous function off around 10s; enrichment runs five
 * outbound fetches in parallel with an 8s per-request ceiling, so a batch of 15
 * completes comfortably inside that with cache hits, and degrades to partial
 * results rather than a hard failure without them.
 *
 * On a host with a longer ceiling (Vercel Pro, a container platform, or a
 * self-hosted Node process) this can be raised — it is a platform limit, not a
 * property of the enrichment code.
 */
export const ENRICH_BATCH_LIMIT = 15;
