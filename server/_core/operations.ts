/**
 * Platform operations (SRS 25): maintenance mode, the alert evaluator and the
 * scheduled report runner.
 *
 * Same shape as bookingReminders: a single in-process interval, every job
 * idempotent and a no-op without a database, so it is always safe to start.
 * Reports claim their row before sending, so two instances cannot both send.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { dispatchSimpleEmail, escapeHtml } from "../email";
import {
  claimDueScheduledReports,
  evaluateAlertRules,
  isMaintenanceModeOn,
  listIncidents,
  purgeExpiredAiScanDrafts,
  readFinancialSummary,
  readPipelineSummary,
  recordScheduledReportResult,
} from "../db";
import type { ScheduledReport } from "../../drizzle/schema";
import { runDueScheduledWorkflows } from "../workflowEngine";

/**
 * Paths that must keep working while maintenance is on. Health must, or the
 * host restarts the container. Sign in and the admin surfaces must, or nobody
 * could ever turn maintenance mode back off.
 */
const MAINTENANCE_ALLOWED_PREFIXES = [
  "/health",
  "/api/health",
  "/login",
  "/mfa-challenge",
  "/admin",
  "/ops",
  "/assets",
  "/api/oauth",
  "/api/auth",
  "/api/trpc/auth.",
  "/api/trpc/admin",
  "/api/trpc/mfa.",
  "/api/resend",
];

export function isMaintenanceExempt(path: string): boolean {
  return MAINTENANCE_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p));
}

const MAINTENANCE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Scheduled maintenance</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0E14;color:#E6EAF0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif}main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.5rem;margin:0 0 .75rem}p{margin:0;color:rgba(230,234,240,.75);line-height:1.6}</style></head><body><main><h1>Scheduled maintenance</h1><p>IO SKY is being updated and will be back shortly. Thank you for your patience.</p></main></body></html>`;

export function registerMaintenanceMode(app: Express): void {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (isMaintenanceExempt(req.path)) return next();
    let on = false;
    try {
      on = await isMaintenanceModeOn();
    } catch {
      on = false;
    }
    if (!on) return next();
    res.setHeader("Retry-After", "600");
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ error: "maintenance", message: "The platform is in scheduled maintenance." });
    }
    return res.status(503).type("html").send(MAINTENANCE_HTML);
  });
}

// ---------------------------------------------------------------------------
// Scheduled reports
// ---------------------------------------------------------------------------

const eur = (cents: number) => `EUR ${(cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function buildReportBody(kind: string): Promise<{ subject: string; lines: string[] }> {
  if (kind === "pipeline") {
    const rows = (await readPipelineSummary()) ?? [];
    const open = rows.filter((r) => r.stage !== "won" && r.stage !== "lost");
    return {
      subject: "Sales pipeline report",
      lines: [
        `Open opportunities: ${open.reduce((a, r) => a + r.count, 0)} worth ${eur(open.reduce((a, r) => a + r.valueCents, 0))}`,
        ...rows.map((r) => `${r.stage}: ${r.count} (${eur(r.valueCents)})`),
      ],
    };
  }
  if (kind === "billing") {
    const f = await readFinancialSummary();
    return {
      subject: "Billing report",
      lines: f
        ? [
            `Outstanding: ${eur(f.outstandingCents)} across ${f.openInvoices} invoices`,
            `Overdue: ${eur(f.overdueCents)} across ${f.overdueInvoices} invoices`,
            `Paid in the last 30 days: ${eur(f.paidLast30DaysCents)}`,
            `Paid in the last 90 days: ${eur(f.paidLast90DaysCents)}`,
            `Monthly recurring revenue: ${eur(f.monthlyRecurringCents)} from ${f.activeSubscriptions} subscriptions`,
          ]
        : ["Database unavailable."],
    };
  }
  if (kind === "security") {
    const open = (await listIncidents({ category: "security" })).filter((i) => i.status === "open" || i.status === "investigating");
    return {
      subject: "Security report",
      lines: [`Open security incidents: ${open.length}`, ...open.slice(0, 20).map((i) => `#${i.id} ${i.severity}: ${i.title}`)],
    };
  }
  const open = (await listIncidents({ category: "operational" })).filter((i) => i.status === "open" || i.status === "investigating");
  return {
    subject: "Delivery and operations report",
    lines: [`Open operational incidents: ${open.length}`, ...open.slice(0, 20).map((i) => `#${i.id} ${i.severity}: ${i.title}`)],
  };
}

export async function sendScheduledReport(r: ScheduledReport): Promise<boolean> {
  let recipients: string[] = [];
  try {
    recipients = JSON.parse(r.recipientsJson);
  } catch {
    recipients = [];
  }
  if (recipients.length === 0) return false;
  const { subject, lines } = await buildReportBody(r.reportKind);
  const html = `<h2>${escapeHtml(r.name)}</h2><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
  const text = `${r.name}\n\n${lines.join("\n")}`;
  let allOk = true;
  for (const to of recipients) {
    const res = await dispatchSimpleEmail({ to, subject: `[IO SKY] ${subject}`, html, text, refHeader: `scheduled-report-${r.id}`, messageType: "notification", relatedRef: `report:${r.id}` });
    if (!res.ok) allOk = false;
  }
  return allOk;
}

export async function runDueScheduledReports(now = new Date()): Promise<{ sent: number; failed: number }> {
  const due = await claimDueScheduledReports(now);
  let sent = 0;
  let failed = 0;
  for (const r of due) {
    let ok = false;
    try {
      ok = await sendScheduledReport(r);
    } catch (err) {
      console.error(`[scheduledReports] report ${r.id} failed:`, err);
    }
    await recordScheduledReportResult(r.id, ok ? "sent" : "failed");
    if (ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

// ---------------------------------------------------------------------------
// Job loop
// ---------------------------------------------------------------------------

const TICK_MS = 5 * 60_000;

export function startOperationsJobs(): void {
  setInterval(() => {
    evaluateAlertRules().catch((err) => console.warn("[alerts] evaluation tick failed:", err));
    runDueScheduledReports().catch((err) => console.warn("[scheduledReports] tick failed:", err));
    runDueScheduledWorkflows().catch((err) => console.warn("[scheduledWorkflows] tick failed:", err));
    purgeExpiredAiScanDrafts().catch((err) => console.warn("[aiScanDrafts] purge failed:", err));
  }, TICK_MS).unref();
}
