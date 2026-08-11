/**
 * server/db/aiScans.ts
 *
 * Database helpers for the AI Scan feature.
 * Covers: create, lookup by token/id, status update, list, PDF key cache.
 */
import { desc, eq } from "drizzle-orm";
import {
  aiScans,
  type AiScan,
  type InsertAiScan,
} from "../../drizzle/schema";
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
    >
  >,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(aiScans).set(patch).where(eq(aiScans.id, id));
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
