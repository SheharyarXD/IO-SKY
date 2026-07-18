/**
 * server/db/crm.ts
 *
 * Database helpers for CRM / lead capture.
 * Covers: leads, contact submissions, and dev applications (Engineering Access).
 */
import { desc, eq } from "drizzle-orm";
import {
  contactSubmissions,
  devApplications,
  leads,
  type ContactSubmission,
  type DevApplication,
  type InsertContactSubmission,
  type InsertDevApplication,
  type InsertLead,
  type Lead,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function createLead(input: InsertLead): Promise<Lead | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create lead: database not available");
    return null;
  }
  const result = await db.insert(leads).values(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId =
    (result as unknown as any)[0]?.insertId ??
    (result as unknown as any).insertId;
  if (!insertId) return null;
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.id, Number(insertId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRecentLeads(limit = 100): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Contact submissions
// ---------------------------------------------------------------------------

export async function createContactSubmission(
  input: InsertContactSubmission,
): Promise<ContactSubmission | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(contactSubmissions).values(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId =
    (result as unknown as any)[0]?.insertId ??
    (result as unknown as any).insertId;
  if (!insertId) return null;
  const rows = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, Number(insertId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function markContactEmailSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(contactSubmissions)
    .set({ emailSent: 1 })
    .where(eq(contactSubmissions.id, id));
}

export async function markContactOwnerNotified(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(contactSubmissions)
    .set({ ownerNotified: 1 })
    .where(eq(contactSubmissions.id, id));
}

export async function listRecentContactSubmissions(
  limit = 100,
): Promise<ContactSubmission[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contactSubmissions)
    .orderBy(desc(contactSubmissions.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Dev applications (Engineering Access)
// ---------------------------------------------------------------------------

export async function createDevApplication(
  input: InsertDevApplication,
): Promise<DevApplication | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(devApplications).values(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId =
    (result as unknown as any)[0]?.insertId ??
    (result as unknown as any).insertId;
  if (!insertId) return null;
  const rows = await db
    .select()
    .from(devApplications)
    .where(eq(devApplications.id, Number(insertId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function markDevAppOwnerNotified(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(devApplications)
    .set({ ownerNotified: 1 })
    .where(eq(devApplications.id, id));
}

export async function updateDevAppStatus(
  id: number,
  status: "pending" | "in_review" | "approved" | "rejected",
  reviewerNote?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(devApplications)
    .set({
      status,
      reviewerNote: reviewerNote ?? null,
    })
    .where(eq(devApplications.id, id));
}

export async function listRecentDevApplications(
  limit = 100,
): Promise<DevApplication[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(devApplications)
    .orderBy(desc(devApplications.createdAt))
    .limit(limit);
}
