/**
 * Review and Publish as independent permissions (task P07; SRS BR-009, BR-016;
 * 29 Oct Ch13.3, F-23). Pure rules.
 *
 * DECISION (engineering, to be matched against the client document): reviewing a
 * report and publishing it to the customer are different rights.
 *   - REVIEW (approve, request a revision, archive): every admin and super admin,
 *     as before, so nobody loses a working ability.
 *   - PUBLISH (make it visible to the customer and email them): a super admin, or an
 *     admin who has been given the `report:publish` right. The right is granted and
 *     revoked by a super admin, can expire, and every grant and revocation is
 *     recorded. An admin without it can review but is refused when publishing,
 *     both in the API and in the screen.
 * The right is not given to technical operators, developers or clients.
 */
import { scopeIsActive, type ScopeGrant } from "./platformRules";

export const REPORT_PUBLISH_SCOPE = "report:publish";
export const REPORT_SCOPES = [REPORT_PUBLISH_SCOPE] as const;

export const isReportScope = (s: string): boolean => (REPORT_SCOPES as readonly string[]).includes(s);

/** Roles a report right can be granted to. Super admins hold it implicitly. */
export const REPORT_SCOPE_GRANTEE_ROLE = "admin";

export type ReportAction = "review" | "publish";

/** Approving, sending back and archiving are review; making it visible to the customer is publish. */
export function actionFor(to: string): ReportAction {
  return to === "published" ? "publish" : "review";
}

export type ReportAuthorization = { allowed: true } | { allowed: false; reason: "not_staff" | "publish_right_required" };

export function authorizeReportAction(a: { role: string | null | undefined; action: ReportAction; grants: ScopeGrant[]; now?: Date }): ReportAuthorization {
  if (a.role !== "admin" && a.role !== "super_admin") return { allowed: false, reason: "not_staff" };
  if (a.action === "review") return { allowed: true };
  if (a.role === "super_admin") return { allowed: true };
  const held = a.grants.some((g) => g.scope === REPORT_PUBLISH_SCOPE && scopeIsActive(g, a.now ?? new Date()));
  return held ? { allowed: true } : { allowed: false, reason: "publish_right_required" };
}

export const REPORT_REFUSAL_TEXT = {
  not_staff: "Only IO SKY staff can act on a report.",
  publish_right_required: "You can review this report, but publishing needs the publish right. Ask a super admin to grant it.",
} as const;
