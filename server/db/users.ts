/**
 * server/db/users.ts
 *
 * Database helpers for the `users` table.
 * Covers: upsert on OAuth login, lookup by openId / email, display-name
 * update, MFA-method update, and last-signed-in touch.
 */
import { eq } from "drizzle-orm";
import { InsertUser, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb } from "./connection";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    // Postgres: onDuplicateKeyUpdate (MySQL) -> onConflictDoUpdate, targeting
    // the unique column that would actually collide (openId).
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * RM-50: lookup a user by their linked Supabase Auth identity
 * (users.authUserId, a uuid pointing at auth.users.id).
 */
export async function getUserByAuthUserId(authUserId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * RM-50: link an existing (Manus-era) user row to its Supabase Auth
 * identity — used the first time that user successfully signs in via
 * Supabase (matched by email). Does not touch role/openId/anything else.
 */
export async function linkAuthUserId(
  userId: number,
  authUserId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ authUserId }).where(eq(users.id, userId));
}

/**
 * RM-50: create a brand-new `users` row for a Supabase-native identity that
 * has no prior Manus-era account (no existing row matched by authUserId or
 * email). `openId` is still populated (it's `NOT NULL UNIQUE` — see
 * drizzle/schema.ts) with a synthetic `supabase:<authUserId>` value so every
 * piece of downstream code that still keys off `openId` (session cookies,
 * audit logs, role redirects) keeps working unchanged — see
 * server/_core/supabaseAuthRoute.ts's file header for the full rationale.
 *
 * Role defaults to "user", same as every other new account — there is no
 * Supabase-identity equivalent of the Manus-only `OWNER_OPEN_ID`
 * auto-admin-promotion in upsertUser() above (that comparison is against
 * the Manus openId specifically); promoting a Supabase-native owner account
 * to admin is a manual/admin-panel action, not something this function
 * should guess at.
 */
export async function createUserFromSupabase(input: {
  authUserId: string;
  email: string | null;
  name?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("[Database] Cannot create user: database not available");
  }
  const rows = await db
    .insert(users)
    .values({
      openId: `supabase:${input.authUserId}`,
      authUserId: input.authUserId,
      email: input.email,
      name: input.name ?? null,
      loginMethod: "supabase",
      lastSignedIn: new Date(),
    })
    .returning();
  return rows[0];
}

/**
 * Lookup a user by email address for local-password authentication.
 * Returns undefined when the user doesn't exist or hasn't been issued
 * a password (OAuth-only accounts).
 */
export async function getUserByEmailWithPassword(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Update lastSignedIn timestamp after a successful local-password login. */
export async function touchUserLastSignedIn(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Allow the logged-in user to refresh their own display name.
 * We do not let the portal mutate e-mail (it is the OAuth identity) or
 * organizationId (only an admin should change tenancy).
 * Returns nothing — the mutation is idempotent and read-back happens via
 * auth.me on the next request.
 */
export async function updateUserDisplayName(
  userId: number,
  name: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

/**
 * Set or clear the profile photo storage key.
 *
 * Stamps `avatarUpdatedAt` alongside it so a client can cache-bust a changed
 * photo without the server having to mint a new storage key every time. Both
 * columns are cleared together when the key is null: an updated-at with no
 * key would describe a photo that is not there.
 */
export async function updateUserAvatarKey(
  userId: number,
  avatarKey: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({
      avatarKey,
      avatarUpdatedAt: avatarKey === null ? null : new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Update the MFA method stored on the user row.
 * Used by the Security Center when the user enables/disables MFA.
 */
export async function updateUserMfaMethod(
  userId: number,
  method: "none" | "email" | "totp" | "sms",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ mfaMethod: method })
    .where(eq(users.id, userId));
}

/**
 * Milestone 2 §2.5 — role/permission management. Gated at the caller
 * (server/routers/admin.ts's superAdmin router) to super_admin only - this
 * helper itself has no authorization opinion, same convention as every
 * other db/*.ts helper in this codebase (RBAC is enforced at the tRPC
 * procedure layer, not the DB layer, which only enforces tenant isolation
 * via RLS). Returns the updated row so the caller can audit the before/
 * after role change.
 */
export async function setUserRole(
  userId: number,
  role: "user" | "client" | "developer" | "admin" | "super_admin" | "technical_operator",
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Milestone 2 §2.5 — assigns (or clears, via organizationId: null) a
 * user's tenant. This is the missing piece that makes a newly-created
 * organization (server/db/clientPortal.ts's createOrganization) actually
 * usable - before this, a client-role account had no way to ever get an
 * organizationId at all short of a hand-run SQL update. Does not change
 * role - the caller decides separately whether the user should also become
 * role="client" (matches every existing "one thing per mutation" admin.ts
 * convention rather than silently bundling two decisions into one call).
 */
export async function assignUserOrganization(
  userId: number,
  organizationId: number | null,
) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .update(users)
    .set({ organizationId, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return rows[0] ?? null;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? undefined;
}

/**
 * Milestone 3 §3.3 (RM-90): revoke every outstanding session for a user.
 *
 * Session cookies are stateless signed JWTs, so there is nothing to delete —
 * revocation works by stamping a cutoff that `sdk.authenticateRequest()`
 * compares each token's `iat` against. Call this on logout, on password
 * change, and on admin-forced sign-out.
 *
 * Idempotent: calling it repeatedly just moves the cutoff forward.
 *
 * Returns `false` when there is no database connection so callers can decide
 * whether that is fatal. Logout deliberately treats it as non-fatal — the
 * cookie is still cleared, which is exactly the behaviour that existed before
 * this function did — but it logs, because a logout that silently fails to
 * revoke is the failure mode RM-90 exists to remove.
 */
export async function revokeUserSessions(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db
    .update(users)
    .set({ sessionsRevokedAtMs: Date.now() })
    .where(eq(users.id, userId));
  return true;
}

/**
 * Same as revokeUserSessions but keyed by the session's own identifier, so
 * logout paths that only hold the cookie's `openId` do not need a second
 * lookup round-trip first.
 */
export async function revokeUserSessionsByOpenId(openId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db
    .update(users)
    .set({ sessionsRevokedAtMs: Date.now() })
    .where(eq(users.openId, openId));
  return true;
}
