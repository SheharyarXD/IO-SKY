-- Persistent retry for failed emails (task N03, SRS 17.11, 29 Oct Doc 1 Ch15).
-- NOT applied by this repository. Review, then apply deliberately to a non-production database first.
-- Additive only: one new table and two indexes; no existing table is altered.
CREATE TABLE IF NOT EXISTS "email_outbox" (
  "id" serial PRIMARY KEY,
  "kind" varchar(16) NOT NULL,
  "messageType" "public"."email_message_type" NOT NULL,
  "recipient" varchar(320) NOT NULL,
  "subject" varchar(500),
  "relatedRef" varchar(64),
  "payload" text,
  "status" varchar(16) NOT NULL DEFAULT 'queued',
  "attempts" integer NOT NULL DEFAULT 1,
  "maxAttempts" integer NOT NULL,
  "nextAttemptAt" timestamp,
  "lockedUntil" timestamp,
  "lastError" text,
  "lastErrorClass" varchar(16),
  "abandonReason" varchar(16),
  "escalatedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_due_idx" ON "email_outbox" ("status", "nextAttemptAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_outbox_related_ref_idx" ON "email_outbox" ("relatedRef");
--> statement-breakpoint
-- Same posture as the other application tables: row level security on, no policy for anon/authenticated,
-- so only the server (service role / owner connection) can read or write it.
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;
