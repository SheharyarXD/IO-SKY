/*
 * J06 (SRS 15.x; 29 Oct Ch12): putting a whole team on a developer project. Pure
 * rules plus the endpoints with the data layer mocked. The reads in
 * previewTeamAssignment have not run against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_REFUSAL_TEXT, planTeamAssignment, projectRoleFor, type Candidate } from "../shared/teamAssignment";

const cand = (developerId: number, teamRole: Candidate["teamRole"] = "member", developerActive = true): Candidate => ({ developerId, teamRole, developerActive });
const plan = (over: Partial<Parameters<typeof planTeamAssignment>[0]> = {}) =>
  planTeamAssignment({ projectStatus: "active", teamArchived: false, members: [cand(1, "lead"), cand(2), cand(3, "reviewer")], alreadyOnProject: new Set(), projectHasLead: false, ...over });

describe("role mapping", () => {
  it("lead to lead only when the project has none; otherwise contributor", () => {
    expect(projectRoleFor("lead", false)).toBe("lead");
    expect(projectRoleFor("lead", true)).toBe("contributor");
    expect(projectRoleFor("member", false)).toBe("contributor");
    expect(projectRoleFor("member", true)).toBe("contributor");
    expect(projectRoleFor("reviewer", false)).toBe("reviewer");
    expect(projectRoleFor("reviewer", true)).toBe("reviewer");
  });
});

describe("planTeamAssignment", () => {
  it("assigns everyone with a mapped role, the team lead becoming project lead", () => {
    expect(plan()).toEqual({
      ok: true,
      assign: [{ developerId: 1, role: "lead" }, { developerId: 2, role: "contributor" }, { developerId: 3, role: "reviewer" }],
      skipped: [],
    });
  });
  it("never displaces an existing project lead", () => {
    const r = plan({ projectHasLead: true });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.assign.find((a) => a.developerId === 1)?.role).toBe("contributor");
    if (r.ok) expect(r.assign.some((a) => a.role === "lead")).toBe(false);
  });
  it("only one team lead can become the project lead", () => {
    const r = plan({ members: [cand(1, "lead"), cand(2, "lead"), cand(3)] });
    if (!r.ok) throw new Error("expected a plan");
    expect(r.assign.filter((a) => a.role === "lead")).toEqual([{ developerId: 1, role: "lead" }]);
    expect(r.assign.find((a) => a.developerId === 2)?.role).toBe("contributor");
  });
  it("puts leads first so the project gets its lead whatever order the members were listed in", () => {
    const r = plan({ members: [cand(5), cand(6, "lead")] });
    if (!r.ok) throw new Error("expected a plan");
    expect(r.assign.map((a) => a.developerId)).toEqual([6, 5]);
    expect(r.assign[0].role).toBe("lead");
  });
  it("leaves someone already on the project alone and says so", () => {
    const r = plan({ alreadyOnProject: new Set([2]) });
    if (!r.ok) throw new Error("expected a plan");
    expect(r.assign.map((a) => a.developerId)).toEqual([1, 3]);
    expect(r.skipped).toEqual([{ developerId: 2, reason: "already_on_project" }]);
  });
  it("a team lead already on the project does not make anyone else lead", () => {
    const r = plan({ alreadyOnProject: new Set([1]), projectHasLead: true });
    if (!r.ok) throw new Error("expected a plan");
    expect(r.assign.some((a) => a.role === "lead")).toBe(false);
  });
  it("skips developers who are not active", () => {
    const r = plan({ members: [cand(1, "lead", false), cand(2)] });
    if (!r.ok) throw new Error("expected a plan");
    expect(r.skipped).toEqual([{ developerId: 1, reason: "developer_not_active" }]);
    expect(r.assign).toEqual([{ developerId: 2, role: "contributor" }]); // an inactive lead does not take the lead slot
  });
  it("refuses a completed project, an archived team, an empty team, and a plan that would do nothing", () => {
    expect(plan({ projectStatus: "completed" })).toEqual({ ok: false, reason: "project_completed" });
    expect(plan({ teamArchived: true })).toEqual({ ok: false, reason: "team_archived" });
    expect(plan({ members: [] })).toEqual({ ok: false, reason: "team_empty" });
    expect(plan({ alreadyOnProject: new Set([1, 2, 3]) })).toEqual({ ok: false, reason: "nothing_to_assign" });
    expect(plan({ members: [cand(1, "member", false)] })).toEqual({ ok: false, reason: "nothing_to_assign" });
    for (const t of Object.values(PLAN_REFUSAL_TEXT)) expect(t.length).toBeGreaterThan(10);
  });
  it("assigns each person at most once and never more than one lead (property check)", () => {
    let seed = 11;
    const rnd = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const roles = ["lead", "member", "reviewer"] as const;
    for (let k = 0; k < 300; k++) {
      const members = Array.from({ length: 1 + rnd(8) }, (_, i) => cand(i + 1, roles[rnd(3)], rnd(5) !== 0));
      const already = new Set(members.filter(() => rnd(4) === 0).map((m) => m.developerId));
      const hasLead = rnd(3) === 0;
      const r = plan({ members, alreadyOnProject: already, projectHasLead: hasLead });
      if (!r.ok) continue;
      const ids = r.assign.map((a) => a.developerId);
      expect(new Set(ids).size, `run ${k}`).toBe(ids.length);
      expect(r.assign.filter((a) => a.role === "lead").length, `run ${k}`).toBeLessThanOrEqual(hasLead ? 0 : 1);
      for (const id of ids) expect(already.has(id) || !members.find((m) => m.developerId === id)?.developerActive, `run ${k} id ${id}`).toBe(false);
      expect(r.assign.length + r.skipped.length).toBe(members.length);
    }
  });
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  appendDeveloperNotification: vi.fn(async () => null),
  previewTeamAssignment: vi.fn(),
  assignDeveloperToProject: vi.fn(),
}));
vi.mock("./db/developerTeams", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, previewTeamAssignment: (...a: unknown[]) => d.previewTeamAssignment(...a) };
});
vi.mock("./db/developerWorkspace", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, assignDeveloperToProject: (...a: unknown[]) => d.assignDeveloperToProject(...a) };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit, appendDeveloperNotification: d.appendDeveloperNotification };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "t", email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"] = "admin") => appRouter.createCaller(ctx(role)).adminOps;
const view = (p: ReturnType<typeof planTeamAssignment>) => ({ found: true, project: { id: 4, code: "P1", name: "Alpha" }, team: { id: 2, name: "Platform" }, names: { 1: "Sam", 2: "Alex", 3: "Robin" }, plan: p });

describe("previewTeamAssignment / assignTeamToProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d.assignDeveloperToProject.mockResolvedValue({ assignment: { id: 1 }, created: true });
  });

  it("are staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) {
      await expect(ops(role).previewTeamAssignment({ teamId: 2, projectId: 4 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).assignTeamToProject({ teamId: 2, projectId: 4 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(d.assignDeveloperToProject).not.toHaveBeenCalled();
  });

  it("the preview changes nothing and shows the plan with names", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan()));
    const r = await ops().previewTeamAssignment({ teamId: 2, projectId: 4 });
    expect(r.plan).toMatchObject({ ok: true });
    expect(r.names[1]).toBe("Sam");
    expect(r.refusal).toBeNull();
    expect(d.assignDeveloperToProject).not.toHaveBeenCalled();
  });

  it("the preview explains a refusal in words", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan({ members: [] })));
    expect((await ops().previewTeamAssignment({ teamId: 2, projectId: 4 })).refusal).toBe(PLAN_REFUSAL_TEXT.team_empty);
  });

  it("assigns each planned member with the planned role, notifies them and audits the counts", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan({ alreadyOnProject: new Set([2]) })));
    await expect(ops().assignTeamToProject({ teamId: 2, projectId: 4 })).resolves.toEqual({ assigned: 2, skipped: [{ developerId: 2, reason: "already_on_project" }], failed: 0 });
    expect(d.assignDeveloperToProject.mock.calls.map((c) => c[0])).toEqual([
      { projectId: 4, developerId: 1, assignmentRole: "lead", createdByUserId: 99 },
      { projectId: 4, developerId: 3, assignmentRole: "reviewer", createdByUserId: 99 },
    ]);
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.team.assign_project(team=2:project=4:assigned=2:skipped=1:failed=0)") }));
  });

  it("never takes the plan from the caller: extra input is ignored and the server recomputes it", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan({ members: [cand(7)] })));
    await ops().assignTeamToProject({ teamId: 2, projectId: 4, plan: { assign: [{ developerId: 999, role: "lead" }] } } as never);
    expect(d.assignDeveloperToProject.mock.calls.map((c) => (c[0] as { developerId: number }).developerId)).toEqual([7]);
  });

  it("counts a member whose assignment failed and keeps going with the rest", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan()));
    d.assignDeveloperToProject.mockRejectedValueOnce(new Error("db")).mockResolvedValue({ assignment: { id: 1 }, created: true });
    await expect(ops().assignTeamToProject({ teamId: 2, projectId: 4 })).resolves.toMatchObject({ assigned: 2, failed: 1 });
  });

  it("refuses when the plan is a refusal, and when the team or project is missing", async () => {
    d.previewTeamAssignment.mockResolvedValueOnce(view(plan({ projectStatus: "completed" })));
    await expect(ops().assignTeamToProject({ teamId: 2, projectId: 4 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: PLAN_REFUSAL_TEXT.project_completed });
    d.previewTeamAssignment.mockResolvedValueOnce({ found: false, reason: "team_not_found" });
    await expect(ops().assignTeamToProject({ teamId: 2, projectId: 4 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.previewTeamAssignment.mockResolvedValueOnce({ found: false, reason: "project_not_found" });
    await expect(ops().previewTeamAssignment({ teamId: 2, projectId: 4 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.previewTeamAssignment.mockResolvedValueOnce({ found: false, reason: "unavailable" });
    await expect(ops().assignTeamToProject({ teamId: 2, projectId: 4 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(d.assignDeveloperToProject).not.toHaveBeenCalled();
  });

  it("rejects bad ids", async () => {
    for (const bad of [{ teamId: 0, projectId: 1 }, { teamId: 1, projectId: -1 }, { teamId: 1.5, projectId: 1 }]) await expect(ops().assignTeamToProject(bad as never)).rejects.toThrow();
    expect(d.previewTeamAssignment).not.toHaveBeenCalled();
  });
});
