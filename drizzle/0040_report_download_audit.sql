-- AI Scan report download audit (task M4-01, SRS 9.10 "Log all report downloads"). NOT applied by this repository.
-- Additive only: one new table. Independent of 0037 to 0039. The code that writes to it is best effort and a no-op
-- (logged once) while the table does not exist, so it may be deployed before or after this migration.
-- Append only, like the other audit tables (audit_is_append_only, migration 0023): UPDATE and a direct DELETE are refused.
-- A cascade from the parent scan is allowed, so deleting a scan under a privacy erasure request removes its rows.
-- Holds no report content and never the access token (only a short hash prefix). Retention: nothing deletes these rows
-- automatically; a retention job can key on createdAt and must run through the same privacy-erasure path.
CREATE TABLE IF NOT EXISTS "report_download_audit" (
  "id" serial PRIMARY KEY,
  "scanId" integer NOT NULL REFERENCES "ai_scans"("id") ON DELETE CASCADE,
  "action" varchar(16) NOT NULL,
  "outcome" varchar(8) NOT NULL,
  "denyReason" varchar(24),
  "actorKind" varchar(16) NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "actorRole" varchar(32),
  "organizationId" integer,
  "tokenFingerprint" varchar(16),
  "reportStatus" varchar(32),
  "reportPublishedAt" timestamp,
  "tier" varchar(16),
  "ip" varchar(64),
  "userAgent" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_download_audit_scan_idx" ON "report_download_audit" ("scanId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_download_audit_actor_idx" ON "report_download_audit" ("actorUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_download_audit_created_idx" ON "report_download_audit" ("createdAt");
--> statement-breakpoint
ALTER TABLE "report_download_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "report_download_audit" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "report_download_audit";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "report_download_audit" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
