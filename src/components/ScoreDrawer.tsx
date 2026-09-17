"use client";

import type { LeadRow } from "@/lib/pipeline";
import type { ScoreBreakdown } from "@/lib/types";

const money = (n: number | null) =>
  n == null ? "—" : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;

function ContributionList({ breakdown, tone }: { breakdown: ScoreBreakdown; tone: "fit" | "upside" }) {
  return (
    <ul className="space-y-2.5">
      {breakdown.contributions.map((c) => {
        const pct = c.weight ? (c.earned / c.weight) * 100 : 0;
        const unknown = c.earned === 0 && c.direction === "neutral";
        return (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[13px] font-medium ${unknown ? "text-[var(--text-faint)]" : ""}`}>
                {c.label}
              </span>
              <span className="tnum text-[11px] text-[var(--text-muted)] shrink-0">
                {unknown ? "no data" : `${c.earned}/${c.weight}`}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(pct, unknown ? 0 : 2)}%`,
                  background: unknown
                    ? "var(--border-strong)"
                    : tone === "fit"
                      ? "var(--band-b)"
                      : "var(--band-c)",
                }}
              />
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">{c.detail}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function ScoreDrawer({ row, onClose }: { row: LeadRow | null; onClose: () => void }) {
  if (!row) return null;
  const { lead, score, email, signals, mergedFrom, mergeReasons } = row;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="drawer fixed right-0 top-0 z-50 h-full w-full max-w-[460px] overflow-y-auto border-l bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-label={`Score breakdown for ${lead.companyName}`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-[var(--surface)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold">{lead.companyName}</h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
              {[lead.industry, [lead.city, lead.state].filter(Boolean).join(", ")]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="space-y-6 px-5 py-5">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              ["Priority", score.priority, score.band],
              ["Fit", score.fit.score, null],
              ["Upside", score.upside.score, null],
            ].map(([label, value, band]) => (
              <div key={String(label)} className="rounded-lg border bg-[var(--surface-2)] px-3 py-2.5">
                <div className="text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
                <div className="tnum mt-0.5 flex items-baseline gap-1.5 text-[22px] font-semibold leading-none">
                  {value}
                  {band ? (
                    <span className={`band-${band} rounded px-1.5 py-0.5 text-[10px] font-bold`}>{band}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            {[
              ["Revenue", money(lead.revenueUsd)],
              ["Employees", lead.employeeCount ?? "—"],
              ["Founded", lead.yearFounded ?? "—"],
              ["Owner", lead.ownerName ?? "—"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-2 border-b pb-1.5">
                <dt className="text-[var(--text-muted)]">{k}</dt>
                <dd className="tnum truncate font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {mergedFrom.length > 1 && (
            <section className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-3.5 py-3">
              <h3 className="text-[12px] font-semibold">
                Merged from {mergedFrom.length} source rows
              </h3>
              <ul className="mt-1.5 space-y-1">
                {mergeReasons.map((r, i) => (
                  <li key={i} className="text-[11.5px] leading-snug text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">{r.rule}</span> ({r.confidence}) —{" "}
                    {r.detail}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                Rows {mergedFrom.join(", ")} folded into one record. Fields missing from the primary row
                were filled from the others.
              </p>
            </section>
          )}

          <section>
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 className="text-[12.5px] font-semibold">Acquisition Fit</h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                confidence {Math.round(score.fit.confidence * 100)}%
              </span>
            </div>
            <ContributionList breakdown={score.fit} tone="fit" />
          </section>

          <section>
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-[12.5px] font-semibold">AI-Readiness Upside</h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                confidence {Math.round(score.upside.confidence * 100)}%
              </span>
            </div>
            <p className="mb-2.5 text-[11px] leading-snug text-[var(--text-muted)]">
              Points are earned for what the business is <em>missing</em>. Gaps here are the value a
              buyer creates after closing.
            </p>
            <ContributionList breakdown={score.upside} tone="upside" />
            {score.upside.confidence < 1 && (
              <p className="mt-2.5 rounded-md bg-[var(--surface-2)] px-2.5 py-2 text-[11px] leading-snug text-[var(--text-muted)]">
                {signals == null
                  ? "Not enriched — this company was never scanned, or its robots.txt declined. Upside is unscored rather than guessed."
                  : signals.reachable === false
                    ? "Website did not respond. Treated as a neglect signal at reduced confidence — verify before outreach."
                    : "Some signals did not apply to this industry and were excluded from the score."}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-[12.5px] font-semibold">Contact quality</h3>
            <div className="rounded-lg border bg-[var(--surface-2)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium">{lead.email ?? "No email on file"}</span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    color:
                      email.status === "valid"
                        ? "var(--ok)"
                        : email.status === "invalid"
                          ? "var(--bad)"
                          : "var(--warn)",
                  }}
                >
                  {email.status}
                </span>
              </div>
              {email.reasons.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {email.reasons.map((r, i) => (
                    <li key={i} className="text-[11.5px] leading-snug text-[var(--text-muted)]">
                      • {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
