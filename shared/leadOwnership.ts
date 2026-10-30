/**
 * Lead ownership (supports C01 and the follow-up routing in N02). DECISION
 * (engineering, to be matched against the client document): a lead has at most one
 * owner, and the owner is an admin or super admin. Ownership is a separate record,
 * so a lead without one is simply unowned and nothing about the lead itself changes.
 * Assigning, changing and clearing the owner are all recorded.
 */
export function canOwnLeads(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export type OwnerAssignment = { ok: true; ownerUserId: number | null } | { ok: false; reason: "owner_not_staff" | "owner_not_found" };

/** Validate who a lead may be given to. Clearing (null) is always allowed. */
export function planOwnerAssignment(a: { ownerUserId: number | null; ownerRole: string | null | undefined; ownerExists: boolean }): OwnerAssignment {
  if (a.ownerUserId === null) return { ok: true, ownerUserId: null };
  if (!a.ownerExists) return { ok: false, reason: "owner_not_found" };
  if (!canOwnLeads(a.ownerRole)) return { ok: false, reason: "owner_not_staff" };
  return { ok: true, ownerUserId: a.ownerUserId };
}

export const OWNER_REFUSAL_TEXT = {
  owner_not_staff: "A lead can only be owned by an admin or super admin.",
  owner_not_found: "That user does not exist.",
} as const;
