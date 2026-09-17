# SaaSquatch Signal

**SaaSquatch finds companies. Signal tells you which ones to call first — and why.**

An acquisition-readiness scoring layer built on top of [SaaSquatch Leads](https://www.saasquatchleads.com/).

---

## The problem

SaaSquatch is good at what it does: it scrapes and enriches company records — email, phone,
LinkedIn, revenue, industry, headcount, owner. What it returns is a **flat, unranked list**.

A searcher working 300 rows still has to open each one and decide by hand which is worth a call.
That triage is the actual bottleneck, and it is the part no one has automated.

## The insight

Caprae's users are not a sales team. They are **acquirers**. Caprae's own positioning points at
the $10 trillion of small and mid-sized businesses changing hands as their owners retire, and the
firm's stated thesis is that *"the greater value creation is post-acquisition, not at the time of
acquisition."*

So the right question for each row is not "is this a good lead?" It is two questions:

1. **Acquisition Fit** — is this business realistically buyable?
2. **AI-Readiness Upside** — how much value could be unlocked *after* the deal closes?

Signal scores both, ranks by the blend, and shows its work.

### The counter-intuitive part

**A low digital-maturity score raises the Upside score.**

A profitable 30-year-old HVAC company still taking every booking by phone is not a bad lead.
It is the entire thesis. The gap between how that business runs today and how it could run is
exactly the value a buyer creates post-close.

That inversion produces nonsense on its own — a defunct one-person shop also has no website —
so **Priority is gated on Fit**. A company that cannot realistically be acquired never outranks
one that can, however much headroom it shows.

```
RANK  PRI  FIT  UPS  BAND  COMPANY
  1    91  100   77   A    Brennan Heating & Air    32-yr HVAC, $3.2M, site untouched since 2015
  2    77   93   52   A    Valley Precision Machining
  3    58   96    0   C    Lakeside Dental          great target — but nothing left to unlock
  4    42   32   90   D    Corner Barbers           max upside, gated: too small to buy
  5    26   44    0   D    Nimbus AI Labs           venture-shaped, no succession event
```

Rows 3 and 4 are the ones that matter. Lakeside Dental has near-perfect Fit but zero Upside, so
it drops a band. Corner Barbers has maximum Upside but is gated to D.

---

## How scoring works

Both axes are pure functions over a lead and its enrichment signals. Every score carries a
per-signal breakdown, so the UI renders "Why this score" from data that already exists —
there is no separate explanation path that can drift from the number.

### Acquisition Fit (100 pts)

| Signal | Weight | Reasoning |
|---|---|---|
| Revenue band | 30 | $1M–$5M is the core ETA sweet spot |
| Operating scale | 20 | 10–50 staff: runs without the owner in every seat |
| Succession likelihood | 20 | Business age is the cheapest proxy for a retiring founder |
| Owner-operated | 15 | A named owner means a decision-maker, not a board |
| Industry fit | 15 | Fragmented owner-operated services beat venture-shaped firms |

### AI-Readiness Upside (100 pts) — inverted

| Signal | Weight | Points earned when… |
|---|---|---|
| Online booking | 18 | absent — bookings are phone-bound |
| Mobile-ready | 15 | no responsive viewport |
| Site maintenance | 13 | copyright 3+ years stale |
| HTTPS | 12 | absent |
| Online transactions | 12 | absent *in a category that sells online* |
| Content platform | 12 | no CMS — changes need a developer |
| Measurement | 10 | no analytics — spend is unmeasured |
| Inbound capture | 8 | no chat — after-hours enquiries are lost |

**Weights normalise over available data.** A lead missing revenue is not punished for the gap;
it is scored on its remaining signals and reports lower `confidence`. Signals that do not apply
to an industry are excluded from the denominator entirely — a machine shop is never marked down
for having no online checkout.

`Priority = 0.6 × Fit + 0.4 × Upside`, clamped when `Fit < 35`.

**Un-enriched leads rank on Fit alone.** Upside with zero confidence means we never
measured it, not that there is none. Blending in an unobserved zero would rank a
freshly imported lead below a scanned one purely for not having been looked at yet.

All weights live in [`src/lib/scoring/config.ts`](src/lib/scoring/config.ts) and are tunable
without touching logic.

---

## Architecture

| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router), TypeScript | One deployable; server and client in one repo |
| UI | Tailwind CSS 4, TanStack Table | |
| API | Route Handlers + Server Actions | No separate service to host |
| **Database** | **Neon — serverless Postgres**, Drizzle ORM | Scales to zero; HTTP driver works in serverless |
| **Caching** | **Upstash Redis**, 7-day TTL keyed by normalised domain | See below |
| Enrichment | `fetch` + Cheerio | See below |
| **Hosting** | **Vercel — serverless functions**, not static | Enrichment needs a server runtime |
| **Deployment** | Push to `main` → Vercel builds and deploys | Preview deploy per PR |
| **Cloud** | Vercel (compute), Neon (data), Upstash (cache) | |

