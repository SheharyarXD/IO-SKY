/**
 * server/db/mediatedMessaging.ts (task J07). Persistence for staff-mediated messages. The rules (what must not
 * be revealed, audience limits, the sender name) are in shared/mediatedMessaging.ts.
 *
 * Every operation here writes the messages AND the mediation log row in one transaction, so there is never a
 * message that crossed the boundary without a record. If the log table is missing (migration 0047 not applied)
 * the transaction fails and nothing is sent.
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  clientMessages,
  clientProjects,
  developerMessages,
  developerProfiles,
  developerProjectAssignments,
  developerProjectLinks,
  developerTeamMembers,
  developerTeams,
  messageMediationLog,
  organizations,
  users,
} from "../../drizzle/schema";
import { STAFF_SENDER_NAME, planRecipients, type HiddenIdentity } from "../../shared/mediatedMessaging";
import { getDb } from "./connection";

export type AudienceType = "developer" | "team" | "project";

export async function getDeveloperMessage(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(developerMessages).where(eq(developerMessages.id, id)).limit(1))[0] ?? null;
}

export async function getClientMessage(id: number) {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(clientMessages).where(eq(clientMessages.id, id)).limit(1))[0] ?? null;
}

/**
 * True when the developer actively works on a developer project that staff linked to one of this organization's
 * projects. Developer projects are organization-blind, so without this link a relay could cross between clients.
 */
export async function developerServesOrganization(developerId: number, organizationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: developerProjectAssignments.id })
    .from(developerProjectAssignments)
    .innerJoin(developerProjectLinks, eq(developerProjectLinks.developerProjectId, developerProjectAssignments.projectId))
    .innerJoin(clientProjects, eq(clientProjects.id, developerProjectLinks.clientProjectId))
    .where(and(eq(developerProjectAssignments.developerId, developerId), eq(developerProjectAssignments.status, "active"), eq(clientProjects.organizationId, organizationId)))
    .limit(1);
  return rows.length > 0;
}

/** What the developer's side must not learn about the client. */
export async function clientIdentities(organizationId: number, extraName?: string | null): Promise<HiddenIdentity[]> {
  const db = await getDb();
  if (!db) return [];
  const org = (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, organizationId)).limit(1))[0];
  const out: HiddenIdentity[] = [];
  if (org?.name) out.push({ kind: "company", value: org.name });
  if (extraName) out.push({ kind: "name", value: extraName });
  return out;
}

/** What the client's side must not learn about the developer. */
export async function developerIdentities(developerId: number): Promise<HiddenIdentity[]> {
  const db = await getDb();
  if (!db) return [];
  const row = (await db.select({ fullName: developerProfiles.fullName, email: users.email }).from(developerProfiles).innerJoin(users, eq(users.id, developerProfiles.userId)).where(eq(developerProfiles.id, developerId)).limit(1))[0];
  if (!row) return [];
  const out: HiddenIdentity[] = [{ kind: "name", value: row.fullName }];
  if (row.email) out.push({ kind: "email", value: row.email });
  return out;
}

export async function activeDeveloperIds(type: AudienceType, ref: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  let ids: number[] = [];
  if (type === "developer") ids = [ref];
  else if (type === "team") {
    const team = (await db.select({ status: developerTeams.status }).from(developerTeams).where(eq(developerTeams.id, ref)).limit(1))[0];
    if (!team || team.status !== "active") return [];
    ids = (await db.select({ id: developerTeamMembers.developerId }).from(developerTeamMembers).where(and(eq(developerTeamMembers.teamId, ref), eq(developerTeamMembers.status, "active")))).map((r) => r.id);
  } else {
    ids = (await db.select({ id: developerProjectAssignments.developerId }).from(developerProjectAssignments).where(and(eq(developerProjectAssignments.projectId, ref), eq(developerProjectAssignments.status, "active")))).map((r) => r.id);
  }
  if (ids.length === 0) return [];
  // Only active developers receive anything.
  return (await db.select({ id: developerProfiles.id }).from(developerProfiles).where(and(inArray(developerProfiles.id, ids), eq(developerProfiles.status, "active")))).map((r) => r.id);
}

type Outcome<T> = { ok: true } & T;

/** Staff message to a client's thread, recorded as a relay of a developer's message. */
export async function relayToClient(a: { sourceMessageId: number; developerId: number; organizationId: number; subject: string | null; body: string; actorUserId: number }): Promise<Outcome<{ messageId: number }> | { ok: false; reason: "unavailable" }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  return db.transaction(async (tx) => {
    const m = (await tx.insert(clientMessages).values({ organizationId: a.organizationId, threadKey: "general", sender: "io-sky", senderName: STAFF_SENDER_NAME, subject: a.subject, body: a.body }).returning({ id: clientMessages.id }))[0];
    await tx.insert(messageMediationLog).values({ kind: "developer_to_client", sourceMessageId: a.sourceMessageId, organizationId: a.organizationId, developerId: a.developerId, recipientCount: 1, actorUserId: a.actorUserId });
    return { ok: true as const, messageId: m.id };
  });
}

/** Staff message to a developer's thread, recorded as a relay of a client's message. */
export async function relayToDeveloper(a: { sourceMessageId: number; developerId: number; organizationId: number; subject: string | null; body: string; actorUserId: number }): Promise<Outcome<{ messageId: number }> | { ok: false; reason: "unavailable" }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  return db.transaction(async (tx) => {
    const m = (await tx.insert(developerMessages).values({ developerId: a.developerId, sender: "admin", senderName: STAFF_SENDER_NAME, subject: a.subject, body: a.body }).returning({ id: developerMessages.id }))[0];
    await tx.insert(messageMediationLog).values({ kind: "client_to_developer", sourceMessageId: a.sourceMessageId, organizationId: a.organizationId, developerId: a.developerId, recipientCount: 1, actorUserId: a.actorUserId });
    return { ok: true as const, messageId: m.id };
  });
}

/** One staff message into each recipient's own thread, with a single log row for the whole send. */
export async function broadcastToDevelopers(a: { audienceType: AudienceType; audienceRef: number; subject: string | null; body: string; actorUserId: number }): Promise<Outcome<{ recipients: number[] }> | { ok: false; reason: "no_recipients" | "too_many" | "unavailable" }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  const plan = planRecipients(await activeDeveloperIds(a.audienceType, a.audienceRef));
  if (!plan.ok) return plan;
  return db.transaction(async (tx) => {
    await tx.insert(developerMessages).values(plan.ids.map((developerId) => ({ developerId, sender: "admin" as const, senderName: STAFF_SENDER_NAME, subject: a.subject, body: a.body })));
    await tx.insert(messageMediationLog).values({ kind: "broadcast", audienceType: a.audienceType, audienceRef: a.audienceRef, recipientCount: plan.ids.length, actorUserId: a.actorUserId });
    return { ok: true as const, recipients: plan.ids };
  });
}

export async function listMediationLog(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const { desc } = await import("drizzle-orm");
  return db.select().from(messageMediationLog).orderBy(desc(messageMediationLog.createdAt)).limit(limit);
}
