-- Stripe payments, AI usage, notification templates, document matrix, operator scopes.
-- Every new table has row level security enabled and forced with no policy: the backend
-- privileged connection is the only reader, as for the privacy tables (0031).

CREATE TABLE IF NOT EXISTS "payment_events" (
  "id" serial PRIMARY KEY,
  "providerEventId" varchar(128) NOT NULL UNIQUE,
  "type" varchar(96) NOT NULL,
  "invoiceId" integer,
  "organizationId" integer,
  "scanPurchaseId" integer,
  "amountCents" integer,
  "currency" varchar(8),
  "outcome" varchar(32) NOT NULL,
  "detail" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scan_purchases" (
  "id" serial PRIMARY KEY,
  "tier" varchar(16) NOT NULL,
  "email" varchar(320) NOT NULL,
  "fullName" varchar(200) NOT NULL,
  "company" varchar(200),
  "locale" varchar(8) NOT NULL DEFAULT 'en',
  "amountCents" integer NOT NULL,
  "currency" varchar(8) NOT NULL DEFAULT 'EUR',
  "stripeSessionId" varchar(128) UNIQUE,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "leadId" integer,
  "organizationId" integer,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "paidAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "client_invoices" ADD COLUMN IF NOT EXISTS "stripeSessionId" varchar(128);
--> statement-breakpoint
ALTER TABLE "client_invoices" ADD COLUMN IF NOT EXISTS "stripeInvoiceUrl" varchar(512);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" serial PRIMARY KEY,
  "model" varchar(96) NOT NULL,
  "complexity" varchar(16) NOT NULL,
  "purpose" varchar(96),
  "promptTokens" integer NOT NULL DEFAULT 0,
  "completionTokens" integer NOT NULL DEFAULT 0,
  "costMicros" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_created_idx" ON "ai_usage" ("createdAt");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" serial PRIMARY KEY,
  "eventName" varchar(96) NOT NULL,
  "channel" varchar(16) NOT NULL,
  "locale" varchar(8) NOT NULL,
  "version" integer NOT NULL,
  "subject" varchar(300) NOT NULL,
  "body" text NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'draft',
  "createdByUserId" integer REFERENCES "users"("id"),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("eventName", "channel", "locale", "version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_matrix" (
  "documentType" varchar(64) PRIMARY KEY,
  "label" varchar(120) NOT NULL,
  "owningEntity" varchar(64) NOT NULL,
  "authorizedRoles" text NOT NULL,
  "versioned" boolean NOT NULL DEFAULT true,
  "approvalRequired" boolean NOT NULL DEFAULT false,
  "retentionDays" integer,
  "archiveOnProjectCompletion" boolean NOT NULL DEFAULT true,
  "classification" varchar(32) NOT NULL DEFAULT 'confidential',
  "clientVisible" boolean NOT NULL DEFAULT false,
  "provisional" boolean NOT NULL DEFAULT true,
  "updatedByUserId" integer REFERENCES "users"("id"),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_scopes" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" varchar(32) NOT NULL,
  "expiresAt" timestamp,
  "revokedAt" timestamp,
  "grantedByUserId" integer REFERENCES "users"("id"),
  "note" varchar(300),
  "createdAt" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operator_scopes_user_idx" ON "operator_scopes" ("userId");
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_events','scan_purchases','ai_usage','notification_templates','document_matrix','operator_scopes']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['payment_events','ai_usage']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_append_only ON %I', t);
    EXECUTE format('CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_is_append_only()', t);
  END LOOP;
END $$;
--> statement-breakpoint
INSERT INTO "document_matrix" ("documentType","label","owningEntity","authorizedRoles","versioned","approvalRequired","classification","clientVisible") VALUES
 ('ai_scan_report','AI Scan Report','organization','["super_admin","admin","client"]',true,true,'confidential',true),
 ('project_specification','Project Specification','project','["super_admin","admin","developer","client"]',true,true,'confidential',true),
 ('technical_documentation','Technical Documentation','project','["super_admin","admin","developer","technical_operator"]',true,false,'internal',false),
 ('project_deliverable','Project Deliverable','project','["super_admin","admin","developer","client"]',true,true,'confidential',true),
 ('proposal','Proposal','opportunity','["super_admin","admin","client"]',true,true,'confidential',true),
 ('quotation','Quotation','opportunity','["super_admin","admin","client"]',true,true,'confidential',true),
 ('invoice','Invoice','organization','["super_admin","admin","client"]',false,false,'confidential',true),
 ('contract','Contract','organization','["super_admin","admin","client"]',true,true,'restricted',true),
 ('meeting_notes','Meeting Notes','project','["super_admin","admin","developer"]',true,false,'internal',false),
 ('user_manual','User Manual','project','["super_admin","admin","developer","client"]',true,false,'internal',true),
 ('internal_documentation','Internal Documentation','platform','["super_admin","admin"]',true,false,'internal',false)
ON CONFLICT ("documentType") DO NOTHING;