### Caching and performance

- **Enrichment cache** keyed by normalised domain, 7-day TTL. Measured on a live run:
  **3,210 ms cold → 0 ms warm** for the same batch.
- **Concurrency-capped** batch enrichment (`p-limit`, default 5) bounds simultaneous outbound
  connections regardless of batch size, keeping a serverless invocation inside its socket budget.
- **Cache degrades gracefully.** With no Upstash credentials the cache falls back to an
  in-process Map, so the repo clones and runs with no environment at all. A Redis outage is
  caught and never fails an enrichment run.
- **Byte-capped responses** (1.5 MB) and an 8 s timeout stop one slow host stalling a batch.

### Why Cheerio and not a headless browser

One `GET` per company, parsed with Cheerio, enriches hundreds of leads in seconds inside a
serverless function. Playwright would raise recall slightly and cost a browser cold-start per
lead — the wrong trade for a triage tool where the output is a *ranking*, not a diligence report.

Detection is deliberately conservative about phrases: `"Book now"` in a paragraph is marketing
copy and is ignored; `"Book now"` on a link or button is a booking flow and counts.

---

## Ethical collection

- **robots.txt is checked before every fetch** (RFC 9309: longest-match wins, `Allow` breaks
  ties). A group naming our bot takes precedence over the wildcard.
- **Declared identity.** Requests are sent as
  `SaaSquatchSignalBot/1.0 (+https://github.com/authenticwaleed/SaaSquatch; lead qualification research)`.
- **Public pages only.** One `GET` of a homepage a business already serves publicly. No login
  walls, no personal data beyond the business contact details SaaSquatch already supplies.
- **`Crawl-delay` is honoured**, capped at 10 s so one hostile file cannot stall a batch.
- **Blocked means blocked.** A robots-disallowed lead returns `signals: null` and is scored on
  Fit alone with `upside.confidence = 0` — it is never guessed at, and never penalised for
  blocking us. (A site that blocks crawlers is often a *more* sophisticated operation, not less.)

### Known characteristics

- Absence of a fingerprint is reported as absence of a feature. A site may use a vendor we do not
  recognise. This biases Upside slightly high rather than hiding a real gap — acceptable for a
  prioritisation hint, not acceptable for diligence, and labelled as such in the UI.
- An unreachable domain scores 70 Upside at `confidence 0.5`. That is intentional (a dead site is
  a strong neglect signal) but it is the most likely source of a false positive, so the UI must
  surface the confidence rather than the score alone.

---

## Data quality

Scraped exports duplicate constantly. The same company arrives as
"Brennan Heating & Air", "Brennan Heating and Air, Inc." and a bare domain row.
Paying twice to contact one prospect is the visible cost; two reps calling the
same owner in the same week is the worse one.

### Deduplication

Leads are clustered with union-find over four rules, each recording *why* it fired:

| Rule | Confidence | Notes |
|---|---|---|
| Same normalised domain | 0.98 | Strongest signal |
| Same contact email | 0.95 | |
| Same phone **and** similar name | 0.90 | Phone alone is not enough — franchises and answering services share lines |
| Near-identical name in same location | 0.85 | Dice coefficient ≥ 0.85 over character bigrams |

Comparison is **blocked** by domain, phone, email and name-prefix, so cost stays
near-linear instead of quadratic on a large export.

Merging is not deletion. The most complete record survives and its gaps are filled
from the rest, so a cluster yields a record **more complete than any single source row**:

```
DEDUPE: 7 rows -> 5 companies (2 removed)

Merged [1, 2, 3] -> "Brennan Heating & Air"
   domain     (0.98): Same domain (brennanhvac.com)
   phone+name (0.90): Same phone (4195550100) and similar name (0.78)
   recovered: owner=Dale Brennan  rev=$3.2M  staff=24
```

Row 1 had the revenue, row 2 had the owner, row 3 had the headcount. No single
row had all three.

### Email validation

Syntax, disposable-provider and role-account detection, plus an MX lookup to
confirm the domain accepts mail at all. Results are cached for 30 days.

We stop at MX on purpose. SMTP probing of individual mailboxes is intrusive,
widely blocked, and a reliable way to get a sending domain blacklisted.

The grading is tuned for **acquisition outreach specifically**, which differs from
generic B2B sales: a shared `info@` inbox is often the only published address a
30-year-old family business has, so it is downgraded to `risky` rather than
discarded. A named address on the company's own domain rates highest.

```
dr.vance@toledodental.com      VALID    0.90   matches company domain
info@brennanhvac.com           RISKY    0.65   shared inbox, not a named decision-maker
cornerbarbers@gmail.com        RISKY    0.70   consumer mailbox on a business lead
sales@mailinator.com           INVALID  0.00   disposable provider
```

