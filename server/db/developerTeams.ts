/**
 * server/db/developerTeams.ts (task J03). Persistence for developer teams. The rules
 * that decide (roster invariants, who may be primary contact, what removal needs)
 * are in shared/teamRules.ts; each operation loads the active roster, asks the
 * rules for the new roster and writes only the difference, in one transaction.
 *
 * Nothing is deleted: a removed member keeps their row with a removal date.
 * Migration 0044 enforces one active seat per developer and one primary contact
 * per team in the database as well, so two simultaneous edits cannot break it.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { developerProfiles, developerTeamMembers, developerTeams } from "../../drizzle/schema";
import { addMember, removeMember, setPrimaryContact, setRole, validateTeamName, type Member, type MemberRefusal, type RosterChange, type TeamRole } from "../../shared/teamRules";
import { isUniqueViolation } from "./bookings";
import { getDb } from "./connection";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function loadRoster(tx: Tx, teamId: number): Promise<Member[]> {
  const rows = await tx.select().from(developerTeamMembers).where(and(eq(developerTeamMembers.teamId, teamId), eq(developerTeamMembers.status, "active"))).orderBy(asc(developerTeamMembers.id));
  return rows.map((r) => ({ developerId: r.developerId, role: r.role as TeamRole, primaryContact: r.primaryContact }));
}

/** Write the difference between two rosters. Order matters for the primary-contact unique index: clear first, set after. */
async function writeRoster(tx: Tx, teamId: number, before: Member[], after: Member[], actorUserId: number): Promise<void> {
  const now = new Date();
  const afterBy = new Map(after.map((m) => [m.developerId, m]));
  const beforeBy = new Map(before.map((m) => [m.developerId, m]));
  // 1. removals, and anyone who stops being the primary contact
  for (const b of before) {
    const a = afterBy.get(b.developerId);
    if (!a) {
      await tx.update(developerTeamMembers).set({ status: "removed", primaryContact: false, removedAt: now }).where(and(eq(developerTeamMembers.teamId, teamId), eq(developerTeamMembers.developerId, b.developerId), eq(developerTeamMembers.status, "active")));
    } else if (b.primaryContact && !a.primaryContact) {
      await tx.update(developerTeamMembers).set({ primaryContact: false }).where(and(eq(developerTeamMembers.teamId, teamId), eq(developerTeamMembers.developerId, b.developerId), eq(developerTeamMembers.status, "active")));
    }
  }
  // 2. additions, role changes and the new primary contact
  for (const a of after) {
    const b = beforeBy.get(a.developerId);
    if (!b) {
      await tx.insert(developerTeamMembers).values({ teamId, developerId: a.developerId, role: a.role, primaryContact: a.primaryContact, addedByUserId: actorUserId });
    } else if (b.role !== a.role || (!b.primaryContact && a.primaryContact)) {
      await tx.update(developerTeamMembers).set({ role: a.role, primaryContact: a.primaryContact }).where(and(eq(developerTeamMembers.teamId, teamId), eq(developerTeamMembers.developerId, a.developerId), eq(developerTeamMembers.status, "active")));
    }
  }
  await tx.update(developerTeams).set({ updatedAt: now }).where(eq(developerTeams.id, teamId));
}

export type TeamOutcome = { ok: true } | { ok: false; reason: MemberRefusal | "team_not_found" | "developer_not_found" | "conflict" | "unavailable" };

async function change(teamId: number, actorUserId: number, plan: (a: { archived: boolean; roster: Member[] }) => Promise<RosterChange> | RosterChange): Promise<TeamOutcome> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  try {
    return await db.transaction(async (tx): Promise<TeamOutcome> => {
      const team = (await tx.select().from(developerTeams).where(eq(developerTeams.id, teamId)).limit(1))[0];
      if (!team) return { ok: false, reason: "team_not_found" };
      const roster = await loadRoster(tx, teamId);
      const result = await plan({ archived: team.status === "archived", roster });
      if (!result.ok) return { ok: false, reason: result.reason };
      await writeRoster(tx, teamId, roster, result.roster, actorUserId);
      return { ok: true };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "conflict" };
    throw err;
  }
}

export async function createTeam(a: { name: string; description: string | null; userId: number }): Promise<{ ok: true; id: number } | { ok: false; reason: "invalid_name" | "name_taken" | "unavailable" }> {
  const v = validateTeamName(a.name);
  if (!v.ok) return { ok: false, reason: "invalid_name" };
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  try {
    const row = (await db.insert(developerTeams).values({ name: v.name, description: a.description?.trim() || null, createdByUserId: a.userId }).returning({ id: developerTeams.id }))[0];
    return { ok: true, id: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "name_taken" };
    throw err;
  }
}

