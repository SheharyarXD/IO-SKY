-- Milestone 3 §3.4 (RM-108) — restore the updatedAt trigger on three tables
-- that were created after migration 0002 and never got one.
--
-- Found by the RM-108 constraint suite (server/dbConstraints.test.ts), which
-- cross-checks "has an updatedAt column" against "has a trigger", rather than
-- trusting that 0002's list stayed complete.
--
-- 0002 applied set_updated_at() to the 18 tables that existed at the time.
-- Three tables added by later Milestone 2 migrations declare `updatedAt` but
-- were never wired to the trigger:
--
--   platform_settings      (0011_platform_settings)
--   workflow_definitions   (0013_workflow_engine)
--   webhook_registrations  (0014_webhook_registry)
--
-- The effect was silent: inserts set updatedAt correctly via defaultNow(), so
-- the column always looked populated. It simply never advanced on UPDATE — so
-- "last modified" on a platform setting, a workflow definition or a webhook
-- registration reported when the row was *created*, not when it was last
-- changed. For platform_settings and webhook_registrations in particular that
-- is configuration-change history, which Milestone 2 §2.5 relies on for
-- configuration-change auditing.
--
-- Idempotent: DROP ... IF EXISTS before CREATE, so re-running is safe and the
-- migration does not fail on an environment where it was applied manually.

DROP TRIGGER IF EXISTS set_updated_at ON "platform_settings";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "platform_settings" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at ON "workflow_definitions";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "workflow_definitions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at ON "webhook_registrations";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "webhook_registrations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
