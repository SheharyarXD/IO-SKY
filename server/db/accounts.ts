/**
 * Invitation and activation (SRS 8.7). No authorisation opinion here; RBAC lives
 * on the procedures that call these.
 *
 * The activation token is a random secret that exists in the invitee's email and
 * nowhere else. Only its SHA-256 hash is stored, so reading the table gives an
 * attacker nothing they can use as a link.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { accountInvitations, users, type AccountInvitation, type User } from "../../drizzle/schema";
import { INVITATION_TTL_DAYS, invitationState, type InvitableRole, type InvitationState } from "../../shared/srsRules";
import { getDb } from "./connection";

export function hashActivationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvitation(args: {
  email: string;
  role: InvitableRole;
  organizationId: number | null;
  /** Null when the invitation follows a verified payment rather than an administrator action. */
  invitedByUserId: number | null;
  now?: Date;
}): Promise<{ invitation: AccountInvitation; token: string } | "user_exists" | null> {
  const db = await getDb();
  if (!db) return null;
  const now = args.now ?? new Date();
  const email = args.email.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing.length > 0) return "user_exists" as const;
    // A new invitation supersedes any still-pending one for the same address.
    await tx
      .update(accountInvitations)
      .set({ revokedAt: now })
      .where(and(sql`lower(${accountInvitations.email}) = ${email}`, isNull(accountInvitations.acceptedAt), isNull(accountInvitations.revokedAt)));
    const token = randomBytes(32).toString("base64url");
    const rows = await tx
      .insert(accountInvitations)
      .values({
        tokenHash: hashActivationToken(token),
        email,
        role: args.role,
        organizationId: args.organizationId,
        invitedByUserId: args.invitedByUserId,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_DAYS * 86_400_000),
      })
      .returning();
    return { invitation: rows[0]!, token };
  });
}

export async function getInvitationByToken(token: string, now = new Date()): Promise<{ invitation: AccountInvitation; state: InvitationState } | null> {
  const db = await getDb();
  if (!db) return null;
  const row = (await db.select().from(accountInvitations).where(eq(accountInvitations.tokenHash, hashActivationToken(token))).limit(1))[0];
  return row ? { invitation: row, state: invitationState(row, now) } : null;
}

export async function listInvitations(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const rows = await db.select().from(accountInvitations).orderBy(desc(accountInvitations.createdAt)).limit(limit);
  // The hash is not exposed even to admins; there is nothing they could do with it.
  return rows.map(({ tokenHash: _h, ...r }) => ({ ...r, state: invitationState(r, now) }));
}

export async function revokeInvitation(id: number, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .update(accountInvitations)
    .set({ revokedAt: now })
    .where(and(eq(accountInvitations.id, id), isNull(accountInvitations.acceptedAt), isNull(accountInvitations.revokedAt)))
    .returning({ id: accountInvitations.id });
  return rows.length > 0;
}

export type ActivationResult =
  | { ok: true; user: User; invitation: AccountInvitation }
  | { ok: false; reason: "invalid" | "user_exists" };

/**
 * Create the account and consume the invitation in one transaction, with the
 * invitation row locked, so two submissions of the same link cannot both create
 * an account.
 */
export async function activateAccount(args: { token: string; name: string; passwordHash: string; now?: Date }): Promise<ActivationResult | null> {
  const db = await getDb();
  if (!db) return null;
  const now = args.now ?? new Date();
  return db.transaction(async (tx): Promise<ActivationResult> => {
    const inv = (
      await tx.select().from(accountInvitations).where(eq(accountInvitations.tokenHash, hashActivationToken(args.token))).for("update").limit(1)
    )[0];
    if (!inv || invitationState(inv, now) !== "pending") return { ok: false, reason: "invalid" };
    const clash = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${inv.email.toLowerCase()}`).limit(1);
    if (clash.length > 0) return { ok: false, reason: "user_exists" };
    const created = await tx
      .insert(users)
      .values({
        openId: `local:${randomUUID()}`,
        name: args.name,
        email: inv.email.toLowerCase(),
        loginMethod: "local",
        passwordHash: args.passwordHash,
        role: inv.role as User["role"],
        organizationId: inv.organizationId,
        lastSignedIn: now,
      })
      .returning();
    const user = created[0]!;
    const accepted = await tx
      .update(accountInvitations)
      .set({ acceptedAt: now, acceptedUserId: user.id })
      .where(eq(accountInvitations.id, inv.id))
      .returning();
    return { ok: true, user, invitation: accepted[0]! };
  });
}
