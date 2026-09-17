"use client";

import { useRef, useState } from "react";
import type { LeadRow, PipelineSummary } from "@/lib/pipeline";

interface Props {
  onLoaded: (rows: LeadRow[], summary: PipelineSummary, source: "import") => void;
  onClose: () => void;
}

const SAMPLE = `Company,Website,Industry,City,State,Revenue,Employees,Owner,Title,Founded,Email,Phone
Ace Overhead Doors,aceoverheaddoors.com,Garage Doors,Fort Wayne,IN,2600000,18,Ken Ambrose,Owner,1993,ken@aceoverheaddoors.com,260-555-0110
Ace Overhead Door Co.,www.aceoverheaddoors.com,Garage Doors,Fort Wayne,IN,,,,,,,260-555-0110`;

export function ImportPanel({ onLoaded, onClose }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(csv: string) {
    if (!csv.trim()) {
      setError("Paste a CSV or choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }
      onLoaded(data.rows, data.summary, "import");
      onClose();
    } catch {
      setError("Could not reach the server. Is it still running?");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await submit(await file.text());
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Import leads"
        className="drawer fixed left-1/2 top-1/2 z-50 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-[var(--surface)] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Import a lead export</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              Drop in a SaaSquatch CSV, or any export with a company column. Headers are matched
              loosely — <code className="text-[11px]">Company</code>,{" "}
              <code className="text-[11px]">Company Name</code> and{" "}
              <code className="text-[11px]">Business</code> all work.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-[var(--text-muted)] hover:bg-[var(--surface-2)]" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full rounded-lg border border-dashed py-6 text-[12.5px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            Choose a CSV file
          </button>

          <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
            <span className="h-px flex-1 bg-[var(--border)]" /> or paste <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="Company,Website,Industry,City,State,Revenue,…"
            className="w-full resize-y rounded-md border bg-[var(--surface-2)] px-3 py-2 font-mono text-[11.5px] outline-none focus:border-[var(--accent)]"
          />

          <button onClick={() => setText(SAMPLE)} className="text-[11.5px] text-[var(--accent)] hover:underline">
            Use a sample with a duplicate row
          </button>

          {error && (
            <p className="rounded-md px-3 py-2 text-[12px]" style={{ color: "var(--bad)", background: "var(--surface-2)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="rounded-md border px-3 py-2 text-[12.5px] hover:bg-[var(--surface-2)]">
              Cancel
            </button>
            <button
              onClick={() => submit(text)}
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Scoring…" : "Import and score"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
