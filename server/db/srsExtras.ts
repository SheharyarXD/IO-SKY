/**
 * Discovery Call outcomes, developer task comments and resumable questionnaire
 * drafts (SRS 14.7, 11.7, 9.7). No authorisation opinion here; RBAC lives on
 * the tRPC procedures.
 */
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  aiScanDrafts,
  bookingOutcomes,
  bookings,
  crmActivities,
  developerTaskAssignments,
  developerTaskComments,
  leads,
  type AiScanDraft,
  type BookingOutcome,
  type DeveloperTaskComment,
} from "../../drizzle/schema";
import { draftExpiry, isDraftExpired, type CallOutcome, type TaskCommentKind } from "../../shared/srsRules";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Discovery Call outcomes
// ---------------------------------------------------------------------------

export async function recordCallOutcome(args: {
  bookingId: number;
  outcome: CallOutcome;
  notes: string | null;
  followUpAt: Date | null;
  userId: number;
}): Promise<{ outcome: BookingOutcome; leadId: number | null } | "booking_not_found" | "booking_cancelled" | null> {
  const db = await getDb();
  if (!db) return null;
  return db.transaction(async (tx) => {
    const booking = (await tx.select().from(bookings).where(eq(bookings.id, args.bookingId)).for("update").limit(1))[0];
    if (!booking) return "booking_not_found" as const;
    if (booking.status === "cancelled") return "booking_cancelled" as const;

    const rows = await tx
      .insert(bookingOutcomes)
      .values({ bookingId: args.bookingId, outcome: args.outcome, notes: args.notes, followUpAt: args.followUpAt, recordedByUserId: args.userId })
      .onConflictDoUpdate({
        target: bookingOutcomes.bookingId,
        set: { outcome: args.outcome, notes: args.notes, followUpAt: args.followUpAt, recordedByUserId: args.userId },
      })
      .returning();
    await tx.update(bookings).set({ status: "completed" }).where(eq(bookings.id, args.bookingId));

    // Tie the call to the CRM timeline when the caller is a known lead.
    const lead = (await tx.select({ id: leads.id }).from(leads).where(sql`lower(${leads.email}) = lower(${booking.email})`).limit(1))[0];
    const leadId = lead?.id ?? null;
    if (leadId) {
      await tx.insert(crmActivities).values({
        kind: "meeting",
        subject: `Discovery Call: ${args.outcome.replace(/_/g, " ")}`,
        body: args.notes,
        leadId,
        createdByUserId: args.userId,
        completedAt: new Date(),
      });
      if (args.followUpAt) {
        await tx.insert(crmActivities).values({
          kind: "follow_up",
          subject: `Follow up after Discovery Call (${booking.fullName})`,
          leadId,
          dueAt: args.followUpAt,
          createdByUserId: args.userId,
        });
      }
    }
    return { outcome: rows[0]!, leadId };
  });
}

export async function getCallOutcome(bookingId: number): Promise<BookingOutcome | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(bookingOutcomes).where(eq(bookingOutcomes.bookingId, bookingId)).limit(1))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Developer task comments
// ---------------------------------------------------------------------------

async function developerHoldsTask(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, taskId: number, developerId: number) {
  const r = await db
    .select({ id: developerTaskAssignments.id })
    .from(developerTaskAssignments)
    .where(and(eq(developerTaskAssignments.taskId, taskId), eq(developerTaskAssignments.developerId, developerId), eq(developerTaskAssignments.status, "active")))
    .limit(1);
  return r.length > 0;
}

/** BR-018 again: a developer may only write on, or read, a task they actively hold. */
export async function addTaskCommentByDeveloper(args: {
  taskId: number;
  developerId: number;
  kind: TaskCommentKind;
  body: string;
}): Promise<DeveloperTaskComment | "not_assigned" | null> {
  const db = await getDb();
  if (!db) return null;
  if (!(await developerHoldsTask(db, args.taskId, args.developerId))) return "not_assigned";
  const rows = await db.insert(developerTaskComments).values({ taskId: args.taskId, developerId: args.developerId, kind: args.kind, body: args.body }).returning();
  return rows[0] ?? null;
}

