/**
 * Assigning a whole team to a developer project (task J06; SRS 15.x; 29 Oct Ch12).
 * Pure rules. DECISION (engineering, to be matched against the client document):
 *   - every ACTIVE member of an ACTIVE team who is an active developer is put on the project;
 *   - the team role maps to the project role: lead to lead, member to contributor, reviewer to reviewer;
 *   - the team lead becomes the project lead ONLY if the project has no lead yet. An existing project
 *     lead is never displaced by a team assignment; the team lead joins as a contributor instead;
 *   - someone already on the project keeps their current assignment and is reported as skipped;
 *   - a completed project, an archived team, or an empty team assigns nobody.
 * The plan lists what happens to each person. A preview read shows it before anything is applied, and the
 * applying step recomputes it on the server, so a stale preview can never assign someone it should not.
 */
import type { TeamRole } from "./teamRules";

export type ProjectRole = "lead" | "contributor" | "reviewer";

export type Candidate = { developerId: number; teamRole: TeamRole; developerActive: boolean };

export type Plan =
  | { ok: false; reason: "project_completed" | "team_archived" | "team_empty" | "nothing_to_assign" }
  | {
      ok: true;
      assign: Array<{ developerId: number; role: ProjectRole }>;
      skipped: Array<{ developerId: number; reason: "already_on_project" | "developer_not_active" }>;
    };

export function projectRoleFor(teamRole: TeamRole, projectHasLead: boolean): ProjectRole {
  if (teamRole === "reviewer") return "reviewer";
  if (teamRole === "lead") return projectHasLead ? "contributor" : "lead";
  return "contributor";
}

export function planTeamAssignment(a: {
  projectStatus: string;
  teamArchived: boolean;
  members: Candidate[];
  alreadyOnProject: ReadonlySet<number>;
  projectHasLead: boolean;
}): Plan {
  if (a.projectStatus === "completed") return { ok: false, reason: "project_completed" };
  if (a.teamArchived) return { ok: false, reason: "team_archived" };
  if (a.members.length === 0) return { ok: false, reason: "team_empty" };

  const assign: Array<{ developerId: number; role: ProjectRole }> = [];
  const skipped: Array<{ developerId: number; reason: "already_on_project" | "developer_not_active" }> = [];
  let leadTaken = a.projectHasLead;
  // Leads first, so the project gets a lead before contributors are considered; order is otherwise as listed.
  const ordered = [...a.members].sort((x, y) => Number(y.teamRole === "lead") - Number(x.teamRole === "lead"));
  for (const m of ordered) {
    if (!m.developerActive) skipped.push({ developerId: m.developerId, reason: "developer_not_active" });
    else if (a.alreadyOnProject.has(m.developerId)) skipped.push({ developerId: m.developerId, reason: "already_on_project" });
    else {
      const role = projectRoleFor(m.teamRole, leadTaken);
      if (role === "lead") leadTaken = true;
      assign.push({ developerId: m.developerId, role });
    }
  }
  if (assign.length === 0) return { ok: false, reason: "nothing_to_assign" };
  return { ok: true, assign, skipped };
}

export const PLAN_REFUSAL_TEXT = {
  project_completed: "This project is completed.",
  team_archived: "This team is archived.",
  team_empty: "This team has no members.",
  nothing_to_assign: "Everyone in this team is already on the project or is not an active developer.",
} as const;
