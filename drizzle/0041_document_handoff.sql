-- Controlled document handoff (tasks J09 and J10). NOT applied by this repository.
-- Additive only: four new tables, no existing table is altered, so the code that uses them can be deployed
-- before or after this migration without breaking anything else; until it is applied the handoff endpoints
-- fail closed (no document is ever released or visible to a developer) rather than open.
-- Independent of 0037 to 0040.
CREATE TABLE IF NOT EXISTS "project_documents" (
  "id" serial PRIMARY KEY,
  "documentId" integer NOT NULL REFERENCES "client_documents"("id") ON DELETE CASCADE,
  "clientProjectId" integer NOT NULL REFERENCES "client_projects"("id") ON DELETE CASCADE,
  "associatedByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_documents_unique_idx" ON "project_documents" ("documentId", "clientProjectId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_documents_project_idx" ON "project_documents" ("clientProjectId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "developer_project_links" (
  "id" serial PRIMARY KEY,
  "developerProjectId" integer NOT NULL REFERENCES "developer_projects"("id") ON DELETE CASCADE,
  "clientProjectId" integer NOT NULL REFERENCES "client_projects"("id") ON DELETE CASCADE,
  "linkedByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "developer_project_links_unique_idx" ON "developer_project_links" ("developerProjectId", "clientProjectId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_releases" (
  "id" serial PRIMARY KEY,
  "documentId" integer NOT NULL REFERENCES "client_documents"("id") ON DELETE CASCADE,
  "developerProjectId" integer NOT NULL REFERENCES "developer_projects"("id") ON DELETE CASCADE,
  "status" varchar(12) NOT NULL DEFAULT 'released',
  "releasedByUserId" integer REFERENCES "users"("id"),
  "note" varchar(500),
  "releasedAt" timestamp NOT NULL DEFAULT now(),
  "revokedByUserId" integer REFERENCES "users"("id"),
  "revokedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_releases_project_idx" ON "document_releases" ("developerProjectId", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_releases_document_idx" ON "document_releases" ("documentId");
--> statement-breakpoint
-- At most one ACTIVE release of a document into a developer project; a revoked one may be released again later.
CREATE UNIQUE INDEX IF NOT EXISTS "document_releases_active_unique_idx" ON "document_releases" ("documentId", "developerProjectId") WHERE "status" = 'released';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_release_events" (
  "id" serial PRIMARY KEY,
  "documentId" integer NOT NULL REFERENCES "client_documents"("id") ON DELETE CASCADE,
  "developerProjectId" integer NOT NULL REFERENCES "developer_projects"("id") ON DELETE CASCADE,
  "event" varchar(16) NOT NULL,
  "actorUserId" integer REFERENCES "users"("id"),
  "note" varchar(500),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_release_events_document_idx" ON "document_release_events" ("documentId", "createdAt");
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['project_documents','developer_project_links','document_releases','document_release_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS audit_append_only ON "document_release_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "document_release_events" FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
