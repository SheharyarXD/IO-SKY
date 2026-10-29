/**
 * Rules for the controlled document handoff between a client and the developers
 * working for them (tasks J09 and J10; SRS 15.13, 18.20; 29 Oct Doc 1 Ch10.1,
 * ACC-31 and F-29: client and developer uploads stay private until IO SKY
 * explicitly releases them, and project membership alone confers no access).
 *
 * Pure rules, no I/O. The data layer supplies the facts; these decide.
 */

/** Document lifecycle states, as stored on client_documents.status. */
export const RELEASABLE_STATUS = "approved";

export type ReleaseRefusal = "document_not_approved" | "not_linked" | "organization_mismatch" | "already_released" | "not_staff";

/**
 * May this document be released into this developer project?
 *  - only IO SKY staff release (the client never does, and a developer cannot);
 *  - the document must have passed IO SKY's review (approved), so an unreviewed
 *    upload never crosses the boundary;
 *  - the developer project must be linked to a client project, and that project
 *    must belong to the SAME organisation as the document, so one client's file
 *    cannot be released into another client's project by a wrong selection;
 *  - one active release per document and developer project.
 */
export function evaluateRelease(a: {
  actorRole: string | null | undefined;
  documentStatus: string;
  documentOrganizationId: number;
  /** Organisation of every client project linked to the developer project; empty when it has no link. */
  linkedProjectOrganizationIds: number[];
  alreadyReleased: boolean;
}): { ok: true } | { ok: false; reason: ReleaseRefusal } {
  if (a.actorRole !== "admin" && a.actorRole !== "super_admin") return { ok: false, reason: "not_staff" };
  if (a.documentStatus !== RELEASABLE_STATUS) return { ok: false, reason: "document_not_approved" };
  if (a.linkedProjectOrganizationIds.length === 0) return { ok: false, reason: "not_linked" };
  if (!a.linkedProjectOrganizationIds.includes(a.documentOrganizationId)) return { ok: false, reason: "organization_mismatch" };
  if (a.alreadyReleased) return { ok: false, reason: "already_released" };
  return { ok: true };
}

/**
 * May this developer open this document right now? ALL of these must hold:
 * an active assignment to the developer project, an active release into that
 * project, and the document still approved (a document that was later rejected,
 * superseded by a newer unreviewed version or archived stops being available
 * without anyone having to remember to revoke it).
 */
export function developerMayOpenDocument(a: { assignmentActive: boolean; releaseActive: boolean; documentStatus: string }): boolean {
  return a.assignmentActive && a.releaseActive && a.documentStatus === RELEASABLE_STATUS;
}

export type ReleaseState = "released" | "revoked";

/** A release can only go from released to revoked; a revoked one is final (releasing again makes a new release). */
export function canRevoke(state: string): boolean {
  return state === "released";
}
