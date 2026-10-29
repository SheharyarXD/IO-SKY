/*
 * J09, J10 (SRS 15.13, 18.20; 29 Oct Doc 1 Ch10.1, ACC-31, F-29): the controlled
 * document handoff. Client uploads stay private; only IO SKY staff release one,
 * only when it is approved and the developer project is linked to the SAME
 * client; a developer needs an active assignment AND a release. The developer
 * side is tested in developer.test.ts. Mocked data layer: the SQL joins are not run.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canRevoke, developerMayOpenDocument, evaluateRelease } from "../shared/documentHandoff";

const ok = { actorRole: "admin", documentStatus: "approved", documentOrganizationId: 4, linkedProjectOrganizationIds: [4], alreadyReleased: false };

describe("evaluateRelease", () => {
  it("allows staff to release an approved document into a project linked to the same client", () => {
    expect(evaluateRelease(ok)).toEqual({ ok: true });
    expect(evaluateRelease({ ...ok, actorRole: "super_admin" })).toEqual({ ok: true });
  });

  it("only IO SKY staff release: not a client, developer, operator, or anyone unknown", () => {
    for (const actorRole of ["client", "developer", "technical_operator", "user", "", null, undefined]) {
      expect(evaluateRelease({ ...ok, actorRole }), String(actorRole)).toEqual({ ok: false, reason: "not_staff" });
    }
  });

  it("an upload that has not passed IO SKY's review never crosses the boundary", () => {
    for (const documentStatus of ["pending_review", "rejected", "superseded", "archived", "", "APPROVED"]) {
      expect(evaluateRelease({ ...ok, documentStatus }), documentStatus).toEqual({ ok: false, reason: "document_not_approved" });
    }
  });

  it("a developer project with no link to a client project cannot receive anything (fails closed)", () => {
    expect(evaluateRelease({ ...ok, linkedProjectOrganizationIds: [] })).toEqual({ ok: false, reason: "not_linked" });
  });

  it("one client's document cannot be released into another client's project", () => {
    expect(evaluateRelease({ ...ok, documentOrganizationId: 9 })).toEqual({ ok: false, reason: "organization_mismatch" });
    expect(evaluateRelease({ ...ok, linkedProjectOrganizationIds: [5, 6] })).toEqual({ ok: false, reason: "organization_mismatch" });
    expect(evaluateRelease({ ...ok, linkedProjectOrganizationIds: [5, 4] })).toEqual({ ok: true }); // one project may serve more than one link
  });

  it("an already released document is not released twice", () => {
    expect(evaluateRelease({ ...ok, alreadyReleased: true })).toEqual({ ok: false, reason: "already_released" });
  });

  it("checks in a fixed order, so the most basic refusal is the one reported", () => {
    expect(evaluateRelease({ actorRole: "client", documentStatus: "pending_review", documentOrganizationId: 1, linkedProjectOrganizationIds: [], alreadyReleased: true })).toEqual({ ok: false, reason: "not_staff" });
  });
});

describe("developerMayOpenDocument", () => {
  it("needs an active assignment, an active release and a still-approved document, all three", () => {
    expect(developerMayOpenDocument({ assignmentActive: true, releaseActive: true, documentStatus: "approved" })).toBe(true);
    expect(developerMayOpenDocument({ assignmentActive: true, releaseActive: false, documentStatus: "approved" })).toBe(false); // membership alone is not access
    expect(developerMayOpenDocument({ assignmentActive: false, releaseActive: true, documentStatus: "approved" })).toBe(false); // ended assignment
    expect(developerMayOpenDocument({ assignmentActive: true, releaseActive: true, documentStatus: "superseded" })).toBe(false); // newer unreviewed version
    expect(developerMayOpenDocument({ assignmentActive: true, releaseActive: true, documentStatus: "rejected" })).toBe(false);
  });
});

describe("canRevoke", () => {
  it("only an active release can be revoked", () => {
    expect(canRevoke("released")).toBe(true);
    for (const s of ["revoked", "", "approved"]) expect(canRevoke(s)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// staff and client endpoints
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  associateDocumentWithProject: vi.fn(),
  listDocumentsForClientProject: vi.fn(),
  linkDeveloperProject: vi.fn(),
  unlinkDeveloperProject: vi.fn(),
  getReleaseFacts: vi.fn(),
  createRelease: vi.fn(),
  revokeRelease: vi.fn(),
  listReleases: vi.fn(),
  listActiveAssignedDeveloperIds: vi.fn(),
  notifyDeveloper: vi.fn(async () => undefined),
  appendLoginAudit: vi.fn(async () => undefined),
}));

vi.mock("./db/documentHandoff", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, ...m };
});
vi.mock("./notifications", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, notifyDeveloper: m.notifyDeveloper };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, appendLoginAudit: m.appendLoginAudit, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]) };
});

import { appRouter } from "./routers";
import { resetDenialAuditThrottleForTests } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const ctx = (role: string | null, organizationId: number | null = 4): TrpcContext => ({
  user: role ? ({ id: 5, openId: "u", email: "u@example.com", name: "U", loginMethod: "local", role, organizationId, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never) : null,
  impersonation: null,
  req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
});
const admin = (role: string | null = "admin") => appRouter.createCaller(ctx(role, null)).adminOps;
const client = (role: string | null = "client", org: number | null = 4) => appRouter.createCaller(ctx(role, org)).clientPortal;
const facts = (over: Record<string, unknown> = {}) => ({ document: { id: 7, organizationId: 4, status: "approved", name: "Acme-Master-Services.pdf" }, linkedProjectOrganizationIds: [4], alreadyReleased: false, ...over });
const audits = () => (m.appendLoginAudit.mock.calls as unknown as Array<[{ reason: string }]>).map((c) => c[0].reason);
const settle = () => new Promise((r) => setTimeout(r, 15));

beforeEach(() => {
  vi.clearAllMocks();
  resetDenialAuditThrottleForTests();
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.getReleaseFacts.mockResolvedValue(facts());
  m.createRelease.mockResolvedValue({ id: 31 });
  m.listActiveAssignedDeveloperIds.mockResolvedValue([11, 12]);
  m.revokeRelease.mockResolvedValue({ documentId: 7, developerProjectId: 3 });
});

describe("adminOps.releaseDocumentToDevelopers", () => {
  const release = (over: Record<string, unknown> = {}) => admin().releaseDocumentToDevelopers({ documentId: 7, developerProjectId: 3, note: "Final spec", ...over } as never);

  it("releases an approved document into a linked project, records it, and tells the assigned developers without naming the client or the file", async () => {
    await expect(release()).resolves.toEqual({ ok: true, releaseId: 31 });
    expect(m.createRelease).toHaveBeenCalledWith({ documentId: 7, developerProjectId: 3, userId: 5, note: "Final spec" });
    expect(m.notifyDeveloper).toHaveBeenCalledTimes(2);
    expect(m.notifyDeveloper.mock.calls.map((c) => (c as unknown as [{ developerId: number }])[0].developerId)).toEqual([11, 12]);
    const sent = JSON.stringify(m.notifyDeveloper.mock.calls);
    expect(sent).not.toMatch(/Acme|Master-Services|organi[sz]ation/i);
    await settle();
    expect(audits().some((r) => r.startsWith("admin.handoff.release(doc=7:dev=3"))).toBe(true);
  });

  it("refuses an unapproved document, an unlinked project and a missing document, releasing nothing", async () => {
    m.getReleaseFacts.mockResolvedValueOnce(facts({ document: { id: 7, organizationId: 4, status: "pending_review", name: "x" } }));
    await expect(release()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("Approve the document") });
    m.getReleaseFacts.mockResolvedValueOnce(facts({ linkedProjectOrganizationIds: [] }));
    await expect(release()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("Link this developer project") });
    m.getReleaseFacts.mockResolvedValueOnce(null);
    await expect(release()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.createRelease).not.toHaveBeenCalled();
    expect(m.notifyDeveloper).not.toHaveBeenCalled();
  });

  it("a wrong selection across clients is blocked, nothing is released and the attempt is on record", async () => {
    m.getReleaseFacts.mockResolvedValueOnce(facts({ linkedProjectOrganizationIds: [9] }));
    await expect(release()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("different client") });
    expect(m.createRelease).not.toHaveBeenCalled();
    await settle();
    expect(audits().some((r) => r.includes("release_blocked") && r.includes("organization_mismatch"))).toBe(true);
  });

  it("a duplicate is a conflict, including when two releases race and the unique index decides", async () => {
    m.getReleaseFacts.mockResolvedValueOnce(facts({ alreadyReleased: true }));
    await expect(release()).rejects.toMatchObject({ code: "CONFLICT" });
    m.createRelease.mockResolvedValueOnce("already_released");
    await expect(release()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.notifyDeveloper).not.toHaveBeenCalled();
  });

  it("a failing developer notification does not undo the release", async () => {
    m.notifyDeveloper.mockRejectedValue(new Error("notifications down"));
    await expect(release()).resolves.toMatchObject({ ok: true });
  });

  it("nobody but IO SKY staff can call it: clients, developers, operators and anonymous callers are refused before any lookup", async () => {
    for (const role of ["client", "developer", "technical_operator", "user", null]) {
      await expect(admin(role).releaseDocumentToDevelopers({ documentId: 7, developerProjectId: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(m.getReleaseFacts).not.toHaveBeenCalled();
    expect(m.createRelease).not.toHaveBeenCalled();
  });
});

describe("revoking, linking and unlinking", () => {
  it("revokes an active release and records it; a missing or already revoked one is not found", async () => {
    await expect(admin().revokeDocumentRelease({ releaseId: 31, note: "Sent in error" })).resolves.toEqual({ ok: true });
    expect(m.revokeRelease).toHaveBeenCalledWith({ releaseId: 31, userId: 5, note: "Sent in error" });
    m.revokeRelease.mockResolvedValueOnce(null);
    await expect(admin().revokeDocumentRelease({ releaseId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("linking validates both projects; unlinking reports how many releases it withdrew", async () => {
    m.linkDeveloperProject.mockResolvedValueOnce("ok");
    await expect(admin().linkDeveloperProject({ developerProjectId: 3, clientProjectId: 8 })).resolves.toEqual({ ok: true });
    m.linkDeveloperProject.mockResolvedValueOnce("client_project_not_found");
    await expect(admin().linkDeveloperProject({ developerProjectId: 3, clientProjectId: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.unlinkDeveloperProject.mockResolvedValueOnce({ removed: true, revoked: 2 });
    await expect(admin().unlinkDeveloperProject({ developerProjectId: 3, clientProjectId: 8 })).resolves.toEqual({ removed: true, revoked: 2 });
    m.unlinkDeveloperProject.mockResolvedValueOnce({ removed: false, revoked: 0 });
    await expect(admin().unlinkDeveloperProject({ developerProjectId: 3, clientProjectId: 8 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("only staff can revoke, link or unlink, and the release list is staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"]) {
      await expect(admin(role).revokeDocumentRelease({ releaseId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(admin(role).linkDeveloperProject({ developerProjectId: 1, clientProjectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(admin(role).unlinkDeveloperProject({ developerProjectId: 1, clientProjectId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(admin(role).documentReleases({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    m.listReleases.mockResolvedValueOnce([{ id: 31 }]);
    await expect(admin().documentReleases({ developerProjectId: 3 })).resolves.toEqual([{ id: 31 }]);
  });
});

describe("clientPortal.associateDocument and projectDocuments (J09)", () => {
  it("files a document under the caller's own project using the caller's organisation, never one they supply", async () => {
    m.associateDocumentWithProject.mockResolvedValueOnce("ok");
    await expect(client().associateDocument({ documentId: 7, clientProjectId: 8 })).resolves.toEqual({ ok: true });
    expect(m.associateDocumentWithProject).toHaveBeenCalledWith({ documentId: 7, clientProjectId: 8, organizationId: 4, userId: 5 });
    await settle();
    expect(audits()).toContain("document-associate:7:8");
  });

  it("another organisation's document or project is simply not found", async () => {
    m.associateDocumentWithProject.mockResolvedValueOnce("document_not_found");
    await expect(client("client", 9).associateDocument({ documentId: 7, clientProjectId: 8 })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Document not found." });
    m.associateDocumentWithProject.mockResolvedValueOnce("project_not_found");
    await expect(client("client", 9).associateDocument({ documentId: 7, clientProjectId: 8 })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Project not found." });
  });

  it("filing a document shares nothing: it never creates a release or notifies a developer", async () => {
    m.associateDocumentWithProject.mockResolvedValueOnce("ok");
    await client().associateDocument({ documentId: 7, clientProjectId: 8 });
    expect(m.createRelease).not.toHaveBeenCalled();
    expect(m.notifyDeveloper).not.toHaveBeenCalled();
  });

  it("the project listing is scoped to the caller's organisation; anonymous and developer callers are refused", async () => {
    m.listDocumentsForClientProject.mockResolvedValueOnce([{ id: 7 }]);
    await expect(client("client", 4).projectDocuments({ clientProjectId: 8 })).resolves.toEqual([{ id: 7 }]);
    expect(m.listDocumentsForClientProject).toHaveBeenCalledWith(4, 8);
    for (const role of ["developer", "technical_operator", null]) {
      await expect(client(role).projectDocuments({ clientProjectId: 8 })).rejects.toBeTruthy();
    }
  });
});
