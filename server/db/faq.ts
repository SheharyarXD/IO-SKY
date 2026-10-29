/**
 * server/db/faq.ts (task R17). Persistence for the approved FAQ store. The rules
 * that decide (matching, workflow, what an edit does) are in shared/faqRules.ts.
 *
 * Reads used by an agent fail closed: any error, including a missing table
 * because migration 0042 is not applied, returns no entries, so the assistant
 * says it does not have the information rather than answering from anything else.
 */
import { asc, desc, eq } from "drizzle-orm";
import { faqEntries, faqEvents } from "../../drizzle/schema";
import { statusAfterEdit, transitionFaq, type FaqAction, type FaqAudience, type FaqEntry, type FaqStatus } from "../../shared/faqRules";
import { getDb } from "./connection";

type Row = typeof faqEntries.$inferSelect;

export function parseKeywords(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function toEntry(r: Row): FaqEntry {
  return { id: r.id, question: r.question, answer: r.answer, keywords: parseKeywords(r.keywords), audience: r.audience as FaqAudience, status: r.status as FaqStatus, version: r.version, lastEditedByUserId: r.lastEditedByUserId, approvedByUserId: r.approvedByUserId };
}

/** Approved entries only: the only rows an agent can ever be given. */
export async function listApprovedFaq(): Promise<FaqEntry[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    return (await db.select().from(faqEntries).where(eq(faqEntries.status, "approved")).orderBy(asc(faqEntries.id)).limit(500)).map(toEntry);
  } catch (err) {
    console.error("[faq] approved entries unavailable:", (err as Error).message);
    return [];
  }
}

export async function listFaqForReview(status?: FaqStatus): Promise<Array<FaqEntry & { approvedAt: Date | null; updatedAt: Date }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = status ? await db.select().from(faqEntries).where(eq(faqEntries.status, status)).orderBy(desc(faqEntries.updatedAt)).limit(500) : await db.select().from(faqEntries).orderBy(desc(faqEntries.updatedAt)).limit(500);
  return rows.map((r) => ({ ...toEntry(r), approvedAt: r.approvedAt, updatedAt: r.updatedAt }));
}

export async function getFaq(id: number): Promise<FaqEntry | null> {
  const db = await getDb();
  if (!db) return null;
  const r = (await db.select().from(faqEntries).where(eq(faqEntries.id, id)).limit(1))[0];
  return r ? toEntry(r) : null;
}

async function event(faqId: number, name: string, version: number, actorUserId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(faqEvents).values({ faqId, event: name.slice(0, 40), version, actorUserId });
}

export async function createFaq(a: { question: string; answer: string; keywords: string[]; audience: FaqAudience; userId: number }): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.insert(faqEntries).values({ question: a.question, answer: a.answer, keywords: JSON.stringify(a.keywords), audience: a.audience, status: "draft", version: 1, lastEditedByUserId: a.userId }).returning({ id: faqEntries.id }))[0];
  await event(row.id, "faq.created", 1, a.userId);
  return row;
}

/** Edit wording, audience or keywords. A real change returns an approved or in-review entry to draft. */
export async function editFaq(a: { id: number; question?: string; answer?: string; keywords?: string[]; audience?: FaqAudience; userId: number }): Promise<{ status: FaqStatus; version: number; changed: boolean } | null> {
  const db = await getDb();
  if (!db) return null;
  const cur = await getFaq(a.id);
  if (!cur) return null;
  const next = {
    question: a.question ?? cur.question,
    answer: a.answer ?? cur.answer,
    keywords: a.keywords ?? cur.keywords,
    audience: a.audience ?? cur.audience,
  };
  const changed = next.question !== cur.question || next.answer !== cur.answer || next.audience !== cur.audience || JSON.stringify(next.keywords) !== JSON.stringify(cur.keywords);
  if (!changed) return { status: cur.status, version: cur.version, changed: false };
  const after = statusAfterEdit(cur.status, true);
  const version = cur.version + (after.bumpVersion ? 1 : 0);
  await db
    .update(faqEntries)
    .set({ ...next, keywords: JSON.stringify(next.keywords), status: after.status, version, lastEditedByUserId: a.userId, approvedByUserId: null, approvedAt: null, updatedAt: new Date() })
    .where(eq(faqEntries.id, a.id));
  await event(a.id, `faq.edited:${cur.status}->${after.status}`, version, a.userId);
  return { status: after.status, version, changed: true };
}

export type FaqDecision = { ok: true; status: FaqStatus; version: number } | { ok: false; reason: "not_found" | "invalid_transition" | "self_approval" | "not_staff" | "unavailable" };

export async function decideFaq(a: { id: number; action: FaqAction; userId: number; role: string | null | undefined }): Promise<FaqDecision> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  const cur = await getFaq(a.id);
  if (!cur) return { ok: false, reason: "not_found" };
  const t = transitionFaq({ status: cur.status, action: a.action, actorUserId: a.userId, actorRole: a.role, lastEditedByUserId: cur.lastEditedByUserId });
  if (!t.ok) return { ok: false, reason: t.reason };
  const approving = t.to === "approved";
  await db
    .update(faqEntries)
    .set({ status: t.to, approvedByUserId: approving ? a.userId : null, approvedAt: approving ? new Date() : null, updatedAt: new Date() })
    .where(eq(faqEntries.id, a.id));
  await event(a.id, t.audit, cur.version, a.userId);
  return { ok: true, status: t.to, version: cur.version };
}

export async function listFaqEvents(faqId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faqEvents).where(eq(faqEvents.faqId, faqId)).orderBy(desc(faqEvents.createdAt)).limit(200);
}