export async function addTeamMember(a: { teamId: number; developerId: number; role: TeamRole; userId: number }): Promise<TeamOutcome> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "unavailable" };
  const dev = (await db.select({ status: developerProfiles.status }).from(developerProfiles).where(eq(developerProfiles.id, a.developerId)).limit(1))[0];
  if (!dev) return { ok: false, reason: "developer_not_found" };
  return change(a.teamId, a.userId, ({ archived, roster }) => addMember({ archived, roster, developerId: a.developerId, role: a.role, developerActive: dev.status === "active" }));
}

export const removeTeamMember = (a: { teamId: number; developerId: number; successorId?: number | null; userId: number }): Promise<TeamOutcome> =>
  change(a.teamId, a.userId, ({ archived, roster }) => removeMember({ archived, roster, developerId: a.developerId, successorId: a.successorId }));

export const setTeamPrimaryContact = (a: { teamId: number; developerId: number; userId: number }): Promise<TeamOutcome> =>
  change(a.teamId, a.userId, ({ archived, roster }) => setPrimaryContact({ archived, roster, developerId: a.developerId }));

export const setTeamMemberRole = (a: { teamId: number; developerId: number; role: TeamRole; userId: number }): Promise<TeamOutcome> =>
  change(a.teamId, a.userId, ({ archived, roster }) => setRole({ archived, roster, developerId: a.developerId, role: a.role }));

/** Archive or restore a team. Restoring fails with name_taken if another active team now has the name. */
export async function setTeamArchived(a: { teamId: number; archived: boolean }): Promise<"ok" | "not_found" | "name_taken" | "unavailable"> {
  const db = await getDb();
  if (!db) return "unavailable";
  try {
    const rows = await db.update(developerTeams).set({ status: a.archived ? "archived" : "active", updatedAt: new Date() }).where(eq(developerTeams.id, a.teamId)).returning({ id: developerTeams.id });
    return rows.length ? "ok" : "not_found";
  } catch (err) {
    if (isUniqueViolation(err)) return "name_taken";
    throw err;
  }
}

export type TeamView = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  members: Array<{ developerId: number; fullName: string; role: string; primaryContact: boolean; joinedAt: Date }>;
  primaryContactName: string | null;
};

async function viewOf(db: Db, teams: Array<{ id: number; name: string; description: string | null; status: string }>): Promise<TeamView[]> {
  if (teams.length === 0) return [];
  const rows = await db
    .select({ teamId: developerTeamMembers.teamId, developerId: developerTeamMembers.developerId, role: developerTeamMembers.role, primaryContact: developerTeamMembers.primaryContact, joinedAt: developerTeamMembers.joinedAt, fullName: developerProfiles.fullName })
    .from(developerTeamMembers)
    .innerJoin(developerProfiles, eq(developerProfiles.id, developerTeamMembers.developerId))
    .where(and(inArray(developerTeamMembers.teamId, teams.map((t) => t.id)), eq(developerTeamMembers.status, "active")))
    .orderBy(asc(developerTeamMembers.id));
  return teams.map((t) => {
    const members = rows.filter((r) => r.teamId === t.id).map(({ teamId: _t, ...m }) => m);
    return { ...t, members, primaryContactName: members.find((m) => m.primaryContact)?.fullName ?? null };
  });
}

export async function listTeams(): Promise<TeamView[]> {
  const db = await getDb();
  if (!db) return [];
  const teams = await db.select({ id: developerTeams.id, name: developerTeams.name, description: developerTeams.description, status: developerTeams.status }).from(developerTeams).orderBy(desc(developerTeams.id)).limit(200);
  return viewOf(db, teams);
}

/** The teams a developer is an active member of (and nothing about any other team). */
export async function listTeamsForDeveloper(developerId: number): Promise<TeamView[]> {
  const db = await getDb();
  if (!db) return [];
  const mine = await db
    .select({ id: developerTeams.id, name: developerTeams.name, description: developerTeams.description, status: developerTeams.status })
    .from(developerTeamMembers)
    .innerJoin(developerTeams, eq(developerTeams.id, developerTeamMembers.teamId))
    .where(and(eq(developerTeamMembers.developerId, developerId), eq(developerTeamMembers.status, "active"), eq(developerTeams.status, "active")));
  return viewOf(db, mine);
}

