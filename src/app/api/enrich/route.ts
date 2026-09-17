import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichBatch } from "@/lib/enrichment";
import { runPipeline } from "@/lib/pipeline";
import { saveRun } from "@/db/repository";
import type { DigitalSignals, Lead } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Bounded so one import cannot hold a serverless invocation open indefinitely. */
const MAX_LEADS = 60;

const LeadSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  domain: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  revenueUsd: z.number().nullable(),
  employeeCount: z.number().nullable(),
  ownerName: z.string().nullable(),
  ownerTitle: z.string().nullable(),
  yearFounded: z.number().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
});

const Body = z.object({ leads: z.array(LeadSchema).min(1).max(MAX_LEADS) });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Send between 1 and ${MAX_LEADS} leads to enrich` },
      { status: 400 },
    );
  }

  const leads = parsed.data.leads as Lead[];
  const results = await enrichBatch(leads, { concurrency: 5 });

  const signals: Record<string, DigitalSignals | null> = {};
  for (const r of results) signals[r.leadId] = r.signals;

  // Re-run the pipeline so scores, bands and ordering reflect the new signals.
  const { rows, summary } = await runPipeline(leads, signals, { checkMx: false });
  const runId = await saveRun(rows, summary, "enrich", `Enriched ${leads.length} companies`);
  return NextResponse.json({
    runId,
    rows,
    summary,
    enrichment: results.map((r) => ({ leadId: r.leadId, status: r.status, note: r.note })),
  });
}
