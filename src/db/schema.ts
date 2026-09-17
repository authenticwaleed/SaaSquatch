import {
  index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid,
} from "drizzle-orm/pg-core";
import type { DigitalSignals, Lead, LeadScore } from "@/lib/types";
import type { EmailVerdict } from "@/lib/validation/email";
import type { MatchReason } from "@/lib/dedupe";
import type { PipelineSummary } from "@/lib/pipeline";

/**
 * One scoring run: an imported list, deduped and scored.
 *
 * Runs are immutable snapshots. Re-scoring an imported list after enrichment
 * creates a new run rather than mutating the old one, so a searcher can see how
 * a list changed once the sites were actually scanned.
 */
export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  source: text("source", { enum: ["demo", "import", "enrich"] }).notNull(),
  summary: jsonb("summary").$type<PipelineSummary>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A scored company within a run.
 *
 * The computed score, email verdict and signals are stored as JSONB rather than
 * normalised into columns: the scoring rubric is expected to change, and a
 * schema migration per weight change would be the wrong trade. Priority and band
 * are lifted into real columns because those are what we sort and filter on.
 */
export const leadRows = pgTable(
  "lead_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    domain: text("domain"),
    priority: integer("priority").notNull(),
    band: text("band", { enum: ["A", "B", "C", "D"] }).notNull(),
    lead: jsonb("lead").$type<Lead>().notNull(),
    score: jsonb("score").$type<LeadScore>().notNull(),
    email: jsonb("email").$type<EmailVerdict>().notNull(),
    signals: jsonb("signals").$type<DigitalSignals | null>(),
    mergedFrom: jsonb("merged_from").$type<string[]>().notNull(),
    mergeReasons: jsonb("merge_reasons").$type<MatchReason[]>().notNull(),
  },
  (t) => [
    index("lead_rows_run_priority_idx").on(t.runId, t.priority),
    index("lead_rows_band_idx").on(t.runId, t.band),
  ],
);

/**
 * Durable enrichment cache, keyed by normalised domain.
 *
 * Redis is the hot path; this is the floor beneath it. A Redis eviction or a
 * cold deploy would otherwise mean re-scanning every site we have already
 * politely fetched once — the opposite of being a good crawler citizen.
 */
export const siteSignals = pgTable(
  "site_signals",
  {
    domain: text("domain").notNull(),
    signals: jsonb("signals").$type<DigitalSignals>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.domain] })],
);

export type RunRecord = typeof runs.$inferSelect;
export type LeadRowRecord = typeof leadRows.$inferSelect;
