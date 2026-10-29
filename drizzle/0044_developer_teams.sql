-- Developer teams (task J03). NOT applied by this repository.
-- Additive only: two new tables, no existing table is altered, so the code can be deployed before or after
-- this migration. Until it is applied the team endpoints return an error and nothing else is affected.
-- Independent of 0037 to 0043.
CREATE TABLE IF NOT EXISTS "developer_teams" (
  "id" serial PRIMARY KEY,
  "name" varchar(80) NOT NULL,
  "description" varchar(500),
  "status" varchar(10) NOT NULL DEFAULT 'active',
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "developer_teams_status_check" CHECK ("status" IN ('active','archived'))
);
--> statement-breakpoint
-- Names are unique ignoring case among teams that are not archived.
CREATE UNIQUE INDEX IF NOT EXISTS "developer_teams_name_unique_idx" ON "developer_teams" (lower("name")) WHERE "status" = 'active';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "developer_team_members" (
  "id" serial PRIMARY KEY,
  "teamId" integer NOT NULL REFERENCES "developer_teams"("id") ON DELETE CASCADE,
  "developerId" integer NOT NULL REFERENCES "developer_profiles"("id") ON DELETE CASCADE,
  "role" varchar(10) NOT NULL DEFAULT 'member',
  "primaryContact" boolean NOT NULL DEFAULT false,
  "status" varchar(10) NOT NULL DEFAULT 'active',
  "addedByUserId" integer REFERENCES "users"("id"),
  "joinedAt" timestamp NOT NULL DEFAULT now(),
  "removedAt" timestamp,
  CONSTRAINT "developer_team_members_role_check" CHECK ("role" IN ('lead','member','reviewer')),
  CONSTRAINT "developer_team_members_status_check" CHECK ("status" IN ('active','removed'))
);
--> statement-breakpoint
-- A developer holds at most one ACTIVE seat per team, and a team has at most one ACTIVE primary contact.
CREATE UNIQUE INDEX IF NOT EXISTS "developer_team_members_active_unique_idx" ON "developer_team_members" ("teamId", "developerId") WHERE "status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "developer_team_members_primary_unique_idx" ON "developer_team_members" ("teamId") WHERE "status" = 'active' AND "primaryContact" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "developer_team_members_developer_idx" ON "developer_team_members" ("developerId", "status");
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['developer_teams','developer_team_members'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
