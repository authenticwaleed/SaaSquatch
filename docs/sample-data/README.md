# Demo CSVs

Two sample exports for demonstrating SaaSquatch Signal. Both are **entirely synthetic** —
invented companies, `555-` placeholder numbers, no real business data.

Import either at **https://illustrious-semifreddo-6b7cbc.netlify.app** → **Import CSV**.

---

## `sample-1-ohio-home-services.csv` — 12 rows → 10 companies

SaaSquatch-style headers. Best file for showing **deduplication**.

**What to point at:**

| Row | Shows |
|---|---|
| **Halloran Heating & Cooling `×2`** | Merged on **same domain** (0.98). Row 2 was a bare duplicate — the merge recovered owner, revenue and headcount from row 1 |
| **Steelcore Fabrication `×2`** | Merged on **phone + name** (0.90). Note the app will *not* merge on phone alone — franchises share lines |
| **Quickpost Marketing** | Email `INVALID` — disposable provider (`mailinator.com`) |
| **Prairie Lawn** | Email `RISKY` — shared `info@` inbox, reaches the business but not a named decision-maker |
| **Copper Kettle Catering** | Email `RISKY` — consumer mailbox on a business lead. No website either |
| **Vertex AI Systems** | Band **D** — venture-shaped, founded 2023, no succession event |

Expected: **bands A:7 · C:1 · D:2**, 2 duplicates merged.

---

## `sample-2-indiana-mixed.csv` — 12 rows → 11 companies

**Deliberately different headers** (`Business`, `URL`, `Category`, `Town`, `Region`,
`Headcount`, `Telephone`) and revenue written as `"$6,800,000"`. Best file for showing the
**tolerant import** and the **scoring spread**.

**What to point at:**

| Row | Shows |
|---|---|
| Headers | Nothing matches file 1, yet everything maps. `"$6,800,000"` parses to a number |
| **Score spread** | 100 → 40 across all four bands, with no two tiers looking alike |
| **Gilman Industrial Supply** | Fit confidence **0.65** vs 0.8 elsewhere — no owner on file, so the engine reports lower confidence instead of guessing |
| **Summit Facilities Group** | Uses `example.com`, a genuinely reachable domain. **The only row that will truly enrich** if you click "Enrich sites" |
| **Nimbus Growth Labs** | Band **D** — founded 2024, venture-shaped |

Expected: **bands A:7 · B:1 · C:1 · D:2**, 1 duplicate merged.

---

## Demoing enrichment

After importing, an **"Enrich sites"** button appears (it is hidden on the bundled demo data,
which ships pre-enriched — that is correct, not a bug).

Because these domains are invented, most rows will come back **`website unreachable`** → Upside
70 at **confidence 0.5**. That is a legitimate, designed state, and worth narrating rather than
hiding: *"the site didn't respond, so it's flagged at reduced confidence instead of being scored
as if we'd checked it."*

`Summit Facilities Group` (`example.com`) is the row that genuinely resolves, so it is the clean
contrast.

**For video:** enrichment makes a live network call. Import and enrich once before recording so
the function is warm.
