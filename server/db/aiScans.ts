/**
 * server/db/aiScans.ts
 *
 * Database helpers for the AI Scan feature.
 * Covers: create, lookup by token/id, status update, list, PDF key cache.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  aiScans,
  aiScanStatusEvents,
  type AiScan,
  type AiScanStatusEvent,
  type InsertAiScan,
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
