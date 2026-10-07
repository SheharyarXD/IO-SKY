-- Account invitation and activation (SRS 8.7).
--
-- Registration is invitation only (BR-004). An invitation holds the email, role
-- and organization, and the account does not exist until the invitee completes
-- activation, so an unactivated account can never reach a protected resource.
--
-- The token is a random secret emailed to the invitee. Only its SHA-256 hash is
-- stored, so a database leak does not hand out working activation links.

CREATE TABLE IF NOT EXISTS "account_invitations" (
  "id" serial PRIMARY KEY,
  "tokenHash" varchar(64) NOT NULL UNIQUE,
  "email" varchar(320) NOT NULL,
  -- client | developer | technical_operator | admin | super_admin
  "role" varchar(32) NOT NULL,
  "organizationId" integer REFERENCES "organizations"("id") ON DELETE SET NULL,
  "invitedByUserId" integer REFERENCES "users"("id"),
  "expiresAt" timestamp NOT NULL,
  "acceptedAt" timestamp,
  "acceptedUserId" integer REFERENCES "users"("id"),
  "revokedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_invitations_email_idx" ON "account_invitations" (lower("email"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_invitations_org_idx" ON "account_invitations" ("organizationId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_invitations_invited_by_idx" ON "account_invitations" ("invitedByUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_invitations_accepted_user_idx" ON "account_invitations" ("acceptedUserId");
--> statement-breakpoint

-- One live invitation per address: a second invite supersedes the first by
-- revoking it, and this index makes a race between two admins impossible.
CREATE UNIQUE INDEX IF NOT EXISTS "account_invitations_one_pending_idx"
  ON "account_invitations" (lower("email")) WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
--> statement-breakpoint

ALTER TABLE "account_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "account_invitations_admin_all" ON "account_invitations";
--> statement-breakpoint
CREATE POLICY "account_invitations_admin_all" ON "account_invitations" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
