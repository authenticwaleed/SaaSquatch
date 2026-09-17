"use client";

import { useMemo, useState } from "react";
import type { LeadRow, PipelineSummary } from "@/lib/pipeline";
import { toCsv } from "@/lib/csv";
import { ScoreDrawer } from "./ScoreDrawer";
import { ImportPanel } from "./ImportPanel";

type SortKey = "priority" | "fit" | "upside" | "company";
type BandFilter = "all" | "A" | "B" | "C" | "D";

const money = (n: number | null) =>
  n == null ? "—" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-[var(--surface)] px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className="tnum mt-1 text-[24px] font-semibold leading-none">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</div>}
    </div>
  );
}

export function Board({
  rows: initialRows,
  summary: initialSummary,
}: {
  rows: LeadRow[];
  summary: PipelineSummary;
}) {
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);
  const [source, setSource] = useState<"demo" | "import">("demo");
  const [importOpen, setImportOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<BandFilter>("all");
  const [industry, setIndustry] = useState("all");
  const [contactable, setContactable] = useState(false);
  const [sort, setSort] = useState<SortKey>("priority");
  const [selected, setSelected] = useState<LeadRow | null>(null);

  const industries = useMemo(
    () => [...new Set(rows.map((r) => r.lead.industry).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (band !== "all" && r.score.band !== band) return false;
      if (industry !== "all" && r.lead.industry !== industry) return false;
      if (contactable && r.email.status === "invalid") return false;
      if (!q) return true;
      return [r.lead.companyName, r.lead.industry, r.lead.city, r.lead.ownerName, r.lead.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });

    return out.sort((a, b) => {
      if (sort === "company") return a.lead.companyName.localeCompare(b.lead.companyName);
      if (sort === "fit") return b.score.fit.score - a.score.fit.score;
      if (sort === "upside") return b.score.upside.score - a.score.upside.score;
      return b.score.priority - a.score.priority || b.score.fit.score - a.score.fit.score;
    });
  }, [rows, query, band, industry, contactable, sort]);

  const unenriched = rows.filter((r) => r.signals == null).length;

  /**
   * Scan the imported companies' websites and re-score. Bounded server-side; we
   * surface the count rather than a spinner alone so a slow batch is explainable.
   */
  async function enrichAll() {
    setEnriching(true);
    setNotice(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leads: rows.slice(0, 60).map((r) => r.lead) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error ?? "Enrichment failed.");
        return;
      }
      setRows(data.rows);
      setSummary(data.summary);
      const reached = data.enrichment.filter(
        (e: { status: string }) => e.status === "fetched" || e.status === "cached",
      ).length;
      setNotice(`Scanned ${data.enrichment.length} sites — ${reached} reachable. Scores updated.`);
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setEnriching(false);
    }
  }

  function resetToDemo() {
    setRows(initialRows);
    setSummary(initialSummary);
    setSource("demo");
    setNotice(null);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saasquatch-signal-${filtered.length}-leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const control =
    "rounded-md border bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]";

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight">SaaSquatch Signal</h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-snug text-[var(--text-muted)]">
            SaaSquatch finds companies. Signal ranks them by how buyable they are — and how much
            is left to unlock after the deal closes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {source === "import" && (
            <button
              onClick={resetToDemo}
              className="rounded-md border px-3 py-2 text-[12.5px] hover:bg-[var(--surface-2)]"
            >
              Back to demo
            </button>
          )}
          {unenriched > 0 && (
            <button
              onClick={enrichAll}
              disabled={enriching}
              className="rounded-md border px-3 py-2 text-[12.5px] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
              title="Scan each company's website for digital-maturity signals"
            >
              {enriching ? "Scanning sites…" : `Enrich ${Math.min(unenriched, 60)} sites`}
            </button>
          )}
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-md border px-3 py-2 text-[12.5px] hover:bg-[var(--surface-2)]"
          >
            Import CSV
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-[var(--accent)] px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:opacity-90"
          >
            Export {filtered.length} to CRM
          </button>
        </div>
      </header>

      {notice && (
        <p className="mb-4 rounded-md border bg-[var(--surface)] px-3.5 py-2.5 text-[12px] text-[var(--text-muted)]">
          {notice}
        </p>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Source rows" value={summary.inputRows} hint={`${summary.duplicatesRemoved} duplicates merged`} />
        <StatTile label="Companies" value={summary.companies} hint="after dedupe" />
        <StatTile
          label="Priority A"
          value={summary.bandCounts.A}
          hint={`${summary.bandCounts.B} in band B`}
        />
        <StatTile label="Enriched" value={summary.enriched} hint="sites scanned" />
      </section>

      <section className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, owner, city…"
          className={`${control} min-w-[200px] flex-1`}
          aria-label="Search leads"
        />
        <select value={band} onChange={(e) => setBand(e.target.value as BandFilter)} className={control} aria-label="Filter by band">
          <option value="all">All bands</option>
          {(["A", "B", "C", "D"] as const).map((b) => (
            <option key={b} value={b}>Band {b}</option>
          ))}
        </select>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={control} aria-label="Filter by industry">
          <option value="all">All industries</option>
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={control} aria-label="Sort by">
          <option value="priority">Sort: Priority</option>
          <option value="fit">Sort: Fit</option>
          <option value="upside">Sort: Upside</option>
          <option value="company">Sort: Company</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12.5px]">
          <input type="checkbox" checked={contactable} onChange={(e) => setContactable(e.target.checked)} />
          Contactable only
        </label>
      </section>

      <div className="overflow-hidden rounded-lg border bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-[var(--surface-2)] text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">
                <th className="w-10 px-3 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="w-[92px] px-3 py-2.5 text-right font-medium">Priority</th>
                <th className="w-[62px] px-3 py-2.5 text-right font-medium">Fit</th>
                <th className="w-[72px] px-3 py-2.5 text-right font-medium">Upside</th>
                <th className="w-[92px] px-3 py-2.5 text-right font-medium">Revenue</th>
                <th className="w-[84px] px-3 py-2.5 font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr
                  key={row.lead.id}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="tnum px-3 py-2.5 text-[12px] text-[var(--text-faint)]">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{row.lead.companyName}</span>
                      {row.mergedFrom.length > 1 && (
                        <span
                          className="shrink-0 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]"
                          title={`Merged from ${row.mergedFrom.length} source rows`}
                        >
                          ×{row.mergedFrom.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
                      {row.score.headline}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1 w-10 overflow-hidden rounded-full bg-[var(--surface-2)] sm:block">
                        <div className={`bar-${row.score.band} h-full rounded-full`} style={{ width: `${row.score.priority}%` }} />
                      </div>
                      <span className="tnum text-[13px] font-semibold">{row.score.priority}</span>
                      <span className={`band-${row.score.band} rounded px-1.5 py-0.5 text-[10px] font-bold`}>
                        {row.score.band}
                      </span>
                    </div>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[12.5px] text-[var(--text-muted)]">
                    {row.score.fit.score}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[12.5px] text-[var(--text-muted)]">
                    {row.score.upside.score}
                    {row.score.upside.confidence < 1 && (
                      <span className="ml-0.5 text-[var(--warn)]" title="Reduced confidence">*</span>
                    )}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[12.5px] text-[var(--text-muted)]">
                    {money(row.lead.revenueUsd)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className="text-[11px] font-semibold uppercase"
                      style={{
                        color:
                          row.email.status === "valid"
                            ? "var(--ok)"
                            : row.email.status === "invalid"
                              ? "var(--bad)"
                              : "var(--warn)",
                      }}
                    >
                      {row.email.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-14 text-center">
            <p className="text-[13px] font-medium">No leads match these filters</p>
            <button
              onClick={() => {
                setQuery("");
                setBand("all");
                setIndustry("all");
                setContactable(false);
              }}
              className="mt-2 text-[12.5px] text-[var(--accent)] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-[var(--text-muted)]">
        Click any row for the full score breakdown. <span className="text-[var(--warn)]">*</span> marks
        reduced confidence — a site that could not be scanned, or signals that did not apply to the industry.
      </p>

      <ScoreDrawer row={selected} onClose={() => setSelected(null)} />
      {importOpen && (
        <ImportPanel
          onClose={() => setImportOpen(false)}
          onLoaded={(newRows, newSummary, newSource) => {
            setRows(newRows);
            setSummary(newSummary);
            setSource(newSource);
            setSelected(null);
            setNotice(
              `Imported ${newSummary.inputRows} rows into ${newSummary.companies} companies. ` +
                `Upside is unscored until you enrich — click "Enrich sites".`,
            );
          }}
        />
      )}
    </div>
  );
}
