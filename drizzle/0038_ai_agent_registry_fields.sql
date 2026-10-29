-- AI Agent Registry minimum fields (task G02, SRS 19.17, 19.18, 19.20).
-- NOT applied by this repository. Review, then apply deliberately to a non-production database first.
-- DEPLOYMENT ORDER: apply this BEFORE deploying the code that uses it. The application reads and inserts every
-- column of ai_agents, so without it the registry page errors and, because the AI permission gate fails closed,
-- AI Scans and the lead qualifier are refused until it is applied.
-- Additive only: nine columns on ai_agents, all nullable or defaulted, so existing rows and code keep working.
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "businessFunction" varchar(160);
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "capabilitiesJson" text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "supportedModulesJson" text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "toolsJson" text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "knowledgeSourcesJson" text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "escalationRules" text;
--> statement-breakpoint
-- Least authority by default: a new or untouched agent cannot be assumed to act.
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "maxAuthority" varchar(24) NOT NULL DEFAULT 'read_only';
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "responsibleAdminUserId" integer REFERENCES "users" ("id");
--> statement-breakpoint
ALTER TABLE "ai_agents" ADD COLUMN IF NOT EXISTS "registryVersion" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
-- Record what the two agents that already run actually do, taken from their code. Only fills a row that has
-- no business function yet, so a Super Admin's later edits are never overwritten. Responsible admin is left
-- empty on purpose: only a person can assign it.
UPDATE "ai_agents" SET
  "businessFunction" = 'AI Scan report drafting',
  "capabilitiesJson" = '["draft_scan_report"]',
  "supportedModulesJson" = '["ai_scan"]',
  "escalationRules" = 'Every report is held for expert review; the agent cannot approve or publish it. If the model call fails the scan is marked failed and the admin team is notified.',
  "maxAuthority" = 'draft_only'
WHERE "key" = 'ai_scan_analyst' AND "businessFunction" IS NULL;
--> statement-breakpoint
UPDATE "ai_agents" SET
  "businessFunction" = 'Inbound lead assessment',
  "capabilitiesJson" = '["assess_lead_fit"]',
  "supportedModulesJson" = '["crm"]',
  "escalationRules" = 'A person decides what happens to the lead; the agent only records a recommendation.',
  "maxAuthority" = 'draft_only'
WHERE "key" = 'lead_qualifier' AND "businessFunction" IS NULL;
