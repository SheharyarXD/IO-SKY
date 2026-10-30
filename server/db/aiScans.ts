/**
 * server/db/aiScans.ts
 *
 * Database helpers for the AI Scan feature.
 * Covers: create, lookup by token/id, status update, list, PDF key cache.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  aiScans,
  aiScanReportVersions,
  aiScanStatusEvents,
  type AiScan,
  type AiScanStatusEvent,
  type InsertAiScan,
  type InsertReportDownloadAudit,
  reportDownloadAudit,
} from "../../drizzle/schema";
import { canMoveReport, type ReportStatus } from "../../shared/srsRules";
import { getDb } from "./connection";

export async function createAiScan(
  input: InsertAiScan,
): Promise<AiScan | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create AI scan: database not available");
    return null;
  }
  const rows = await db.insert(aiScans).values(input).returning();
  return rows[0] ?? null;
}

export async function getAiScanByToken(
  reportToken: string,
): Promise<AiScan | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(aiScans)
    .where(eq(aiScans.reportToken, reportToken))
    .limit(1);
  return rows[0] ?? null;
}

let downloadAuditWarned = false;

/**
 * Record a report access (task M4-01, SRS 9.10). Best effort by design: if the
 * audit write fails, or migration 0040 has not been applied yet, the customer's
 * own download is not blocked; the failure is logged once. The row holds no
 * report content and never the access token.
 */
export async function appendReportDownloadAudit(row: InsertReportDownloadAudit): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(reportDownloadAudit).values(row);
  } catch (err) {
    if (!downloadAuditWarned) {
      downloadAuditWarned = true;
      console.warn("[reportDownloadAudit] could not record a report access (is migration 0040 applied?):", err instanceof Error ? err.message : err);
    }
  }
}

export async function getAiScanById(id: number): Promise<AiScan | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(aiScans)
    .where(eq(aiScans.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Engine side update. When the patch carries a `reportStatus` the change and
 * its history row are written in one transaction, so the history can never
 * disagree with the column. The engine is the only caller that passes it, and
 * it never passes a human only step (approve, publish, archive).
 */
export async function updateAiScanStatus(
  id: number,
  patch: Partial<
    Pick<
      AiScan,
      | "status"
      | "reportPayload"
      | "overallScore"
      | "errorMessage"
      | "scoredAt"
      | "reportStatus"
    >
  >,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  if (!patch.reportStatus) {
    await db.update(aiScans).set(patch).where(eq(aiScans.id, id));
    return;
  }
  await db.transaction(async (tx) => {
    const cur = (await tx.select({ s: aiScans.reportStatus }).from(aiScans).where(eq(aiScans.id, id)).for("update").limit(1))[0];
    await tx.update(aiScans).set(patch).where(eq(aiScans.id, id));
    if (cur && cur.s !== patch.reportStatus) {
      await tx.insert(aiScanStatusEvents).values({ scanId: id, fromStatus: cur.s, toStatus: patch.reportStatus!, actorUserId: null });
    }
  });
}

export type ReportTransitionResult =
  | { ok: true; scan: AiScan; from: ReportStatus }
  | { ok: false; code: "NOT_FOUND" | "PRECONDITION_FAILED"; reason: string };

/**
 * A human moves a report along the SRS 9.6 workflow. The row is locked, the
 * move is checked against the allowed transitions, and approval and publication
 * stamp who did it. Publishing requires the report to be approved first, and
 * the person who approved it is recorded separately (BR-009).
 */
export async function transitionAiScanReport(args: {
  scanId: number;
  to: ReportStatus;
  actorUserId: number;
  note: string | null;
}): Promise<ReportTransitionResult | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx): Promise<ReportTransitionResult> => {
    const row = (await tx.select().from(aiScans).where(eq(aiScans.id, args.scanId)).for("update").limit(1))[0];
    if (!row) return { ok: false, code: "NOT_FOUND", reason: "AI Scan not found." };
    const from = row.reportStatus as ReportStatus;
    if (!canMoveReport(from, args.to)) {
      return { ok: false, code: "PRECONDITION_FAILED", reason: `A report that is ${from.replace(/_/g, " ")} cannot move to ${args.to.replace(/_/g, " ")}.` };
    }
    if (args.to === "revision_required" && !args.note?.trim()) {
      return { ok: false, code: "PRECONDITION_FAILED", reason: "Say what needs to change before requesting a revision." };
    }
    if (args.to === "approved" && (row.status !== "ready" || !row.reportPayload)) {
      return { ok: false, code: "PRECONDITION_FAILED", reason: "There is no generated report to approve." };
    }
    const now = new Date();
    const patch: Partial<typeof aiScans.$inferInsert> = { reportStatus: args.to };
    if (args.note !== null) patch.reviewNote = args.note;
    if (args.to === "approved") {
      patch.approvedByUserId = args.actorUserId;
      patch.approvedAt = now;
    }
    if (args.to === "published") patch.publishedAt = now;
    const updated = await tx.update(aiScans).set(patch).where(eq(aiScans.id, args.scanId)).returning();
    await tx.insert(aiScanStatusEvents).values({ scanId: args.scanId, fromStatus: from, toStatus: args.to, actorUserId: args.actorUserId, note: args.note });
    return { ok: true, scan: updated[0]!, from };
  });
}

