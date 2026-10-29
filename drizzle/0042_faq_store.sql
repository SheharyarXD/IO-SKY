-- Approved FAQ store (task R17). NOT applied by this repository.
-- Additive only: two new tables, nothing existing is altered. Until it is applied the FAQ source reports
-- "unavailable" to agents (they say they do not have that information) and the admin FAQ endpoints return an
-- error; no other feature depends on it. Independent of 0037 to 0041.
CREATE TABLE IF NOT EXISTS "faq_entries" (
  "id" serial PRIMARY KEY,
  "question" varchar(300) NOT NULL,
  "answer" varchar(2000) NOT NULL,
  "keywords" text NOT NULL DEFAULT '[]',
  "audience" varchar(10) NOT NULL DEFAULT 'public',
  "status" varchar(12) NOT NULL DEFAULT 'draft',
  "version" integer NOT NULL DEFAULT 1,
  "lastEditedByUserId" integer REFERENCES "users"("id"),
  "approvedByUserId" integer REFERENCES "users"("id"),
  "approvedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "faq_entries_status_check" CHECK ("status" IN ('draft','in_review','approved','retired')),
  CONSTRAINT "faq_entries_audience_check" CHECK ("audience" IN ('public','client'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faq_entries_status_idx" ON "faq_entries" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faq_events" (
  "id" serial PRIMARY KEY,
  "faqId" integer NOT NULL REFERENCES "faq_entries"("id") ON DELETE CASCADE,
  "event" varchar(40) NOT NULL,
  "version" integer NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faq_events_faq_idx" ON "faq_events" ("faqId", "createdAt");
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['faq_entries','faq_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "faq_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "faq_events" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
