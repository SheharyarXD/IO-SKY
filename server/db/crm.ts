/**
 * server/db/crm.ts
 *
 * Database helpers for CRM / lead capture.
 * Covers: leads, contact submissions, and dev applications (Engineering Access).
 */
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import {
  contactSubmissions,
  devApplications,
  leads,
  users,
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
  const rows = await db.insert(leads).values(input).returning();
  return rows[0] ?? null;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(leads).where(eq(leads.id, id)).limit(1))[0] ?? null;
}

/**
 * Leads that share an email address or a phone line with the probe, newest
 * first (at most 5). Email compares case-insensitively; phone compares the
 * identifying digits, so formatting and country prefixes do not matter. Used to
 * deduplicate before a lead is created (task R18).
 */
export async function findLeadsByContact(a: { email: string | null; phoneKey: string | null }): Promise<Lead[]> {
  const db = await getDb();
  if (!db) return [];
  const conds = [];
  if (a.email) conds.push(sql`lower(${leads.email}) = ${a.email}`);
  if (a.phoneKey) {
    const digits = sql`regexp_replace(coalesce(${leads.phone}, ''), '[^0-9]', '', 'g')`;
    conds.push(a.phoneKey.length >= 9 ? sql`right(${digits}, 9) = ${a.phoneKey}` : sql`${digits} = ${a.phoneKey}`);
  }
  if (conds.length === 0) return [];
  return db.select().from(leads).where(or(...conds)).orderBy(desc(leads.createdAt)).limit(5);
}

/** True when this email belongs to a signed-in client account: protected, never described to an unverified caller. */
export async function isExistingClientEmail(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const row = (await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, eq(users.role, "client"))).limit(1))[0];
  return Boolean(row);
}

/**
 * Fill details that are EMPTY on a lead and report which were filled. It never
 * overwrites a value a person or an earlier conversation recorded, and never
 * touches name, email, status or notes. Null when the lead does not exist.
 */
export async function fillLeadBlanks(id: number, patch: { company?: string; phone?: string; interest?: string }): Promise<string[] | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(leads).where(eq(leads.id, id)).limit(1))[0];
  if (!row) return null;
  const set: Record<string, string> = {};
  const conds = [eq(leads.id, id)];
  const blank = (v: string | null) => v === null || v.trim() === "";
  if (patch.company && blank(row.company)) { set.company = patch.company; conds.push(or(isNull(leads.company), eq(leads.company, ""))!); }
  if (patch.phone && blank(row.phone)) { set.phone = patch.phone; conds.push(or(isNull(leads.phone), eq(leads.phone, ""))!); }
  if (patch.interest && blank(row.interest)) { set.interest = patch.interest; conds.push(or(isNull(leads.interest), eq(leads.interest, ""))!); }
  if (Object.keys(set).length === 0) return [];
  const updated = await db.update(leads).set({ ...set, updatedAt: new Date() }).where(and(...conds)).returning({ id: leads.id });
  return updated.length ? Object.keys(set) : [];
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
  const rows = await db.insert(contactSubmissions).values(input).returning();
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
  const rows = await db.insert(devApplications).values(input).returning();
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
