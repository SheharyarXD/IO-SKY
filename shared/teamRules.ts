/**
 * Developer teams (task J03; SRS 15.18; 29 Oct Ch12): create a team, manage its
 * members and roles, and keep exactly one primary contact. Pure rules, no I/O.
 *
 *  - A team with active members always has exactly one primary contact. The
 *    primary contact must be an active member, so there is always one named
 *    person to reach, and never a stale one.
 *  - Removing the primary contact needs a successor from the remaining members
 *    (unless they are the last member). Nothing is left unowned by accident.
 *  - A member is removed, not deleted: the row stays with the date, so the team
 *    history can be read later (same principle as project assignments).
 *  - An archived team accepts no new members and no changes to its roster.
 */

export const TEAM_ROLES = ["lead", "member", "reviewer"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_NAME = { min: 2, max: 80 } as const;

export const cleanTeamName = (n: string | null | undefined): string => (n ?? "").replace(/\s+/g, " ").trim();

export function validateTeamName(n: string | null | undefined): { ok: true; name: string } | { ok: false; reason: "too_short" | "too_long" | "invalid_characters" } {
  const name = cleanTeamName(n);
  if (name.length < TEAM_NAME.min) return { ok: false, reason: "too_short" };
  if (name.length > TEAM_NAME.max) return { ok: false, reason: "too_long" };
  // Letters, digits, spaces and common punctuation only: a team name is shown to developers.
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,&'()\-_/]*$/u.test(name)) return { ok: false, reason: "invalid_characters" };
  return { ok: true, name };
}

export type Member = { developerId: number; role: TeamRole; primaryContact: boolean };

export type MemberRefusal = "team_archived" | "already_member" | "developer_not_active" | "not_a_member" | "successor_required" | "successor_not_member" | "same_person";

export type RosterChange = { ok: true; roster: Member[]; primaryContactId: number | null } | { ok: false; reason: MemberRefusal };

const finish = (roster: Member[]): RosterChange => ({ ok: true, roster, primaryContactId: roster.find((m) => m.primaryContact)?.developerId ?? null });

/** Add a member. The first member of a team becomes its primary contact. */
export function addMember(a: { archived: boolean; roster: Member[]; developerId: number; role: TeamRole; developerActive: boolean }): RosterChange {
  if (a.archived) return { ok: false, reason: "team_archived" };
  if (!a.developerActive) return { ok: false, reason: "developer_not_active" };
  if (a.roster.some((m) => m.developerId === a.developerId)) return { ok: false, reason: "already_member" };
  const first = a.roster.length === 0;
  return finish([...a.roster, { developerId: a.developerId, role: a.role, primaryContact: first }]);
}

/** Remove a member. The primary contact can leave only when a successor from the rest is named, or when they are the last member. */
export function removeMember(a: { archived: boolean; roster: Member[]; developerId: number; successorId?: number | null }): RosterChange {
  if (a.archived) return { ok: false, reason: "team_archived" };
  const leaving = a.roster.find((m) => m.developerId === a.developerId);
  if (!leaving) return { ok: false, reason: "not_a_member" };
  const rest = a.roster.filter((m) => m.developerId !== a.developerId);
  if (rest.length === 0) return finish([]);
  if (!leaving.primaryContact) return finish(rest);
  if (a.successorId == null) return { ok: false, reason: "successor_required" };
  if (a.successorId === a.developerId) return { ok: false, reason: "same_person" };
  if (!rest.some((m) => m.developerId === a.successorId)) return { ok: false, reason: "successor_not_member" };
  return finish(rest.map((m) => ({ ...m, primaryContact: m.developerId === a.successorId })));
}

/** Make an existing member the primary contact; the previous one stays a member. */
export function setPrimaryContact(a: { archived: boolean; roster: Member[]; developerId: number }): RosterChange {
  if (a.archived) return { ok: false, reason: "team_archived" };
  if (!a.roster.some((m) => m.developerId === a.developerId)) return { ok: false, reason: "not_a_member" };
  return finish(a.roster.map((m) => ({ ...m, primaryContact: m.developerId === a.developerId })));
}

/** Change a member's role. The primary contact flag is unaffected. */
export function setRole(a: { archived: boolean; roster: Member[]; developerId: number; role: TeamRole }): RosterChange {
  if (a.archived) return { ok: false, reason: "team_archived" };
  if (!a.roster.some((m) => m.developerId === a.developerId)) return { ok: false, reason: "not_a_member" };
  return finish(a.roster.map((m) => (m.developerId === a.developerId ? { ...m, role: a.role } : m)));
}

/** True when a roster satisfies the invariant. Used to check stored data and as a test oracle. */
export function rosterIsValid(roster: Member[]): boolean {
  const ids = roster.map((m) => m.developerId);
  if (new Set(ids).size !== ids.length) return false;
  const primaries = roster.filter((m) => m.primaryContact).length;
  return roster.length === 0 ? primaries === 0 : primaries === 1;
}

export const MEMBER_REFUSAL_TEXT: Record<MemberRefusal, string> = {
  team_archived: "This team is archived. Restore it before changing its members.",
  already_member: "That developer is already in the team.",
  developer_not_active: "Only active developers can join a team.",
  not_a_member: "That developer is not in the team.",
  successor_required: "Choose who becomes the primary contact before removing the current one.",
  successor_not_member: "The new primary contact must be a current member of the team.",
  same_person: "Choose a different person as the new primary contact.",
};
