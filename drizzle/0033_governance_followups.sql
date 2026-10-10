-- Follow ups to 0032, found by the database constraint tests.
-- updatedAt trigger on document_matrix; an explicit deny policy on the payment tables that
-- carry an organizationId (the backend connection is the only reader); indexes on foreign keys.

DROP TRIGGER IF EXISTS set_updated_at ON "document_matrix";
--> statement-breakpoint
CREATE TRIGGER set_updated_at BEFORE UPDATE ON "document_matrix" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
DROP POLICY IF EXISTS "payment_events_deny" ON "payment_events";
--> statement-breakpoint
CREATE POLICY "payment_events_deny" ON "payment_events" FOR ALL USING (false) WITH CHECK (false);
--> statement-breakpoint
DROP POLICY IF EXISTS "scan_purchases_deny" ON "scan_purchases";
--> statement-breakpoint
CREATE POLICY "scan_purchases_deny" ON "scan_purchases" FOR ALL USING (false) WITH CHECK (false);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_templates_created_by_idx" ON "notification_templates" ("createdByUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_matrix_updated_by_idx" ON "document_matrix" ("updatedByUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operator_scopes_granted_by_idx" ON "operator_scopes" ("grantedByUserId");
