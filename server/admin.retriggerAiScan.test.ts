/*
 * IO SKY — Admin Portal · closes the AI Scans "Trigger scan" admin.action
 * dead-button stub — scoped as a real retry of an existing pending/failed
 * scan (re-running the real scoring engine against its own stored
 * questionnaire answers), not a fabricated fresh scan with no answers.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const { appendLoginAuditMock, getAiScanByIdMock, runAiScanEngineMock } = vi.hoisted(() => ({
  appendLoginAuditMock: vi.fn(async () => {}),
  getAiScanByIdMock: vi.fn(),
  runAiScanEngineMock: vi.fn(async () => {}),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    appendLoginAudit: appendLoginAuditMock,
    getAiScanById: getAiScanByIdMock,
  };
});

vi.mock("./routers/aiScans", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    runAiScanEngine: runAiScanEngineMock,
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeUser(role: AuthenticatedUser["role"]): AuthenticatedUser {
  return {
    id: 99,
    openId: "test-admin",
    email: "ops@example.com",
    name: "Ops Admin",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function makeCtx(role: AuthenticatedUser["role"] | null): TrpcContext {
  return {
    user: role ? makeUser(role) : null,
    impersonation: null,
    req: {
      protocol: "https",
      headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function baseScan(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    reportToken: "tok-abc",
    tier: "growth",
    locale: "en",
    fullName: "Jan Jansen",
    email: "jan@example.com",
    company: "Acme Corp",
    status: "failed",
    responses: JSON.stringify({ answers: { q1: "a" }, contextNote: "note" }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin.retriggerAiScan", () => {
  it("rejects non-admin callers", async () => {
    const caller = appRouter.createCaller(makeCtx("client"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(runAiScanEngineMock).not.toHaveBeenCalled();
  });

  it("404s for an unknown scan", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects a scan that is already ready (PRECONDITION_FAILED)", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(baseScan({ status: "ready" }));
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(runAiScanEngineMock).not.toHaveBeenCalled();
  });

  it("rejects a scan that is already actively scoring (PRECONDITION_FAILED)", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(baseScan({ status: "scoring" }));
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(runAiScanEngineMock).not.toHaveBeenCalled();
  });

  it("rejects a scan with no valid stored answers instead of fabricating some", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(
      baseScan({ status: "failed", responses: "not valid json{{{" }),
    );
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(runAiScanEngineMock).not.toHaveBeenCalled();
  });

  it("rejects a scan whose responses parse but contain no answers", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(
      baseScan({ status: "pending", responses: JSON.stringify({ answers: {} }) }),
    );
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(runAiScanEngineMock).not.toHaveBeenCalled();
  });

  it("retries a failed scan with its real stored answers and audits it", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(baseScan({ status: "failed" }));
    const caller = appRouter.createCaller(makeCtx("admin"));
    const out = await caller.admin.retriggerAiScan({ aiScanId: 12 });
    expect(out).toEqual({ ok: true, aiScanId: 12, status: "scoring" });
    expect(runAiScanEngineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scanId: 12,
        reportToken: "tok-abc",
        tier: "growth",
        answers: { q1: "a" },
        contextNote: "note",
      }),
    );
    expect(appendLoginAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: expect.stringContaining("admin.ai_scan.retrigger(12)") }),
    );
  });

  it("retries a pending scan too (not just failed)", async () => {
    getAiScanByIdMock.mockResolvedValueOnce(baseScan({ status: "pending" }));
    const caller = appRouter.createCaller(makeCtx("admin"));
    await expect(caller.admin.retriggerAiScan({ aiScanId: 12 })).resolves.toMatchObject({ ok: true });
    expect(runAiScanEngineMock).toHaveBeenCalledTimes(1);
  });
});