---

## The dashboard

One screen, ranked by default. The board answers "who do I call first" without
the user configuring anything first.

- **Stat tiles** — source rows, companies after dedupe, band-A shortlist, sites enriched
- **Ranked table** — priority bar, band badge, Fit and Upside side by side, a one-line
  signal summary per row, and a `×3` badge where rows were merged
- **Why this score** — click any row for the full per-signal breakdown of both axes,
  the merge provenance, and the email verdict with its reasoning
- **Filters** — search, band, industry, sort, and "contactable only"
- **Import** — drop in a SaaSquatch CSV or any export with a company column; headers are
  matched loosely (`Company`, `Company Name`, `Business` all work) and `"2,600,000"` parses
- **Enrich** — scan the imported companies' sites on demand and re-score
- **Export** — CRM-shaped CSV of the *current filtered view*, not the whole list

Confidence is surfaced next to the score, never hidden: a `*` marks a row whose
Upside is based on partial data, and the drawer explains exactly why.

Bands are deliberately tight. Band A is a shortlist a searcher can work this
week — if most of the list is "call now", the ranking carries no signal.

---

## Setup

```bash
git clone git@github.com:authenticwaleed/SaaSquatch.git
cd SaaSquatch
npm install
cp .env.example .env        # optional — the app runs without it
npm run dev
```

Everything works with no environment configured: the cache falls back to memory. Add
`DATABASE_URL` for persistence and the Upstash pair for a shared cache.

```bash
npm test          # 57 unit tests, no network required
npm run test:watch
npx tsc --noEmit  # typecheck
```

---

## Deployment

Deployed on Vercel serverless. Both API routes declare `runtime = "nodejs"` —
enrichment uses `cheerio` and MX validation uses `node:dns`, neither of which
runs on the edge runtime.

```bash
npm i -g vercel
vercel login
vercel link          # connect this directory to a Vercel project
vercel --prod        # first deploy
```

Or connect the GitHub repo in the Vercel dashboard; pushes to `main` then deploy
automatically and every PR gets a preview URL.

**No environment variables are required.** The app runs on seed data with an
in-memory cache. Add these to upgrade it:

| Variable | Effect if absent |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Cache falls back to an in-process Map |
| `DATABASE_URL` (Neon) | No persistence; state is per-request |
| `OPENAI_API_KEY` | Outreach-angle generation is unavailable |

`/api/enrich` sets `maxDuration = 60` and caps a batch at 60 leads, which keeps it
inside the Vercel function limit on the Hobby plan.

### Verified from a clean clone

`npm ci` → 57 tests → `npm run build` → `npm run start`, in an empty directory
with no `.env`. If any of that breaks for you, it is a bug, not a setup step.

## Project layout

```
src/lib/
  types.ts              Lead, DigitalSignals, ScoreBreakdown
  domain.ts             Domain + company-name normalisation (shared by cache and dedupe)
  scoring/
    config.ts           All weights and thresholds — tune here
    industries.ts       ETA industry fragmentation tiers
    breakdown.ts        Normalises over available weight; tracks confidence
    fit.ts              Acquisition Fit
    upside.ts           AI-Readiness Upside (inverted)
    index.ts            Blend, Fit gate, banding, headline
  dedupe/
    similarity.ts       Dice coefficient over bigrams; phone normalisation
    index.ts            Blocking, union-find clustering, auditable merge
  validation/
    email.ts            Syntax, role, disposable, company-domain match
    mx.ts               Cached MX lookup
  pipeline.ts           Dedupe -> score -> validate, into ranked rows
  csv.ts                CRM-shaped export; tolerant CSV import
  enrichment/
    patterns.ts         Vendor fingerprints
    http.ts             Timeout, byte cap, backoff, declared UA
    robots.ts           RFC 9309 parser and policy check
    signals.ts          Cheerio extraction
    cache.ts            Upstash Redis with in-memory fallback
    index.ts            Orchestration, concurrency cap
app/api/import          Parse an upload, dedupe and score it
app/api/enrich          Scan sites for a batch and re-score
components/             Board, ScoreDrawer, ImportPanel
data/seed.ts            Demo dataset: duplicates, bad emails, a dead domain
tests/                  57 tests covering scoring, enrichment and data-quality invariants
```

## Status

- [x] Scoring engine, explainable, unit-tested
- [x] Enrichment scraper: robots, caching, concurrency, graceful failure
- [x] Deduplication with auditable merge reasons
- [x] Email validation: syntax, role, disposable, MX
- [x] Dashboard: ranked board, filters, score drawer, CRM export
- [x] CSV import with tolerant header mapping, and on-demand enrichment
- [ ] Drizzle schema and persistence (runs on seed data today)
