import { Board } from "@/components/Board";
import { SEED_LEADS, SEED_SIGNALS } from "@/data/seed";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function Page() {
  // MX lookups are skipped for the demo dataset: its domains are illustrative,
  // and a live board should not block on DNS for rows the user can already act on.
  const { rows, summary } = await runPipeline(SEED_LEADS, SEED_SIGNALS, { checkMx: false });
  return <Board rows={rows} summary={summary} />;
}