export async function addTaskCommentByStaff(args: { taskId: number; userId: number; body: string }): Promise<DeveloperTaskComment | "task_not_found" | null> {
  const db = await getDb();
  if (!db) return null;
  const exists = await db.select({ id: developerTaskAssignments.id }).from(developerTaskAssignments).where(eq(developerTaskAssignments.taskId, args.taskId)).limit(1);
  // A comment on a task nobody holds would be invisible to everyone it is meant for.
  if (exists.length === 0) return "task_not_found";
  const rows = await db.insert(developerTaskComments).values({ taskId: args.taskId, authorUserId: args.userId, kind: "comment", body: args.body }).returning();
  return rows[0] ?? null;
}

export async function listTaskCommentsForDeveloper(taskId: number, developerId: number): Promise<DeveloperTaskComment[] | "not_assigned"> {
  const db = await getDb();
  if (!db) return [];
  if (!(await developerHoldsTask(db, taskId, developerId))) return "not_assigned";
  return db.select().from(developerTaskComments).where(eq(developerTaskComments.taskId, taskId)).orderBy(asc(developerTaskComments.createdAt));
}

export async function listTaskCommentsForStaff(taskId: number): Promise<DeveloperTaskComment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(developerTaskComments).where(eq(developerTaskComments.taskId, taskId)).orderBy(asc(developerTaskComments.createdAt));
}

// ---------------------------------------------------------------------------
// Resumable questionnaire drafts
// ---------------------------------------------------------------------------

export async function saveAiScanDraft(args: {
  resumeToken?: string;
  tier: string;
  email: string | null;
  answers: Record<string, string>;
  stepIndex: number;
  now?: Date;
}): Promise<{ resumeToken: string; expiresAt: Date } | "expired" | null> {
  const db = await getDb();
  if (!db) return null;
  const now = args.now ?? new Date();
  const expiresAt = draftExpiry(now);
  if (args.resumeToken) {
    const cur = (await db.select().from(aiScanDrafts).where(eq(aiScanDrafts.resumeToken, args.resumeToken)).limit(1))[0];
    if (!cur || isDraftExpired(cur.expiresAt, now)) return "expired";
    await db
      .update(aiScanDrafts)
      .set({ tier: args.tier, email: args.email, answersJson: JSON.stringify(args.answers), stepIndex: args.stepIndex, expiresAt })
      .where(eq(aiScanDrafts.id, cur.id));
    return { resumeToken: cur.resumeToken, expiresAt };
  }
  const resumeToken = randomBytes(24).toString("hex");
  await db.insert(aiScanDrafts).values({ resumeToken, tier: args.tier, email: args.email, answersJson: JSON.stringify(args.answers), stepIndex: args.stepIndex, expiresAt });
  return { resumeToken, expiresAt };
}

export async function loadAiScanDraft(resumeToken: string, now = new Date()): Promise<(Omit<AiScanDraft, "answersJson"> & { answers: Record<string, string> }) | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(aiScanDrafts).where(eq(aiScanDrafts.resumeToken, resumeToken)).limit(1))[0];
  if (!row || isDraftExpired(row.expiresAt, now)) return null;
  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.answersJson);
    if (parsed && typeof parsed === "object") answers = parsed;
  } catch {
    answers = {};
  }
  const { answersJson: _a, ...rest } = row;
  return { ...rest, answers };
}

export async function deleteAiScanDraft(resumeToken: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(aiScanDrafts).where(eq(aiScanDrafts.resumeToken, resumeToken));
}

/** Drafts hold personal data, so expired ones are removed rather than kept. */
export async function purgeExpiredAiScanDrafts(now = new Date()): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.delete(aiScanDrafts).where(lt(aiScanDrafts.expiresAt, now)).returning({ id: aiScanDrafts.id });
  return rows.length;
}
