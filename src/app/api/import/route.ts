import { NextResponse } from "next/server";
import { z } from "zod";
import { fromCsv } from "@/lib/csv";
import { runPipeline } from "@/lib/pipeline";

export const runtime = "nodejs";

const Body = z.object({
  csv: z.string().min(1, "CSV is empty").max(2_000_000, "File too large (2 MB limit)"),
});

/**
 * Parse an uploaded export and run it through dedupe + scoring.
 *
 * Enrichment is deliberately a separate call: parsing is instant and should not
 * be held hostage to a few hundred outbound HTTP requests. The user sees a
 * ranked board immediately, then opts into enrichment.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body was not valid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const leads = fromCsv(parsed.data.csv);
  if (leads.length === 0) {
    return NextResponse.json(
      { error: "No rows found. The file needs a header row including at least a company name." },
      { status: 422 },
    );
  }

  const { rows, summary } = await runPipeline(leads, {}, { checkMx: false });
  return NextResponse.json({ rows, summary });
}
