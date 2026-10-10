/**
 * Integration registry (SRS 22 integration and API management, 7.8 provider management).
 *
 * Reports which external providers are configured and lets a Super Admin run a
 * connection test. Secrets are never returned: only whether each variable is set.
 * Tests use calls that create nothing and consume no paid quota.
 */
import { getDb } from "./db/connection";

export type IntegrationKey = "database" | "supabase" | "stripe" | "openai" | "email" | "sms";

type Def = { key: IntegrationKey; name: string; purpose: string; required: string[]; anyOf?: string[]; testable: boolean };

export const INTEGRATIONS: Def[] = [
  { key: "database", name: "Database", purpose: "Primary data store", required: ["DATABASE_URL"], testable: true },
  { key: "supabase", name: "Supabase", purpose: "Authentication and file storage", required: ["SUPABASE_URL", "SUPABASE_SECRET_KEY"], testable: true },
  { key: "stripe", name: "Stripe", purpose: "Payments, invoices and tax", required: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], testable: true },
  { key: "openai", name: "OpenAI", purpose: "AI Scan analysis and AI agents", required: [], anyOf: ["OPENAI_API_KEY", "LLM_API_KEY"], testable: true },
  { key: "email", name: "Email sending", purpose: "Transactional email", required: [], anyOf: ["RESEND_API_KEY", "SMTP_URL"], testable: false },
  { key: "sms", name: "Twilio", purpose: "SMS for multi factor authentication", required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"], testable: false },
];

const isSet = (env: Record<string, string | undefined>, k: string) => Boolean(env[k]?.trim());

export function integrationStatus(env: Record<string, string | undefined> = process.env) {
  return INTEGRATIONS.map((d) => {
    const missing = d.required.filter((k) => !isSet(env, k));
    const anyOk = !d.anyOf || d.anyOf.some((k) => isSet(env, k));
    const configured = missing.length === 0 && anyOk;
    return {
      key: d.key,
      name: d.name,
      purpose: d.purpose,
      configured,
      missing: [...missing, ...(anyOk ? [] : [d.anyOf!.join(" or ")])],
      testable: d.testable,
    };
  });
}

export type TestResult = { ok: boolean; detail: string; ms: number };

async function timed(fn: () => Promise<{ ok: boolean; detail: string }>): Promise<TestResult> {
  const t = Date.now();
  try {
    const r = await fn();
    return { ...r, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 200) : "Request failed", ms: Date.now() - t };
  }
}

export async function testIntegration(key: IntegrationKey, env: Record<string, string | undefined> = process.env): Promise<TestResult> {
  const status = integrationStatus(env).find((s) => s.key === key);
  if (!status) return { ok: false, detail: "Unknown integration.", ms: 0 };
  if (!status.configured) return { ok: false, detail: `Not configured: ${status.missing.join(", ")}.`, ms: 0 };
  if (!status.testable) return { ok: true, detail: "Configured. This provider has no safe connection test; it is verified by its first delivery.", ms: 0 };
  const signal = () => AbortSignal.timeout(10_000);
  switch (key) {
    case "database":
      return timed(async () => {
        const db = await getDb();
        if (!db) return { ok: false, detail: "No database connection." };
        await db.execute("select 1" as never);
        return { ok: true, detail: "Query succeeded." };
      });
    case "supabase":
      return timed(async () => {
        const res = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: env.SUPABASE_SECRET_KEY! }, signal: signal() });
        return { ok: res.ok, detail: res.ok ? "Auth service reachable." : `Supabase answered ${res.status}.` };
      });
    case "stripe":
      return timed(async () => {
        const res = await fetch("https://api.stripe.com/v1/balance", { headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: signal() });
        const mode = env.STRIPE_SECRET_KEY!.startsWith("sk_test") || env.STRIPE_SECRET_KEY!.startsWith("rk_test") ? "test mode" : "live mode";
        return { ok: res.ok, detail: res.ok ? `Key accepted (${mode}).` : `Stripe answered ${res.status}.` };
      });
    case "openai":
      return timed(async () => {
        const base = (env.LLM_API_URL ? new URL(env.LLM_API_URL).origin : "https://api.openai.com") + "/v1/models";
        const res = await fetch(base, { headers: { authorization: `Bearer ${env.LLM_API_KEY || env.OPENAI_API_KEY}` }, signal: signal() });
        // /models proves the key is valid. It cannot show whether the account still has credit.
        return { ok: res.ok, detail: res.ok ? "Key accepted. Account credit is not checked by this test." : `Provider answered ${res.status}.` };
      });
    default:
      return { ok: false, detail: "No test for this provider.", ms: 0 };
  }
}
