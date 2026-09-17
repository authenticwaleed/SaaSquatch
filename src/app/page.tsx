import { Board } from "@/components/Board";
import { SEED_LEADS, SEED_SIGNALS } from "@/data/seed";
import { runPipeline } from "@/lib/pipeline";
import { loadLatestRun } from "@/db/repository";

export const dynamic = "force-dynamic";

export default async function Page() {
  // With a database configured, pick up where the user left off. Without one,
  // fall back to the bundled demo dataset so the app is useful out of the box.
  const saved = await loadLatestRun();
  if (saved && saved.rows.length > 0) {
    return <Board rows={saved.rows} summary={saved.summary} />;
  }

  // MX lookups are skipped for the demo dataset: its domains are illustrative,
  // and a live board should not block on DNS for rows the user can already act on.
  const { rows, summary } = await runPipeline(SEED_LEADS, SEED_SIGNALS, { checkMx: false });
  return <Board rows={rows} summary={summary} />;
}
