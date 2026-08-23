/*
 * IO SKY — Admin Portal · Milestone 2 §2.6 document lifecycle (versioning,
 * approval/rejection, retention). client_documents was previously flat
 * upload/download only. Locks in: admin-gated review/retention mutations,
 * NOT_FOUND for an unknown document, and the version-linking behavior in
 * insertClientDocument (server/db/clientPortal.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  appendLoginAuditMock,
  reviewClientDocumentMock,
  setClientDocumentRetentionNoteMock,
  listClientDocumentVersionsMock,
  notifyClientMock,
} = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  reviewClientDocumentMock: vi.fn(),
  setClientDocumentRetentionNoteMock: vi.fn(),
  listClientDocumentVersionsMock: vi.fn(async () => [] as any[]),
  notifyClientMock: vi.fn(async () => {}),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    reviewClientDocument: reviewClientDocumentMock,
    setClientDocumentRetentionNote: setClientDocumentRetentionNoteMock,
    listClientDocumentVersions: listClientDocumentVersionsMock,
  };
});

vi.mock("./notifications", () => ({
  notifyClient: notifyClientMock,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"], id = 8): AuthenticatedUser {
  return {
    id,
    openId: `test-${role}-${id}`,
    email: "docs-tester@example.com",
    name: "Docs Tester",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null, id = 8): TrpcContext {
  return {
    user: role ? makeUser(role, id) : null,
    impersonation: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin.reviewDocument", () => {
  it("approves a document, audits it, and notifies the owning org (Milestone 2 §2.7)", async () => {
    reviewClientDocumentMock.mockResolvedValueOnce({ id: 5, name: "brief.pdf", organizationId: 7, status: "approved" });
    const caller = appRouter.createCaller(makeCtx("admin", 8));
    const r = await caller.admin.reviewDocument({ documentId: 5, decision: "approved" });
    expect(r).toMatchObject({ id: 5, status: "approved" });
    expect(reviewClientDocumentMock).toHaveBeenCalledWith(5, "approved", 8, null);
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.document.approved(5)") }),
    );
    expect(notifyClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        channel: "in_app_and_email",
        title: expect.stringContaining("brief.pdf"),
      }),
    );
  });

  it("rejects with a note", async () => {
    reviewClientDocumentMock.mockResolvedValueOnce({ id: 5, status: "rejected" });
    const caller = appRouter.createCaller(makeCtx("admin", 8));
    await caller.admin.reviewDocument({ documentId: 5, decision: "rejected", note: "wrong file" });
    expect(reviewClientDocumentMock).toHaveBeenCalledWith(5, "rejected", 8, "wrong file");
  });

  it("surfaces NOT_FOUND for an unknown document", async () => {
    reviewClientDocumentMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.reviewDocument({ documentId: 999, decision: "approved" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(
      caller.admin.reviewDocument({ documentId: 1, decision: "approved" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reviewClientDocumentMock).not.toHaveBeenCalled();
  });
});

describe("admin.setDocumentRetention", () => {
  it("sets a retention note and audits it", async () => {
    setClientDocumentRetentionNoteMock.mockResolvedValueOnce({ id: 5, retentionNote: "7 years" });
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.setDocumentRetention({ documentId: 5, note: "7 years" });
    expect(r).toMatchObject({ retentionNote: "7 years" });
    expect(setClientDocumentRetentionNoteMock).toHaveBeenCalledWith(5, "7 years");
  });

  it("surfaces NOT_FOUND for an unknown document", async () => {
    setClientDocumentRetentionNoteMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(
      caller.admin.setDocumentRetention({ documentId: 999, note: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("admin.listDocumentVersions", () => {
  it("returns the version chain", async () => {
    listClientDocumentVersionsMock.mockResolvedValueOnce([
      { id: 6, version: 2 },
      { id: 5, version: 1 },
    ]);
    const caller = appRouter.createCaller(makeCtx("admin"));
    const r = await caller.admin.listDocumentVersions({ organizationId: 1, documentId: 6 });
    expect(r).toHaveLength(2);
    expect(listClientDocumentVersionsMock).toHaveBeenCalledWith(1, 6);
  });
});
