-- Data Subject Rights administration.
--
-- Implements the record the client specified: date received, request type,
-- identity verification status, responsible authorised user, affected systems
-- and data, actions taken, decision and status, completion date, and a full
-- audit history.
--
-- Three design decisions worth stating, because each one is load-bearing.
--
-- 1. AUTHORISATION IS NOT A ROLE.
--    The client was explicit that "Developers, Admins or other roles must not
--    receive access merely because of their general role". So authority to act
--    on a privacy request is an explicit per-user grant in
--    `privacy_officer_grants`, orthogonal to `users.role`. A Super Admin with
--    no grant can see nothing here. Granting is itself recorded, with who
--    granted it and why, because "who was allowed to read the personal data"
--    is exactly the question an audit will ask.
--
-- 2. THE HISTORY IS APPEND-ONLY.
--    `privacy_request_events` has no update path in the application, and every
--    state change on a request writes one. A mutable status column alone would
--    record where a request ended up but not how it got there, which is the
--    half a regulator cares about.
--
-- 3. NOTHING COMPLETES ITSELF.
--    The client required that the system "must not autonomously make final
--    decisions without authorised human review". The status enum therefore has
--    an explicit `awaiting_approval` state between the system preparing an
--    action and that action being carried out, and the approving user is
--    recorded separately from the user who prepared it.

CREATE TABLE IF NOT EXISTS "privacy_officer_grants" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Who granted it, and why. Nullable `grantedByUserId` only so the first
  -- grant can be seeded by an operator outside the application.
  "grantedByUserId" integer REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "grantedAt" timestamp DEFAULT now() NOT NULL,
  -- Revocation is a stamp rather than a delete: removing the row would erase
  -- the evidence that the person once had access.
  "revokedAt" timestamp,
  "revokedByUserId" integer REFERENCES "users"("id"),
  "revokedReason" text
);
--> statement-breakpoint

-- One live grant per user. A partial unique index rather than a plain one, so
-- a user may be granted again after a revocation.
CREATE UNIQUE INDEX IF NOT EXISTS "privacy_officer_grants_active_idx"
  ON "privacy_officer_grants" ("userId") WHERE "revokedAt" IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "privacy_requests" (
  "id" serial PRIMARY KEY,
  -- Quotable in correspondence with the data subject without exposing a
  -- guessable sequential id.
  "publicRef" varchar(64) NOT NULL UNIQUE,

  -- GDPR Articles 15 to 21.
  "requestType" varchar(32) NOT NULL,

  -- The subject. `subjectUserId` is null when the request comes from someone
  -- who never held an account: a contact form submitter or a booking
  -- attendee is still a data subject, and their data is keyed by email only.
  "subjectUserId" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "subjectEmail" varchar(320) NOT NULL,
  "subjectName" varchar(200),

  "receivedAt" timestamp DEFAULT now() NOT NULL,
  -- The statutory clock. Stored rather than computed so a lawfully extended
  -- deadline can be recorded as a fact.
  "dueAt" timestamp,

  -- unverified | pending | verified | failed
  "identityVerificationStatus" varchar(32) DEFAULT 'unverified' NOT NULL,
  "identityVerificationNote" text,
  "identityVerifiedAt" timestamp,
  "identityVerifiedByUserId" integer REFERENCES "users"("id"),

  -- The authorised person who owns this request.
  "assignedToUserId" integer REFERENCES "users"("id"),

  -- What was found and what was done. JSON text rather than a normalised
  -- table: the shape differs per request type, and the value is evidence to
  -- be read rather than data to be queried.
  "affectedSystemsJson" text,
  "actionsTakenJson" text,

  -- received | locating | awaiting_approval | in_progress | completed
  -- | rejected | withdrawn
  "status" varchar(32) DEFAULT 'received' NOT NULL,
  "decision" text,
  "completedAt" timestamp,

  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "privacy_requests_status_idx" ON "privacy_requests" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_requests_subject_email_idx" ON "privacy_requests" ("subjectEmail");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "privacy_requests_subject_user_idx" ON "privacy_requests" ("subjectUserId");
--> statement-breakpoint

-- Append-only. No UPDATE or DELETE path exists in the application.
CREATE TABLE IF NOT EXISTS "privacy_request_events" (
  "id" serial PRIMARY KEY,
  "requestId" integer NOT NULL REFERENCES "privacy_requests"("id") ON DELETE CASCADE,
  -- The person who caused it. Null only for events the system raises on its
  -- own, such as a due-date lapse.
  "actorUserId" integer REFERENCES "users"("id"),
  "event" varchar(64) NOT NULL,
  "detail" text,
  "ip" varchar(64),
  "userAgent" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "privacy_request_events_request_idx"
  ON "privacy_request_events" ("requestId", "createdAt");
--> statement-breakpoint

-- Keep updatedAt honest, matching 0002/0017's convention for every other
-- table that has one.
DROP TRIGGER IF EXISTS set_updated_at ON "privacy_requests";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "privacy_requests"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
