/**
 * Data Subject Rights — database helpers.
 *
 * No authorisation opinion lives here. Same convention as every other
 * db/*.ts module in this codebase: RBAC is enforced at the tRPC procedure
 * layer, and this file only knows how to read and write rows. The privacy
 * officer check that guards all of this is in server/_core/trpc.ts.
 *
 * The one rule this file does enforce is that the event log is append-only:
 * there is deliberately no update or delete helper for
 * `privacy_request_events`, so no caller can rewrite history by reaching for
 * one.
 */
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";

import {
  privacyOfficerGrants,
  privacyRequestEvents,
  privacyRequests,
  type InsertPrivacyRequest,
  type PrivacyOfficerGrant,
  type PrivacyRequest,
  type PrivacyRequestEvent,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Authorisation grants
// ---------------------------------------------------------------------------

/**
 * The live grant for a user, or null.
 *
 * "Live" means granted and not revoked. Revoked grants are kept because they
 * are the record of who once had access, but they confer nothing.
 */
export async function getActivePrivacyOfficerGrant(
  userId: number,
): Promise<PrivacyOfficerGrant | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(privacyOfficerGrants)
    .where(
      and(eq(privacyOfficerGrants.userId, userId), isNull(privacyOfficerGrants.revokedAt)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Every grant, live and revoked, newest first. For the audit surface. */
export async function listPrivacyOfficerGrants(): Promise<PrivacyOfficerGrant[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(privacyOfficerGrants)
    .orderBy(desc(privacyOfficerGrants.grantedAt));
}

export async function grantPrivacyOfficer(input: {
  userId: number;
  grantedByUserId: number;
  reason: string;
}): Promise<PrivacyOfficerGrant | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(privacyOfficerGrants).values(input).returning();
  return rows[0] ?? null;
}

export async function revokePrivacyOfficer(input: {
  userId: number;
  revokedByUserId: number;
  reason: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(privacyOfficerGrants)
    .set({
      revokedAt: new Date(),
      revokedByUserId: input.revokedByUserId,
      revokedReason: input.reason,
    })
    .where(
      and(
        eq(privacyOfficerGrants.userId, input.userId),
        isNull(privacyOfficerGrants.revokedAt),
      ),
    );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function createPrivacyRequest(
  input: InsertPrivacyRequest,
): Promise<PrivacyRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.insert(privacyRequests).values(input).returning();
  return rows[0] ?? null;
}

export async function getPrivacyRequestById(id: number): Promise<PrivacyRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(privacyRequests).where(eq(privacyRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listPrivacyRequests(opts: { status?: string } = {}): Promise<PrivacyRequest[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(privacyRequests);
  const rows = opts.status
    ? await q.where(eq(privacyRequests.status, opts.status)).orderBy(desc(privacyRequests.receivedAt))
    : await q.orderBy(desc(privacyRequests.receivedAt));
  return rows;
}

/**
 * Patch a request.
 *
 * Takes an explicit field set rather than `Partial<PrivacyRequest>` so that
 * `publicRef`, `receivedAt` and the audit-relevant identity columns cannot be
 * rewritten by a caller passing a wider object than it meant to.
 */
export async function updatePrivacyRequest(
  id: number,
  patch: Partial<
    Pick<
      PrivacyRequest,
      | "requestType"
      | "subjectUserId"
      | "subjectName"
      | "dueAt"
      | "identityVerificationStatus"
      | "identityVerificationNote"
      | "identityVerifiedAt"
      | "identityVerifiedByUserId"
      | "assignedToUserId"
      | "affectedSystemsJson"
      | "actionsTakenJson"
      | "status"
      | "decision"
      | "completedAt"
    >
  >,
): Promise<PrivacyRequest | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(privacyRequests)
    .set(patch)
    .where(eq(privacyRequests.id, id))
    .returning();
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Event log — insert and read only, by design
// ---------------------------------------------------------------------------

export async function appendPrivacyRequestEvent(input: {
  requestId: number;
  actorUserId: number | null;
  event: string;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(privacyRequestEvents).values({
    requestId: input.requestId,
    actorUserId: input.actorUserId,
    event: input.event,
    detail: input.detail ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export async function listPrivacyRequestEvents(
  requestId: number,
): Promise<PrivacyRequestEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(privacyRequestEvents)
    .where(eq(privacyRequestEvents.requestId, requestId))
    .orderBy(privacyRequestEvents.createdAt);
}

// ---------------------------------------------------------------------------
// Locate
// ---------------------------------------------------------------------------

/**
 * Every table that can hold personal data, and the column that identifies the
 * subject in it.
 *
 * Written out rather than derived, because the interesting cases are not
 * derivable. `users` is keyed by both id and email. `contact_submissions` and
 * `bookings` have no user id at all, so an email address is the only handle
 * on a data subject who never held an account. Getting this list wrong means
 * a subject access response that silently omits a table, which is the failure
 * mode worth guarding against.
 *
 * `viaUser` tables are reachable only when the subject has an account;
 * `viaEmail` tables are reachable for anyone.
 */
export const PERSONAL_DATA_SOURCES = [
  { table: "users", viaUser: "id", viaEmail: "email" },
  { table: "contact_submissions", viaUser: null, viaEmail: "email" },
  { table: "bookings", viaUser: null, viaEmail: "email" },
  { table: "leads", viaUser: null, viaEmail: "email" },
  { table: "ai_scans", viaUser: null, viaEmail: "email" },
  { table: "dev_applications", viaUser: null, viaEmail: "email" },
  { table: "login_audit", viaUser: "userId", viaEmail: "identifier" },
  { table: "email_delivery_log", viaUser: null, viaEmail: "recipient" },
  { table: "cookie_consents", viaUser: "userId", viaEmail: null },
  { table: "mfa_factors", viaUser: "userId", viaEmail: null },
  { table: "mfa_recovery_codes", viaUser: "userId", viaEmail: null },
  { table: "mfa_challenges", viaUser: "userId", viaEmail: null },
  { table: "organization_memberships", viaUser: "userId", viaEmail: null },
  { table: "legal_acknowledgements", viaUser: "userId", viaEmail: null },
  { table: "agreement_acceptances", viaUser: "userId", viaEmail: null },
  { table: "client_messages", viaUser: "userId", viaEmail: null },
  { table: "client_notifications", viaUser: "userId", viaEmail: null },
  { table: "client_support_tickets", viaUser: "userId", viaEmail: null },
  { table: "developer_profiles", viaUser: "userId", viaEmail: null },
  { table: "developer_notifications", viaUser: "userId", viaEmail: null },
  { table: "developer_messages", viaUser: "userId", viaEmail: null },
  { table: "developer_audit", viaUser: "userId", viaEmail: null },
  { table: "developer_security_events", viaUser: "userId", viaEmail: null },
] as const;

export interface LocatedRows {
  table: string;
  matchedBy: "user" | "email";
  rows: Record<string, unknown>[];
}

/**
 * Find every row about a subject, across every table above.
 *
 * Reads rather than writes, and deliberately returns whole rows: the point of
 * a subject access response is to show the person what is held, so trimming
 * columns here would defeat it. Redaction, where it is needed, is the
 * caller's decision at export time.
 *
 * Table and column names come from the constant above and never from user
 * input, so the identifier interpolation below cannot be influenced by a
 * caller. The subject's own values are passed as bound parameters.
 */
export async function locatePersonalData(subject: {
  userId: number | null;
  email: string;
}): Promise<LocatedRows[]> {
  const db = await getDb();
  if (!db) return [];

  const out: LocatedRows[] = [];
  const email = subject.email.trim().toLowerCase();

  for (const source of PERSONAL_DATA_SOURCES) {
    // Identifiers come from the constant above and never from caller input;
    // sql.identifier quotes them properly regardless. The subject's own
    // values go through the template as bound parameters, so nothing the
    // caller supplies is ever concatenated into the statement.
    const clauses: SQL[] = [];

    if (source.viaUser && subject.userId !== null) {
      clauses.push(sql`${sql.identifier(source.viaUser)} = ${subject.userId}`);
    }
    if (source.viaEmail) {
      clauses.push(sql`lower(${sql.identifier(source.viaEmail)}) = ${email}`);
    }
    if (clauses.length === 0) continue;

    const where = clauses.reduce((acc, clause, i) =>
      i === 0 ? clause : sql`${acc} OR ${clause}`,
    );

    try {
      const result = await db.execute(
        sql`SELECT * FROM ${sql.identifier(source.table)} WHERE ${where} LIMIT 1000`,
      );
      // Drizzle's execute returns either an array or a { rows } envelope
      // depending on the driver; normalise rather than assume.
      const rows =
        (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
      if (rows.length > 0) {
        out.push({
          table: source.table,
          matchedBy: source.viaUser && subject.userId !== null ? "user" : "email",
          rows: rows as Record<string, unknown>[],
        });
      }
    } catch (err) {
      // A table missing from this environment must not abort the whole
      // locate: a partial result naming the tables it did read is far more
      // useful than no result at all.
      console.warn(`[Privacy] Could not read ${source.table}:`, err);
    }
  }

  return out;
}
