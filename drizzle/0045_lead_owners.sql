-- Lead ownership (supports C01 owner filter). NOT applied by this repository.
-- Additive only: one new table, the leads table is NOT altered (so no code that selects every lead column can
-- break before this is applied). Until it is applied, leads simply show as unowned and assigning an owner
-- returns an error. Independent of 0037 to 0044.
CREATE TABLE IF NOT EXISTS "lead_owners" (
  "id" serial PRIMARY KEY,
  "leadId" integer NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "ownerUserId" integer NOT NULL REFERENCES "users"("id"),
  "assignedByUserId" integer REFERENCES "users"("id"),
  "assignedAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- One owner per lead.
CREATE UNIQUE INDEX IF NOT EXISTS "lead_owners_lead_unique_idx" ON "lead_owners" ("leadId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_owners_owner_idx" ON "lead_owners" ("ownerUserId");
--> statement-breakpoint
ALTER TABLE "lead_owners" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "lead_owners" FORCE ROW LEVEL SECURITY;
