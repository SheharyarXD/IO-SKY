/*
 * J03 (SRS 15.18; 29 Oct Ch12): developer teams. The roster rules are pure; the router is
 * tested with the data layer mocked. The SQL (diff writing and the partial unique
 * indexes of migration 0044) has NOT run against PostgreSQL (needs the isolated
 * database, task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addMember, cleanTeamName, MEMBER_REFUSAL_TEXT, removeMember, rosterIsValid, setPrimaryContact, setRole, TEAM_ROLES, validateTeamName, type Member, type TeamRole } from "../shared/teamRules";

const m = (developerId: number, role: TeamRole = "member", primaryContact = false): Member => ({ developerId, role, primaryContact });
const roster = (...ms: Member[]) => ms;
const live = { archived: false };

describe("team names", () => {
  it("are cleaned and bounded", () => {
    expect(cleanTeamName("  Platform \n  Team ")).toBe("Platform Team");
    expect(validateTeamName("Platform Team")).toEqual({ ok: true, name: "Platform Team" });
    expect(validateTeamName("  AI & Data (EU)  ")).toEqual({ ok: true, name: "AI & Data (EU)" });
    expect(validateTeamName("Équipe Données")).toMatchObject({ ok: true });
    expect(validateTeamName("a")).toEqual({ ok: false, reason: "too_short" });
    expect(validateTeamName(" ")).toEqual({ ok: false, reason: "too_short" });
    expect(validateTeamName(null)).toEqual({ ok: false, reason: "too_short" });
    expect(validateTeamName("x".repeat(81))).toEqual({ ok: false, reason: "too_long" });
  });
  it("refuse markup and leading punctuation, since the name is shown to developers", () => {
    for (const bad of ["<script>alert(1)</script>", "Team <b>", "-Team", "Team;DROP", "Team\u0000", "{{x}}", "Team `x`"]) expect(validateTeamName(bad), bad).toEqual({ ok: false, reason: "invalid_characters" });
  });
});

describe("adding members", () => {
  it("the first member becomes the primary contact, later ones do not", () => {
    const first = addMember({ ...live, roster: [], developerId: 1, role: "lead", developerActive: true });
    expect(first).toMatchObject({ ok: true, primaryContactId: 1 });
    const second = addMember({ ...live, roster: (first as { roster: Member[] }).roster, developerId: 2, role: "member", developerActive: true });
    expect(second).toMatchObject({ ok: true, primaryContactId: 1 });
  });
  it("refuses a duplicate, an inactive developer and an archived team", () => {
    const r = roster(m(1, "lead", true));
    expect(addMember({ ...live, roster: r, developerId: 1, role: "member", developerActive: true })).toEqual({ ok: false, reason: "already_member" });
    expect(addMember({ ...live, roster: r, developerId: 2, role: "member", developerActive: false })).toEqual({ ok: false, reason: "developer_not_active" });
    expect(addMember({ archived: true, roster: r, developerId: 2, role: "member", developerActive: true })).toEqual({ ok: false, reason: "team_archived" });
  });
});

describe("removing members", () => {
  const r = roster(m(1, "lead", true), m(2), m(3, "reviewer"));
  it("an ordinary member can leave without ceremony", () => {
    const out = removeMember({ ...live, roster: r, developerId: 2 });
    expect(out).toMatchObject({ ok: true, primaryContactId: 1 });
    expect((out as { roster: Member[] }).roster.map((x) => x.developerId)).toEqual([1, 3]);
  });
  it("the primary contact needs a successor from the remaining members", () => {
    expect(removeMember({ ...live, roster: r, developerId: 1 })).toEqual({ ok: false, reason: "successor_required" });
    expect(removeMember({ ...live, roster: r, developerId: 1, successorId: 1 })).toEqual({ ok: false, reason: "same_person" });
    expect(removeMember({ ...live, roster: r, developerId: 1, successorId: 99 })).toEqual({ ok: false, reason: "successor_not_member" });
    const ok = removeMember({ ...live, roster: r, developerId: 1, successorId: 3 });
    expect(ok).toMatchObject({ ok: true, primaryContactId: 3 });
    expect((ok as { roster: Member[] }).roster.map((x) => x.developerId)).toEqual([2, 3]);
  });
  it("the last member can leave, leaving an empty team with no primary contact", () => {
    expect(removeMember({ ...live, roster: roster(m(1, "lead", true)), developerId: 1 })).toEqual({ ok: true, roster: [], primaryContactId: null });
  });
  it("refuses a stranger and an archived team", () => {
    expect(removeMember({ ...live, roster: r, developerId: 9 })).toEqual({ ok: false, reason: "not_a_member" });
    expect(removeMember({ archived: true, roster: r, developerId: 2 })).toEqual({ ok: false, reason: "team_archived" });
  });
});

describe("primary contact and roles", () => {
  const r = roster(m(1, "lead", true), m(2), m(3));
  it("moves the primary contact to an existing member and nobody else", () => {
    const out = setPrimaryContact({ ...live, roster: r, developerId: 3 });
    expect(out).toMatchObject({ ok: true, primaryContactId: 3 });
    expect((out as { roster: Member[] }).roster.filter((x) => x.primaryContact)).toHaveLength(1);
    expect(setPrimaryContact({ ...live, roster: r, developerId: 9 })).toEqual({ ok: false, reason: "not_a_member" });
    expect(setPrimaryContact({ archived: true, roster: r, developerId: 2 })).toEqual({ ok: false, reason: "team_archived" });
  });
  it("changing a role leaves the primary contact alone", () => {
    const out = setRole({ ...live, roster: r, developerId: 1, role: "member" }) as { ok: true; roster: Member[]; primaryContactId: number };
    expect(out.primaryContactId).toBe(1);
    expect(out.roster.find((x) => x.developerId === 1)?.role).toBe("member");
    expect(setRole({ ...live, roster: r, developerId: 9, role: "lead" })).toEqual({ ok: false, reason: "not_a_member" });
  });
  it("every refusal has a plain message", () => {
    for (const k of Object.keys(MEMBER_REFUSAL_TEXT) as Array<keyof typeof MEMBER_REFUSAL_TEXT>) expect(MEMBER_REFUSAL_TEXT[k].length).toBeGreaterThan(10);
  });
});

describe("the roster invariant", () => {
  it("rosterIsValid accepts empty-without-primary and exactly-one-primary, and rejects the rest", () => {
    expect(rosterIsValid([])).toBe(true);
    expect(rosterIsValid(roster(m(1, "lead", true), m(2)))).toBe(true);
    expect(rosterIsValid(roster(m(1), m(2)))).toBe(false); // no primary contact
    expect(rosterIsValid(roster(m(1, "lead", true), m(2, "member", true)))).toBe(false); // two
    expect(rosterIsValid(roster(m(1, "lead", true), m(1)))).toBe(false); // duplicate developer
    expect(rosterIsValid([m(1, "lead", true)].map((x) => ({ ...x, primaryContact: false })))).toBe(false);
  });
  it("holds after every successful operation in a long pseudo-random sequence", () => {
    // Deterministic generator so a failure is reproducible.
    let seed = 20261030;
    const rnd = (n: number) => {
      // mulberry32: a well-behaved 32-bit generator (an LCG loses precision in JS numbers)
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    let team: Member[] = [];
    let applied = 0;
    for (let i = 0; i < 2000; i++) {
      const dev = 1 + rnd(8);
      const role = TEAM_ROLES[rnd(3)];
      const op = rnd(4);
      const successor = rnd(3) === 0 ? undefined : 1 + rnd(8);
      const res =
        op === 0
          ? addMember({ archived: false, roster: team, developerId: dev, role, developerActive: rnd(10) !== 0 })
          : op === 1
            ? removeMember({ archived: false, roster: team, developerId: dev, successorId: successor })
            : op === 2
              ? setPrimaryContact({ archived: false, roster: team, developerId: dev })
              : setRole({ archived: false, roster: team, developerId: dev, role });
      if (res.ok) {
        applied++;
        team = res.roster;
        expect(rosterIsValid(team), `step ${i} op ${op}`).toBe(true);
        expect(res.primaryContactId).toBe(team.find((x) => x.primaryContact)?.developerId ?? null);
      } else {
        // a refused operation changes nothing: the caller still holds the old roster
        expect(rosterIsValid(team)).toBe(true);
      }
    }
    expect(applied).toBeGreaterThan(300);
  });
});

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  listTeams: vi.fn(async () => [] as unknown[]),
  createTeam: vi.fn(),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  setTeamPrimaryContact: vi.fn(),
  setTeamMemberRole: vi.fn(),
  setTeamArchived: vi.fn(),
  listTeamsForDeveloper: vi.fn(async () => [] as unknown[]),
}));
vi.mock("./db/developerTeams", () => d);

const base = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  appendDeveloperNotification: vi.fn(async () => null),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), ...base };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "test-admin", email: "ops@example.com", name: "Ops Admin", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const admin = () => appRouter.createCaller(ctx("admin")).adminOps;

beforeEach(() => {
  vi.clearAllMocks();
  d.listTeams.mockResolvedValue([]);
});

describe("adminOps team endpoints", () => {
  it("are staff only", async () => {
    for (const role of ["client", "developer"] as const) {
      const c = appRouter.createCaller(ctx(role)).adminOps;
      await expect(c.createTeam({ name: "Platform" }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(c.addTeamMember({ teamId: 1, developerId: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(c.removeTeamMember({ teamId: 1, developerId: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(c.setTeamPrimaryContact({ teamId: 1, developerId: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(c.setTeamArchived({ teamId: 1, archived: true }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(c.teams(), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(d.createTeam).not.toHaveBeenCalled();
    expect(d.addTeamMember).not.toHaveBeenCalled();
  });

  it("creates a team, audits it, and maps name problems", async () => {
    d.createTeam.mockResolvedValueOnce({ ok: true, id: 7 });
    await expect(admin().createTeam({ name: "Platform", description: "Core" })).resolves.toEqual({ id: 7 });
    expect(d.createTeam).toHaveBeenCalledWith({ name: "Platform", description: "Core", userId: 99 });
    expect(base.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.team.create(team=7)") }));
    d.createTeam.mockResolvedValueOnce({ ok: false, reason: "name_taken" });
    await expect(admin().createTeam({ name: "Platform" })).rejects.toMatchObject({ code: "CONFLICT" });
    d.createTeam.mockResolvedValueOnce({ ok: false, reason: "invalid_name" });
    await expect(admin().createTeam({ name: "<b>x</b>" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(admin().createTeam({ name: "x" })).rejects.toThrow();
  });

  it("adds a member, notifies them, audits, and passes the acting admin", async () => {
    d.addTeamMember.mockResolvedValueOnce({ ok: true });
    await admin().addTeamMember({ teamId: 1, developerId: 5, role: "lead" });
    expect(d.addTeamMember).toHaveBeenCalledWith({ teamId: 1, developerId: 5, role: "lead", userId: 99 });
    expect(base.appendDeveloperNotification).toHaveBeenCalledWith(expect.objectContaining({ developerId: 5 }));
    expect(base.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.team.add_member(team=1:dev=5:lead)") }));
  });

  it("maps each refusal to the right error and neither notifies nor audits on failure", async () => {
    const cases: Array<[string, string]> = [
      ["team_not_found", "NOT_FOUND"],
      ["developer_not_found", "NOT_FOUND"],
      ["team_archived", "PRECONDITION_FAILED"],
      ["already_member", "BAD_REQUEST"],
      ["developer_not_active", "BAD_REQUEST"],
      ["conflict", "CONFLICT"],
      ["unavailable", "INTERNAL_SERVER_ERROR"],
    ];
    for (const [reason, code] of cases) {
      d.addTeamMember.mockResolvedValueOnce({ ok: false, reason });
      await expect(admin().addTeamMember({ teamId: 1, developerId: 5 }), reason).rejects.toMatchObject({ code });
    }
    expect(base.appendDeveloperNotification).not.toHaveBeenCalled();
    expect(base.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("add_member") }));
  });

  it("removing the primary contact without a successor is refused with the plain message", async () => {
    d.removeTeamMember.mockResolvedValueOnce({ ok: false, reason: "successor_required" });
    await expect(admin().removeTeamMember({ teamId: 1, developerId: 1 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: MEMBER_REFUSAL_TEXT.successor_required });
    d.removeTeamMember.mockResolvedValueOnce({ ok: true });
    await expect(admin().removeTeamMember({ teamId: 1, developerId: 1, successorId: 2 })).resolves.toEqual({ ok: true });
    expect(d.removeTeamMember).toHaveBeenLastCalledWith({ teamId: 1, developerId: 1, successorId: 2, userId: 99 });
  });

  it("changes the primary contact, a role and the archive state, each audited", async () => {
    d.setTeamPrimaryContact.mockResolvedValueOnce({ ok: true });
    d.setTeamMemberRole.mockResolvedValueOnce({ ok: true });
    d.setTeamArchived.mockResolvedValueOnce("ok");
    await admin().setTeamPrimaryContact({ teamId: 1, developerId: 2 });
    await admin().setTeamMemberRole({ teamId: 1, developerId: 2, role: "reviewer" });
    await admin().setTeamArchived({ teamId: 1, archived: true });
    const reasons = base.appendLoginAudit.mock.calls.map((c) => (c[0] as { reason: string }).reason);
    expect(reasons.some((r) => r.includes("admin.team.primary_contact(team=1:dev=2)"))).toBe(true);
    expect(reasons.some((r) => r.includes("admin.team.role(team=1:dev=2:reviewer)"))).toBe(true);
    expect(reasons.some((r) => r.includes("admin.team.archive(team=1)"))).toBe(true);
    d.setTeamArchived.mockResolvedValueOnce("name_taken");
    await expect(admin().setTeamArchived({ teamId: 1, archived: false })).rejects.toMatchObject({ code: "CONFLICT" });
    d.setTeamArchived.mockResolvedValueOnce("not_found");
    await expect(admin().setTeamArchived({ teamId: 9, archived: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects an unknown role before touching the store", async () => {
    await expect(admin().addTeamMember({ teamId: 1, developerId: 5, role: "owner" as never })).rejects.toThrow();
    expect(d.addTeamMember).not.toHaveBeenCalled();
  });
});
