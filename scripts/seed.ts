/**
 * Load the demo dataset into a configured database as a scoring run.
 *
 *   DATABASE_URL=... npm run seed
 *
 * Useful for demoing persistence without importing a CSV first. Exits with a
 * clear message rather than a stack trace when no database is configured.
 */
import { SEED_LEADS, SEED_SIGNALS } from "../src/data/seed";
import { runPipeline } from "../src/lib/pipeline";
import { saveRun } from "../src/db/repository";
import { isPersistenceEnabled } from "../src/db";

async function main() {
  if (!isPersistenceEnabled()) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    console.error("The app runs fine without it; persistence is optional.");
    process.exit(1);
  }

  const { rows, summary } = await runPipeline(SEED_LEADS, SEED_SIGNALS, { checkMx: false });
  const runId = await saveRun(rows, summary, "demo", "Demo dataset");

  if (!runId) {
    console.error("Seed failed — see the error above.");
    process.exit(1);
  }

  console.log(`Seeded run ${runId}`);
  console.log(`  ${summary.inputRows} source rows -> ${summary.companies} companies`);
  console.log(`  bands: ${Object.entries(summary.bandCounts).map(([b, n]) => `${b}:${n}`).join("  ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
