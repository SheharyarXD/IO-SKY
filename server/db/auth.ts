/**
 * server/db/auth.ts
 *
 * Database helpers for login / session audit.
 * Covers: appendLoginAudit, listRecentLoginAudit, listLoginAuditForUser.
 */
import { desc, eq } from "drizzle-orm";
import { loginAudit, type InsertLoginAudit } from "../../drizzle/schema";
import { getDb } from "./connection";

export async function appendLoginAudit(input: InsertLoginAudit): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(loginAudit).values(input);
  } catch (error) {
    console.error("[Database] Failed to append login audit:", error);
  }
}

export async function listRecentLoginAudit(
  limit = 100,
): Promise<typeof loginAudit.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(loginAudit)
    .orderBy(desc(loginAudit.createdAt))
    .limit(limit);
}

export async function listLoginAuditForUser(userId: number, limit = 25) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(loginAudit)
    .where(eq(loginAudit.userId, userId))
    .orderBy(desc(loginAudit.createdAt))
    .limit(limit);
}
