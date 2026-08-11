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
