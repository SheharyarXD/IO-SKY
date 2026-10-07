/**
 * server/db/platformSettings.ts — Milestone 2 §2.5 platform configuration
 * store. One row per named setting (section + key), backing the admin
 * console's System Settings page as a real editable surface instead of a
 * hardcoded literal list. See drizzle/schema.ts's platformSettings table
 * doc comment for the deliberate scope boundary (config labels/state, not
 * live third-party provider wiring).
 */
import { asc, eq } from "drizzle-orm";
import { platformSettings, type PlatformSetting } from "../../drizzle/schema";
import { getDb } from "./connection";

/**
 * The six sections the System Settings page has always shown, with their
 * original static copy as the seed/default value — first read auto-seeds
 * these rows so the page renders identically to before until a super_admin
 * actually edits one, at which point it becomes real persisted state.
 */
const DEFAULT_SETTINGS: Array<{
  section: string;
  key: string;
  title: string;
  description: string;
  value: string;
}> = [
  { section: "branding", key: "branding.summary", title: "Branding", description: "Logo, accent colour, favicon and admin portal name.", value: "Configured" },
  { section: "storage", key: "storage.summary", title: "Cloud storage", description: "S3-compatible bucket, region, encryption and retention.", value: "Configured" },
  { section: "security", key: "security.summary", title: "Security policies", description: "MFA enforcement, session length, IP allowlists, password policy.", value: "Hardened" },
  { section: "i18n", key: "i18n.summary", title: "Localisation", description: "Default timezone (Europe/Amsterdam), languages and currency.", value: "EN · NL" },
  { section: "integrations", key: "integrations.summary", title: "Integrations", description: "Provider connections, derived from the environment at read time.", value: "Derived at read time" },
  { section: "observability", key: "observability.summary", title: "Observability", description: "Audit retention, error reporting, performance budgets, alerting.", value: "Active" },
];

/**
 * Milestone 2 §2.5 — AI governance config. No concrete spec for this
 * exists anywhere in this repo (not in a design doc, not in any code
 * comment), so rather than inventing an enforcement system (model
 * allow-lists? per-org feature toggles? none of that exists to govern),
 * this is scoped to what's actually true and checkable today: which LLM
 * provider AI Scan report generation is configured against (real, derived
 * from env at seed time — not editable, since it should reflect actual
 * config, not a claim), which AI Scan tiers exist (real, derived from the
 * schema's own `ai_scans_tier` enum), and a data-retention *policy record*
 * (editable free text — `ai_scans.responses`/`reportPayload` have no
 * automated deletion job anywhere in this codebase, so this field is
 * explicitly a documented policy statement for operators to record their
 * actual retention decision, not a TTL this app enforces).
 */
function buildAiGovernanceSeed(): Array<{
  section: string;
  key: string;
  title: string;
  description: string;
  value: string;
}> {
  const llmConfigured = Boolean(process.env.LLM_API_KEY && process.env.LLM_API_URL);
  return [
    {
      section: "ai_governance",
      key: "ai_governance.llm_provider",
      title: "LLM Provider (AI Scan)",
      description: "Backend that generates AI Scan executive reports. Reflects LLM_API_URL/LLM_API_KEY env config, not editable here.",
      value: llmConfigured ? "Configured" : "Not configured",
    },
    {
      section: "ai_governance",
      key: "ai_governance.tiers",
      title: "AI Scan tiers",
      description: "Tiers defined in the schema (ai_scans_tier enum).",
      value: "free, growth, elite",
    },
    {
      section: "ai_governance",
      key: "ai_governance.data_retention",
      title: "AI Scan data retention policy",
      description: "Documented retention decision for ai_scans.responses/reportPayload. No automated deletion job exists in this codebase — this is a policy record, not an enforced TTL.",
      value: "Indefinite (no automated deletion configured)",
    },
  ];
}


/**
 * The integrations summary is a fact about the running environment, not an
 * operator-editable label, so it is derived on every read instead of stored.
 * It used to be seeded as a blanket "Connected" naming seven providers, which
 * included Manus (removed in Milestone 2) and several (Stripe, SendGrid,
 * Postmark, Google Maps) that this codebase has never integrated.
 */
function describeIntegrations(): { description: string; value: string } {
  const providers: Array<[string, boolean]> = [
    ["Email (Resend)", Boolean(process.env.RESEND_API_KEY)],
    ["SMS (Twilio)", Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)],
    ["AI (LLM)", Boolean(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY)],
    ["Storage and auth (Supabase)", Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY)],
  ];
  const on = providers.filter(([, ok]) => ok).map(([n]) => n);
  const off = providers.filter(([, ok]) => !ok).map(([n]) => n);
  return {
    value: `${on.length} of ${providers.length} configured`,
    description:
      (on.length ? `Configured: ${on.join(", ")}. ` : "") +
      (off.length ? `Not configured: ${off.join(", ")}.` : ""),
  };
}

function withDerivedRows(rows: PlatformSetting[]): PlatformSetting[] {
  return rows.map((r) =>
    r.key === "integrations.summary" ? { ...r, ...describeIntegrations() } : r,
  );
}

const POLICY_SETTINGS = [
  { section: "security", key: "security.session_hours", title: "Session length (hours)", description: "How long a new sign in lasts, from 1 to 24. Applies to sessions created after the change.", value: "12" },
  { section: "security", key: "security.password_min_length", title: "Minimum password length", description: "Minimum characters for a new password, from 8 to 128. Applies to accounts activated after the change.", value: "12" },
];

const MAINTENANCE_SETTING = {
  section: "operations",
  key: "operations.maintenance_mode",
  title: "Maintenance mode",
  description: 'Set to "on" to return a maintenance response to everyone except administrators and sign in.',
  value: "off",
};

export async function listPlatformSettings(): Promise<PlatformSetting[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(platformSettings).orderBy(asc(platformSettings.section));
  if (existing.length > 0) {
    // Settings added after the first seed (the maintenance toggle) would
    // otherwise never exist on a database that was seeded earlier.
    if (!existing.some((r) => r.key === "operations.maintenance_mode") || !existing.some((r) => r.key === "security.session_hours")) {
      await db.insert(platformSettings).values([MAINTENANCE_SETTING, ...POLICY_SETTINGS]).onConflictDoNothing();
      return withDerivedRows(await db.select().from(platformSettings).orderBy(asc(platformSettings.section)));
    }
    return withDerivedRows(existing);
  }

  // First-ever read: seed the default rows so the page has real persisted
  // state from day one instead of silently staying empty forever.
  await db
    .insert(platformSettings)
    .values([...DEFAULT_SETTINGS, ...buildAiGovernanceSeed()])
    .onConflictDoNothing();
  return withDerivedRows(await db.select().from(platformSettings).orderBy(asc(platformSettings.section)));
}

export async function updatePlatformSetting(
  key: string,
  updates: { value?: string; description?: string | null },
  updatedByUserId: number,
): Promise<PlatformSetting | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(platformSettings)
    .set({ ...updates, updatedByUserId, updatedAt: new Date() })
    .where(eq(platformSettings.key, key))
    .returning();
  return rows[0] ?? null;
}
