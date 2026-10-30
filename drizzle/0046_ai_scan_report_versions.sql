-- AI Scan report versions (task P06, BR-017). NOT applied by this repository.
-- Additive only: one new table. The engine records each version it produces; until this is applied the
-- recording is skipped (best effort, logged) and the version list is empty. Reports, review and publication
-- are unaffected. Independent of 0037 to 0045.
CREATE TABLE IF NOT EXISTS "ai_scan_report_versions" (
  "id" serial PRIMARY KEY,
  "scanId" integer NOT NULL REFERENCES "ai_scans"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "payload" text NOT NULL,
  "overallScore" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_scan_report_versions_unique_idx" ON "ai_scan_report_versions" ("scanId", "version");
--> statement-breakpoint
ALTER TABLE "ai_scan_report_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_scan_report_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- A kept version is evidence: it is never changed or removed (deleting the scan removes its versions with it).
DROP TRIGGER IF EXISTS audit_append_only ON "ai_scan_report_versions";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "ai_scan_report_versions" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
