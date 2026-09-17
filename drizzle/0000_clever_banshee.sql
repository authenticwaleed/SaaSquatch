CREATE TABLE "lead_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"domain" text,
	"priority" integer NOT NULL,
	"band" text NOT NULL,
	"lead" jsonb NOT NULL,
	"score" jsonb NOT NULL,
	"email" jsonb NOT NULL,
	"signals" jsonb,
	"merged_from" jsonb NOT NULL,
	"merge_reasons" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_signals" (
	"domain" text NOT NULL,
	"signals" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_signals_domain_pk" PRIMARY KEY("domain")
);
--> statement-breakpoint
ALTER TABLE "lead_rows" ADD CONSTRAINT "lead_rows_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_rows_run_priority_idx" ON "lead_rows" USING btree ("run_id","priority");--> statement-breakpoint
CREATE INDEX "lead_rows_band_idx" ON "lead_rows" USING btree ("run_id","band");