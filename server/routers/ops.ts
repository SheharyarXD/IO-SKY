/*
 * IO SKY — Technical Operator / Ops console · server router.
 *
 * Milestone 2 §2.5 — "technical_operator" is a new RBAC tier scoped to
 * infrastructure/operational visibility ONLY. This router is the enforced
 * boundary for that promise: every query here reads system-health-shaped
 * data (email delivery health, security event volume, login-failure
 * volume, MFA enrollment posture) and nothing from leads/invoices/reports/
 * client_documents/billing — those stay behind `adminProcedure` in
 * server/routers/admin.ts, which `opsProcedure` deliberately does not
 * grant. Gated by `opsProcedure` (technical_operator + admin + super_admin
 * — see server/_core/trpc.ts's isOpsRole).
 *
 * Doubles as the "Security Center" deliverable: `securityEvents` +
 * `acknowledgeSecurityEvent` give a real investigation/acknowledgment
 * workflow on top of developer_security_events, replacing the read-only
 * slice that previously only existed inside admin.security.
 */
import { z } from "zod";
import { count, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { opsProcedure, router } from "../_core/trpc";
import { getRequestMeta } from "../_core/requestMeta";
import {
  getDb,
  appendLoginAudit,
  listEmailDeliveryLog,
  listRecentSecurityEvents,
  acknowledgeDeveloperSecurityEvent,
} from "../db";
import {
  loginAudit,
  users,
  mfaFactors,
  emailDeliveryLog,
  developerSecurityEvents,
} from "../../drizzle/schema";

async function recordOpsEvent(opts: {
  ctx: any;
  reason: string;
  outcome?: "success" | "failed";
}) {
  try {
    const { ip, userAgent } = getRequestMeta(opts.ctx?.req);
    await appendLoginAudit({
      userId: opts.ctx?.user?.id ?? null,
      identifier: opts.ctx?.user?.email ?? null,
      provider: "ops",
      outcome: opts.outcome ?? "success",
      reason: opts.reason.slice(0, 200),
      ip,
      userAgent,
    });
  } catch (err) {
    console.error("[ops] failed to write audit row:", err);
  }
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[ops] query failed, returning fallback:", err);
    return fallback;
  }
}

export const opsRouter = router({
  /**
   * Aggregate infra-health snapshot: email delivery health (24h), failed
   * logins (24h), security event volume by severity (24h), MFA enrollment
   * posture. No customer/financial figures anywhere in this shape.
   */
  systemHealth: opsProcedure.query(async ({ ctx }) => {
    await recordOpsEvent({ ctx, reason: "ops.read.system_health" });
    const db = await getDb();
    if (!db) {
      return {
        email: { sent24h: 0, delivered24h: 0, failed24h: 0 },
        failedLogins24h: 0,
        securityEvents24h: { info: 0, warn: 0, high: 0, critical: 0 },
        mfa: { totalUsers: 0, mfaEnrolled: 0, mfaEnrolledPct: 0 },
        generatedAtMs: Date.now(),
        source: "unavailable" as const,
      };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const email = await safe(async () => {
      const rows = await db
        .select({ status: emailDeliveryLog.status, c: count() })
        .from(emailDeliveryLog)
        .where(sql`${emailDeliveryLog.createdAt} >= ${since}`)
        .groupBy(emailDeliveryLog.status);
      let sent24h = 0;
      let delivered24h = 0;
      let failed24h = 0;
      for (const r of rows as any[]) {
        const c = Number(r.c ?? 0);
        sent24h += c;
        if (r.status === "delivered") delivered24h += c;
        if (r.status === "bounced" || r.status === "complained" || r.status === "failed") failed24h += c;
      }
      return { sent24h, delivered24h, failed24h };
    }, { sent24h: 0, delivered24h: 0, failed24h: 0 });

    const failedLogins24h = await safe(async () => {
      const r = await db
        .select({ c: count() })
        .from(loginAudit)
        .where(sql`${loginAudit.outcome} != 'success' AND ${loginAudit.createdAt} >= ${since}`);
      return Number(r[0]?.c ?? 0);
    }, 0);

    const securityEvents24h = await safe(async () => {
      const rows = await db
        .select({ severity: developerSecurityEvents.severity, c: count() })
        .from(developerSecurityEvents)
        .where(sql`${developerSecurityEvents.createdAt} >= ${since}`)
        .groupBy(developerSecurityEvents.severity);
      const out = { info: 0, warn: 0, high: 0, critical: 0 };
      for (const r of rows as any[]) {
        const key = r.severity as keyof typeof out;
        if (key in out) out[key] = Number(r.c ?? 0);
      }
      return out;
    }, { info: 0, warn: 0, high: 0, critical: 0 });

    const mfa = await safe(async () => {
      const totalUsersRow = await db.select({ c: count() }).from(users);
      const totalUsers = Number(totalUsersRow[0]?.c ?? 0);
      const mfaRow = await db
        .select({ c: sql<number>`COUNT(DISTINCT ${mfaFactors.userId})` })
        .from(mfaFactors)
        .where(sql`${mfaFactors.verifiedAt} IS NOT NULL`);
      const mfaEnrolled = Number(mfaRow[0]?.c ?? 0);
      const mfaEnrolledPct = totalUsers === 0 ? 0 : Number(((mfaEnrolled / totalUsers) * 100).toFixed(1));
      return { totalUsers, mfaEnrolled, mfaEnrolledPct };
    }, { totalUsers: 0, mfaEnrolled: 0, mfaEnrolledPct: 0 });

    return {
      email,
      failedLogins24h,
      securityEvents24h,
      mfa,
      generatedAtMs: Date.now(),
      source: "db" as const,
    };
  }),

  /** Full recent email delivery log — same data adminProcedure exposes, ops-safe (no PII beyond a recipient email address already visible to the sender). */
  emailDeliveryLog: opsProcedure.query(async ({ ctx }) => {
    await recordOpsEvent({ ctx, reason: "ops.read.email_delivery_log" });
    return safe(() => listEmailDeliveryLog(200), []);
  }),

  /** Security Center — recent platform-wide security events for investigation. */
  securityEvents: opsProcedure.query(async ({ ctx }) => {
    await recordOpsEvent({ ctx, reason: "ops.read.security_events" });
    return safe(() => listRecentSecurityEvents(100), []);
  }),

  /** Security Center — acknowledge (mark reviewed) a single security event. */
  acknowledgeSecurityEvent: opsProcedure
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await acknowledgeDeveloperSecurityEvent(input.eventId, ctx.user.id);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Security event not found." });
      }
      await recordOpsEvent({ ctx, reason: `ops.acknowledge_security_event:${input.eventId}` });
      return updated;
    }),
});
