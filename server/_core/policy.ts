/**
 * Security policy (SRS 24.12, 8.9): settings an administrator controls that the
 * platform actually enforces.
 *
 *   security.session_hours        how long a new session lasts
 *   security.password_min_length  minimum length for a new password
 *
 * Values live in platform_settings, are validated and logged by the settings
 * path, and are copied into memory here. The refresh runs at start, on a timer
 * (so every instance converges within one tick) and straight after a change.
 * An invalid or missing value falls back to the built in default rather than
 * locking anyone out.
 */
import { setSessionPolicyHours } from "@shared/const";
import { MIN_PASSWORD_LENGTH, validateSettingValue } from "../../shared/srsRules";
import { getDb } from "../db";
import { platformSettings } from "../../drizzle/schema";
import { inArray } from "drizzle-orm";

let passwordMinLength = MIN_PASSWORD_LENGTH;

export function getPasswordMinLength(): number {
  return passwordMinLength;
}

/** Pure, so the fallback rules are testable without a database. */
export function applyPolicyValues(values: Record<string, string | undefined>): { sessionHours: number | null; passwordMin: number } {
  const check = (key: string) => {
    const v = values[key];
    return v !== undefined && validateSettingValue(key, v).ok ? Number(v.trim()) : null;
  };
  const sessionHours = check("security.session_hours");
  const passwordMin = check("security.password_min_length");
  setSessionPolicyHours(sessionHours);
  passwordMinLength = passwordMin ?? MIN_PASSWORD_LENGTH;
  return { sessionHours, passwordMin: passwordMinLength };
}

export async function refreshSecurityPolicy(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select({ key: platformSettings.key, value: platformSettings.value }).from(platformSettings).where(inArray(platformSettings.key, ["security.session_hours", "security.password_min_length"]));
    applyPolicyValues(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.warn("[policy] could not refresh the security policy:", err);
  }
}
