/*
 * P06 (SRS 9.7, BR-017; 29 Oct Doc 2 s10): AI Scan report versions, comparison and
 * approval evidence. Pure rules plus the endpoints with the data layer mocked. The
 * version SQL and migration 0046 have not run against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiScanReportPayload } from "../shared/aiScanModel";
import { attachDecisions, compareReports, parseReportPayload } from "../shared/reportCompare";

const base = (): AiScanReportPayload => ({
  overallScore: 60,
  overallGrade: "established",
  scoredAt: 1,
  tier: "growth",
  dimensions: [
    { dimension: "operationalMaturity", score: 60, grade: "established", rationale: "Processes are partly documented." },
    { dimension: "automationReadiness", score: 50, grade: "developing", rationale: "Few automated steps." },
  ],
  executiveSummary: "Line one.\nLine two.",
  opportunities: [
    { id: "o1", title: "Automate invoicing", category: "automationReadiness", impact: "high", effort: "low", horizon: "0-30d", summary: "Save hours." },
    { id: "o2", title: "Central knowledge base", category: "operationalMaturity", impact: "medium", effort: "medium", horizon: "30-90d", summary: "One source of truth." },
  ],
  roadmap: [
    { horizon: "0-30d", items: ["Pick a tool", "Map the process"] },
    { horizon: "30-90d", items: ["Pilot"] },
  ],
  charts: { radar: true, bar: true, timeline: true },
  disclaimers: ["Not legal advice."],
});
const clone = (p: AiScanReportPayload): AiScanReportPayload => JSON.parse(JSON.stringify(p));

describe("parsing a stored report", () => {
  it("reads the engine's shape and defaults missing disclaimers", () => {
    expect(parseReportPayload(JSON.stringify(base()))?.overallScore).toBe(60);
    const noDisc = { ...base(), disclaimers: undefined };
    expect(parseReportPayload(JSON.stringify(noDisc))?.disclaimers).toEqual([]);
  });
  it("returns null for anything that is not a report", () => {
    for (const bad of [null, undefined, "", "not json", "{}", '{"overallScore":"x"}', JSON.stringify({ ...base(), dimensions: "no" }), JSON.stringify({ ...base(), executiveSummary: 3 }), "[]", "null"]) expect(parseReportPayload(bad as never), String(bad)).toBeNull();
  });
});

describe("comparing two versions", () => {
  it("identical reports have no differences", () => {
    const c = compareReports(base(), clone(base()));
    expect(c).toMatchObject({ identical: true, changes: 0, score: { delta: 0 }, grade: { changed: false }, disclaimersChanged: false });
    expect(c.dimensions).toEqual([]);
    expect(c.opportunities).toEqual({ added: [], removed: [], changed: [] });
    expect(c.roadmap).toEqual([]);
  });
  it("reports score and grade changes with the direction", () => {
    const b = clone(base());
    b.overallScore = 72;
    b.overallGrade = "mature";
    const c = compareReports(base(), b);
    expect(c.score).toEqual({ from: 60, to: 72, delta: 12 });
    expect(c.grade).toEqual({ from: "established", to: "mature", changed: true });
    expect(c.identical).toBe(false);
  });
  it("lists only the dimensions that changed, with delta, grade and reasoning", () => {
    const b = clone(base());
    b.dimensions[1].score = 58;
    b.dimensions[1].grade = "established";
    b.dimensions[0].rationale = "  Processes   are PARTLY documented. "; // whitespace and case only: not a change
    const c = compareReports(base(), b);
    expect(c.dimensions).toEqual([{ dimension: "automationReadiness", from: 50, to: 58, delta: 8, gradeFrom: "developing", gradeTo: "established", rationaleChanged: false }]);
    b.dimensions[0].rationale = "Processes are fully documented.";
    expect(compareReports(base(), b).dimensions.map((d) => d.dimension)).toEqual(["operationalMaturity", "automationReadiness"]);
  });
  it("shows a dimension that appears or disappears", () => {
    const b = clone(base());
    b.dimensions.pop();
    const c = compareReports(base(), b);
    expect(c.dimensions).toEqual([{ dimension: "automationReadiness", from: 50, to: null, delta: null, gradeFrom: "developing", gradeTo: null, rationaleChanged: false }]);
  });
  it("diffs the summary line by line", () => {
    const b = clone(base());
    b.executiveSummary = "Line one.\nLine two changed.\nLine three.";
    const c = compareReports(base(), b);
    expect(c.summary).toMatchObject({ added: 2, removed: 1, unchanged: 1, identical: false });
  });
  it("matches opportunities by title (ids change on regeneration), and spots added, removed and altered ones", () => {
    const b = clone(base());
    b.opportunities[0].id = "different-id";
    b.opportunities[0].impact = "transformational";
    b.opportunities[1].title = "  CENTRAL knowledge   base ";
    b.opportunities.push({ id: "o3", title: "Chat assistant", category: "automationReadiness", impact: "low", effort: "high", horizon: "180d+", summary: "Later." });
    b.opportunities = b.opportunities.filter((o) => o.title !== "Nothing");
    const c = compareReports(base(), b);
    expect(c.opportunities.added).toEqual(["Chat assistant"]);
    expect(c.opportunities.removed).toEqual([]);
    expect(c.opportunities.changed).toEqual([{ title: "Automate invoicing", fields: ["impact"] }]);
    b.opportunities = b.opportunities.slice(1, 2);
    expect(compareReports(base(), b).opportunities.removed).toEqual(["Automate invoicing"]);
  });
  it("compares the roadmap per horizon, ignoring case and spacing", () => {
    const b = clone(base());
    b.roadmap[0].items = ["pick   a TOOL", "Train the team"];
    b.roadmap.push({ horizon: "90-180d", items: ["Scale"] });
    const c = compareReports(base(), b);
    expect(c.roadmap).toEqual([
      { horizon: "0-30d", added: ["Train the team"], removed: ["map the process"] },
      { horizon: "90-180d", added: ["Scale"], removed: [] },
    ]);
  });
  it("notices changed disclaimers", () => {
    const b = clone(base());
    b.disclaimers = ["Not legal advice.", "New caveat."];
    expect(compareReports(base(), b).disclaimersChanged).toBe(true);
  });
  it("is symmetric about what was added and removed", () => {
    const b = clone(base());
    b.opportunities.push({ id: "o3", title: "Chat assistant", category: "automationReadiness", impact: "low", effort: "high", horizon: "180d+", summary: "Later." });
    const forward = compareReports(base(), b);
    const back = compareReports(b, base());
    expect(forward.opportunities.added).toEqual(back.opportunities.removed);
    expect(forward.changes).toBe(back.changes);
  });
  it("counts each distinct difference once", () => {
    const b = clone(base());
    b.overallScore = 61;
    b.disclaimers = [];
    expect(compareReports(base(), b).changes).toBe(2);
  });
});

describe("which version each decision applied to", () => {
  const at = (iso: string) => new Date(iso);
  const versions = [
    { version: 1, createdAt: at("2026-10-01T10:00:00Z"), overallScore: 55 },
    { version: 2, createdAt: at("2026-10-03T10:00:00Z"), overallScore: 62 },
    { version: 3, createdAt: at("2026-10-05T10:00:00Z"), overallScore: 66 },
  ];
  const ev = (toStatus: string, iso: string, actorUserId: number | null = 9, note: string | null = null) => ({ toStatus, createdAt: at(iso), actorUserId, note });

  it("attaches each approval, revision request and publication to the newest version before it", () => {
    const out = attachDecisions(versions, [
      ev("revision_required", "2026-10-02T09:00:00Z", 4, "Fix the summary"),
      ev("approved", "2026-10-06T09:00:00Z", 5),
      ev("published", "2026-10-07T09:00:00Z", 6),
    ]);
    expect(out.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(out[0].revisionRequests).toEqual([{ at: at("2026-10-02T09:00:00Z"), byUserId: 4, note: "Fix the summary" }]);
    expect(out[1].approvals).toEqual([]);
    expect(out[2].approvals).toEqual([{ at: at("2026-10-06T09:00:00Z"), byUserId: 5 }]);
    expect(out[2].publications).toEqual([{ at: at("2026-10-07T09:00:00Z"), byUserId: 6 }]);
  });
  it("marks exactly the version that was published as the one the customer sees", () => {
    const out = attachDecisions(versions, [ev("approved", "2026-10-04T09:00:00Z"), ev("published", "2026-10-04T10:00:00Z")]);
    expect(out.map((v) => v.published)).toEqual([false, true, false]); // v3 was produced after publication
    expect(out.filter((v) => v.published)).toHaveLength(1);
  });
  it("nothing is marked published before a publication", () => {
    expect(attachDecisions(versions, [ev("approved", "2026-10-04T09:00:00Z")]).some((v) => v.published)).toBe(false);
  });
  it("ignores a decision made before any version existed, and other statuses", () => {
    const out = attachDecisions(versions, [ev("approved", "2026-09-01T00:00:00Z"), ev("archived", "2026-10-09T00:00:00Z"), ev("awaiting_expert_review", "2026-10-02T00:00:00Z")]);
    for (const v of out) expect([v.approvals.length, v.publications.length, v.revisionRequests.length]).toEqual([0, 0, 0]);
  });
  it("handles unsorted input and no versions", () => {
    const out = attachDecisions([...versions].reverse(), [ev("published", "2026-10-06T00:00:00Z"), ev("approved", "2026-10-05T12:00:00Z")]);
    expect(out.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(out[2].approvals).toHaveLength(1);
    expect(attachDecisions([], [ev("approved", "2026-10-06T00:00:00Z")])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  listReportVersions: vi.fn(),
  getReportVersionPayload: vi.fn(),
  listAiScanStatusEvents: vi.fn(async () => [] as unknown[]),
}));
vi.mock("./db/aiScans", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listReportVersions: (...a: unknown[]) => d.listReportVersions(...a), getReportVersionPayload: (...a: unknown[]) => d.getReportVersionPayload(...a) };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit, listAiScanStatusEvents: d.listAiScanStatusEvents };
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

describe("version endpoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("are staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) {
      await expect(ops(role).aiScanVersions({ scanId: 1 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).compareAiScanVersions({ scanId: 1, from: 1, to: 2 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(d.listReportVersions).not.toHaveBeenCalled();
  });

  it("lists versions newest first with the decisions that applied to each", async () => {
    d.listReportVersions.mockResolvedValueOnce([
      { version: 2, createdAt: new Date("2026-10-03T10:00:00Z"), overallScore: 62 },
      { version: 1, createdAt: new Date("2026-10-01T10:00:00Z"), overallScore: 55 },
    ]);
    d.listAiScanStatusEvents.mockResolvedValueOnce([{ toStatus: "approved", createdAt: new Date("2026-10-04T10:00:00Z"), actorUserId: 5, note: null }]);
    const out = await ops().aiScanVersions({ scanId: 7 });
    expect(out.map((v) => v.version)).toEqual([2, 1]);
    expect(out[0].approvals).toEqual([{ at: new Date("2026-10-04T10:00:00Z"), byUserId: 5 }]);
    expect(out[1].approvals).toEqual([]);
  });

  it("compares two stored versions", async () => {
    const b = clone(base());
    b.overallScore = 70;
    d.getReportVersionPayload.mockResolvedValueOnce(JSON.stringify(base())).mockResolvedValueOnce(JSON.stringify(b));
    const out = await ops().compareAiScanVersions({ scanId: 7, from: 1, to: 2 });
    expect(out).toMatchObject({ from: 1, to: 2, identical: false, score: { from: 60, to: 70, delta: 10 } });
    expect(d.getReportVersionPayload).toHaveBeenNthCalledWith(1, 7, 1);
    expect(d.getReportVersionPayload).toHaveBeenNthCalledWith(2, 7, 2);
  });

  it("404s when a version is missing or unreadable, instead of comparing against nothing", async () => {
    d.getReportVersionPayload.mockResolvedValueOnce(JSON.stringify(base())).mockResolvedValueOnce(null);
    await expect(ops().compareAiScanVersions({ scanId: 7, from: 1, to: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.getReportVersionPayload.mockResolvedValueOnce("garbage").mockResolvedValueOnce(JSON.stringify(base()));
    await expect(ops().compareAiScanVersions({ scanId: 7, from: 1, to: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects bad ids", async () => {
    for (const bad of [{ scanId: 0, from: 1, to: 2 }, { scanId: 1, from: 0, to: 2 }, { scanId: 1, from: 1, to: 1.5 }]) await expect(ops().compareAiScanVersions(bad as never)).rejects.toThrow();
    expect(d.getReportVersionPayload).not.toHaveBeenCalled();
  });
});
