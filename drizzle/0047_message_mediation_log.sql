-- Mediated messaging log (task J07). NOT applied by this repository.
-- Additive only: one new table. Relays and broadcasts are refused until it exists (they will not run without
-- a record); all existing messaging is unaffected. Independent of 0037 to 0046.
CREATE TABLE IF NOT EXISTS "message_mediation_log" (
  "id" serial PRIMARY KEY,
  "kind" varchar(24) NOT NULL,
  "sourceMessageId" integer,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  "developerId" integer REFERENCES "developer_profiles"("id") ON DELETE SET NULL,
  "audienceType" varchar(16),
  "audienceRef" integer,
  "recipientCount" integer NOT NULL DEFAULT 1,
  "actorUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "message_mediation_log_kind_check" CHECK ("kind" IN ('developer_to_client','client_to_developer','broadcast'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_mediation_log_org_idx" ON "message_mediation_log" ("organizationId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_mediation_log_dev_idx" ON "message_mediation_log" ("developerId", "createdAt");
--> statement-breakpoint
ALTER TABLE "message_mediation_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "message_mediation_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "message_mediation_log";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "message_mediation_log" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