export async function assignAiScanReviewer(scanId: number, reviewerUserId: number | null): Promise<AiScan | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.update(aiScans).set({ reviewerUserId }).where(eq(aiScans.id, scanId)).returning();
  return rows[0] ?? null;
}

/** Scans in the human review part of the workflow, oldest first so waiting ones surface. */
export async function listAiScansForReview(statuses: ReportStatus[]): Promise<Array<Omit<AiScan, "responses" | "reportPayload" | "userAgent" | "ip">>> {
  const db = await getDb();
  if (!db || statuses.length === 0) return [];
  const rows = await db.select().from(aiScans).where(inArray(aiScans.reportStatus, statuses)).orderBy(aiScans.updatedAt).limit(200);
  return rows.map(({ responses: _r, reportPayload: _p, userAgent: _u, ip: _i, ...rest }) => rest);
}

export async function listAiScanStatusEvents(scanId: number): Promise<AiScanStatusEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiScanStatusEvents).where(and(eq(aiScanStatusEvents.scanId, scanId))).orderBy(desc(aiScanStatusEvents.createdAt), desc(aiScanStatusEvents.id));
}

export async function listRecentAiScans(limit = 50): Promise<AiScan[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiScans)
    .orderBy(desc(aiScans.createdAt))
    .limit(limit);
}

/** Persist the storage key of the generated executive PDF (download cache). */
export async function setAiScanReportPdfKey(
  id: number,
  reportPdfKey: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(aiScans).set({ reportPdfKey }).where(eq(aiScans.id, id));
}

/**
 * Progress of the caller's own scans for the Client Portal (SRS 9.6, 10.9).
 * Matched by the signed in account's email, case insensitively. The report
 * token, which is the key to the report itself, is returned only once the
 * report is Published, so progress never leaks access to an unreleased report.
 */
export async function listAiScanProgressForEmail(email: string) {
  const db = await getDb();
  if (!db || !email) return [];
  const rows = await db
    .select({ id: aiScans.id, tier: aiScans.tier, reportStatus: aiScans.reportStatus, createdAt: aiScans.createdAt, publishedAt: aiScans.publishedAt, reportToken: aiScans.reportToken })
    .from(aiScans)
    .where(sql`lower(${aiScans.email}) = lower(${email})`)
    .orderBy(desc(aiScans.createdAt))
    .limit(20);
  return rows.map(({ reportToken, ...r }) => ({ ...r, reportToken: r.reportStatus === "published" ? reportToken : null }));
}

// ---- Report versions (P06, BR-017) -----------------------------------------------------------------------------

/**
 * Keep the report the engine just produced as the next version of this scan. Best effort for the caller: it
 * throws if the table is missing (migration 0046 not applied), and the engine catches that and carries on.
 */
export async function recordReportVersion(scanId: number, payloadJson: string, overallScore: number | null): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const last = await tx.select({ v: sql<number>`coalesce(max(${aiScanReportVersions.version}), 0)::int` }).from(aiScanReportVersions).where(eq(aiScanReportVersions.scanId, scanId));
    const version = (last[0]?.v ?? 0) + 1;
    await tx.insert(aiScanReportVersions).values({ scanId, version, payload: payloadJson, overallScore });
    return version;
  });
}

/** Versions without their payloads, newest first. */
export async function listReportVersions(scanId: number): Promise<Array<{ version: number; createdAt: Date; overallScore: number | null }>> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ version: aiScanReportVersions.version, createdAt: aiScanReportVersions.createdAt, overallScore: aiScanReportVersions.overallScore })
    .from(aiScanReportVersions)
    .where(eq(aiScanReportVersions.scanId, scanId))
    .orderBy(desc(aiScanReportVersions.version))
    .limit(200);
}

export async function getReportVersionPayload(scanId: number, version: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const r = (await db.select({ payload: aiScanReportVersions.payload }).from(aiScanReportVersions).where(and(eq(aiScanReportVersions.scanId, scanId), eq(aiScanReportVersions.version, version))).limit(1))[0];
  return r?.payload ?? null;
}
