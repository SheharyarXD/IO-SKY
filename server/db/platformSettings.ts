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
  { section: "integrations", key: "integrations.summary", title: "Integrations", description: "Stripe, Twilio, SendGrid, Postmark, OpenAI, Google Maps, Manus.", value: "Connected" },
  { section: "observability", key: "observability.summary", title: "Observability", description: "Audit retention, error reporting, performance budgets, alerting.", value: "Active" },
];

export async function listPlatformSettings(): Promise<PlatformSetting[]> {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(platformSettings).orderBy(asc(platformSettings.section));
  if (existing.length > 0) return existing;

  // First-ever read: seed the default rows so the page has real persisted
  // state from day one instead of silently staying empty forever.
  await db.insert(platformSettings).values(DEFAULT_SETTINGS).onConflictDoNothing();
  return db.select().from(platformSettings).orderBy(asc(platformSettings.section));
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
