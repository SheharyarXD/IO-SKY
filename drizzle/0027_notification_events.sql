-- Notification emission log (SRS 17, Functional Specification section 35).
--
-- Every catalogue event the platform emits is recorded once. That gives:
--   - de-duplication: the composite key in `dedupKey` is unique, so a repeated
--     trigger (a reminder, a retry, a double click) cannot notify twice;
--   - communication history (SRS 17.13), who was told what and when;
--   - an audit trail for BR-022: each notification is linked to the business
--     event that caused it and the recipient it went to.
-- Append only, like the other audit tables. Admin only through RLS; the app
-- connects as a privileged role and is unaffected.

CREATE TABLE IF NOT EXISTS "notification_events" (
  "id" serial PRIMARY KEY,
  -- Catalogue id, e.g. AS-05, and its name.
  "eventId" varchar(16) NOT NULL,
  "eventName" varchar(80) NOT NULL,
  -- admin | client | developer
  "audience" varchar(16) NOT NULL,
  -- Who it went to: "admin", "org:12", "dev:7".
  "recipientRef" varchar(64) NOT NULL,
  "dedupKey" varchar(300) NOT NULL UNIQUE,
  "priority" varchar(4) NOT NULL,
  "title" varchar(200) NOT NULL,
  "emailRequested" boolean DEFAULT false NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_events_event_idx" ON "notification_events" ("eventId", "createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_events_recipient_idx" ON "notification_events" ("recipientRef", "createdAt");
--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_append_only ON "notification_events";
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "notification_events"
  FOR EACH ROW EXECUTE FUNCTION audit_is_append_only();
--> statement-breakpoint

ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notification_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "notification_events_admin_all" ON "notification_events";
--> statement-breakpoint
CREATE POLICY "notification_events_admin_all" ON "notification_events" FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());
