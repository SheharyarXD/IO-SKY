/**
 * IO SKY — Developer Workspace router specs.
 *
 * Verifies the four gates (no_profile, mfa_required, agreements_required,
 * scope_expired/no_assignments), tenant-style isolation between developers,
 * and the audit + admin-notify side effects on submission/task/file/message
 * mutations. We mock `./db` and `./_core/notification` end-to-end so the
 * tests run hermetically with no real database.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./db", () => {
  // Per-test mutable state so we can flip the gate result between cases.
  const state: any = {
    gate: { ok: true } as any,
    profile: {
      id: 100,
      userId: 1,
      fullName: "Alex Engineer",
      availability: "available",
      status: "active",
      mfaRequired: 1,
    },
    scope: { id: 200, status: "active", expiresMs: Date.now() + 1000 * 60 * 60 * 24 },
    signedTypes: [
      "nda",
      "confidentiality",
      "non-solicitation",
      "liability",
      "security-policy",
    ],
    assignments: [{ projectId: 500, developerId: 100, status: "active" }],
    accessibleFile: null as any,
    taskUpdateResult: null as any,
  };

  return {
    REQUIRED_DEVELOPER_AGREEMENTS: [
      { type: "nda", version: "v1" },
      { type: "confidentiality", version: "v1" },
      { type: "non-solicitation", version: "v1" },
      { type: "liability", version: "v1" },
      { type: "security-policy", version: "v1" },
    ],
    __state: state,
    evaluateDeveloperGate: vi.fn(async () => ({
      gate: state.gate,
      profile: state.profile,
      scope: state.scope,
      signedTypes: state.signedTypes,
      assignments: state.assignments,
    })),
    listAssignedDeveloperProjects: vi.fn(async () => [
      { id: 500, code: "PRJ-AI-WORKFLOW", name: "AI Workflow Engine", status: "active" },
    ]),
    listDeveloperTasks: vi.fn(async () => [
      { id: 800, projectId: 500, status: "in_progress", mine: true, projectCode: "PRJ-AI-WORKFLOW" },
    ]),
    listDeveloperSubmissions: vi.fn(async () => []),
    listDeveloperMessages: vi.fn(async () => []),
    listSignedAgreementsForDeveloper: vi.fn(async () => []),
    listDeveloperNotifications: vi.fn(async () => []),
    listDeveloperFiles: vi.fn(async () => []),
    getApprovedFileForDeveloper: vi.fn(async () => state.accessibleFile),
    getAssignedDeveloperProject: vi.fn(async ({ projectId }: any) =>
      state.assignments.some((a: any) => a.projectId === projectId)
        ? { id: projectId, code: "PRJ-AI-WORKFLOW", name: "AI Workflow Engine" }
        : null,
    ),
    updateDeveloperTaskStatus: vi.fn(async () => state.taskUpdateResult),
    createDeveloperSubmission: vi.fn(async (input: any) => ({ id: 9001, ...input })),
    appendDeveloperMessage: vi.fn(async () => ({ id: 9100 })),
    markAdminMessagesReadForDeveloper: vi.fn(async () => 2),
    signDeveloperAgreement: vi.fn(async () => ({ id: 9200 })),
    createDeveloperAccessRequest: vi.fn(async () => ({ ok: true })),
    createDeveloperSupportTicket: vi.fn(async () => ({ id: 9300, publicRef: "ENG-TEST" })),
    appendDeveloperAudit: vi.fn(async () => undefined),
    appendDeveloperSecurityEvent: vi.fn(async () => undefined),
    appendDeveloperNotification: vi.fn(async () => undefined),
    appendLoginAudit: vi.fn(async () => undefined),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

vi.mock("./storage", () => ({
  // bucket is accepted (and ignored) to match storagePut/storageGetSignedUrl's
  // real (bucket, key, ...) signature — the key is the second argument.
  storagePut: vi.fn(async (bucket: string, key: string) => ({ bucket, key })),
  storageGetSignedUrl: vi.fn(
    async (_bucket: string, key: string) => `https://signed.example/${key}?sig=test`,
  ),
}));

import { appRouter } from "./routers";
import * as dbModule from "./db";

function makeCtx(opts: {
  role?: "developer" | "admin" | "user" | "client";
  authed?: boolean;
  mfa?: "none" | "email" | "totp" | "sms";
}) {
  const { role = "developer", authed = true, mfa = "email" } = opts;
  return {
    user: authed
      ? {
          id: 1,
          email: "alex@iosky.test",
          name: "Alex Engineer",
          role,
          organizationId: null,
          mfaMethod: mfa,
        }
      : null,
    res: { setHeader: () => {}, getHeader: () => undefined, clearCookie: () => {} } as any,
    req: { protocol: "https", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any,
  } as any;
}

function gateState() {
  return (dbModule as any).__state;
}

describe("developer router — gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset gate state to "ok" for each test.
    const s = gateState();
    s.gate = { ok: true };
    s.profile = {
      id: 100,
      userId: 1,
      fullName: "Alex Engineer",
      availability: "available",
      status: "active",
      mfaRequired: 1,
    };
    s.scope = { id: 200, status: "active", expiresMs: Date.now() + 1000 * 60 * 60 * 24 };
    s.signedTypes = [
      "nda",
      "confidentiality",
      "non-solicitation",
      "liability",
      "security-policy",
    ];
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
    s.accessibleFile = null;
    s.taskUpdateResult = null;
  });

  it("rejects unauthenticated calls to gateStatus", async () => {
    const caller = appRouter.createCaller(makeCtx({ authed: false }));
    await expect(caller.developer.gateStatus()).rejects.toThrow();
  });

  it("returns ok=false/reason=denied for non-developer roles", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client" }));
    const status = await caller.developer.gateStatus();
    expect(status.ok).toBe(false);
    expect(status.reason).toBe("denied");
  });

  it("blocks dashboard when MFA gate fails", async () => {
    gateState().gate = { ok: false, reason: "mfa_required" };
    const caller = appRouter.createCaller(makeCtx({ mfa: "none" }));
    await expect(caller.developer.dashboard()).rejects.toThrow(/developer_gate:mfa_required/);
  });

  it("blocks dashboard when agreements gate fails", async () => {
    gateState().gate = {
      ok: false,
      reason: "agreements_required",
      missing: ["nda", "security-policy"],
    };
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(caller.developer.dashboard()).rejects.toThrow(/agreements_required/);
  });

  it("blocks dashboard when access scope is expired", async () => {
    gateState().gate = { ok: false, reason: "scope_expired", expiresMs: Date.now() - 1 };
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(caller.developer.dashboard()).rejects.toThrow(/scope_expired/);
  });

  it("blocks dashboard when no active assignments exist", async () => {
    gateState().gate = { ok: false, reason: "no_assignments" };
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(caller.developer.dashboard()).rejects.toThrow(/no_assignments/);
  });

  it("returns the workspace dashboard when every gate passes", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    const dash = await caller.developer.dashboard();
    expect(dash.profile.id).toBe(100);
    expect(dash.assignedProjectCount).toBe(1);
    expect(dash.activeTaskCount).toBe(1);
    expect(dash.requiredAgreementCount).toBe(5);
  });
});

describe("developer router — file signed URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
  });

  it("denies download when file does not belong to an assigned project", async () => {
    gateState().accessibleFile = null;
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.requestFileSignedUrl({ fileId: 7777 }),
    ).rejects.toThrow(/file_not_accessible/);
    const { appendDeveloperSecurityEvent } = await import("./db");
    expect(appendDeveloperSecurityEvent).toHaveBeenCalledTimes(1);
  });

  it("returns a signed URL and records an audit row when access is allowed", async () => {
    gateState().accessibleFile = {
      id: 1234,
      fileKey: "developer/PRJ-AI/spec.pdf",
      name: "spec.pdf",
      mimeType: "application/pdf",
      projectId: 500,
    };
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.requestFileSignedUrl({ fileId: 1234 });
    expect(out.url).toContain("developer/PRJ-AI/spec.pdf");
    expect(out.url).toMatch(/^https:\/\/signed\.example\//);
    const { appendDeveloperAudit } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "file.downloaded", developerId: 100 }),
    );
  });
});

describe("developer router — task + submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
    s.taskUpdateResult = null;
  });

  it("rejects setTaskStatus when the task is not assigned to the developer", async () => {
    gateState().taskUpdateResult = null;
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.setTaskStatus({ taskId: 99, status: "in_review" }),
    ).rejects.toThrow(/task_not_assigned/);
    const { appendDeveloperSecurityEvent } = await import("./db");
    expect(appendDeveloperSecurityEvent).toHaveBeenCalled();
  });

  it("updates status and notifies admin when caller owns the task", async () => {
    gateState().taskUpdateResult = { id: 800, projectId: 500, status: "in_review" };
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.setTaskStatus({ taskId: 800, status: "in_review" });
    expect(out.status).toBe("in_review");
    const { notifyOwner } = await import("./_core/notification");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("blocks submission for an unassigned project", async () => {
    gateState().assignments = [{ projectId: 500, developerId: 100, status: "active" }];
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.createSubmission({
        projectId: 999,
        kind: "submission",
        title: "Final deliverable",
        body: "v1",
      }),
    ).rejects.toThrow(/project_not_assigned/);
  });

  it("creates a submission, audits, and notifies admin", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.createSubmission({
      projectId: 500,
      kind: "submission",
      title: "Final deliverable",
      body: "Complete",
    });
    expect(out.id).toBe(9001);
    const { appendDeveloperAudit, appendDeveloperNotification } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "submission.created", developerId: 100 }),
    );
    expect(appendDeveloperNotification).toHaveBeenCalled();
    const { notifyOwner } = await import("./_core/notification");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("requires repository+sha when submitting a commit", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.createSubmission({
        projectId: 500,
        kind: "commit",
        title: "feat: add auth",
      } as any),
    ).rejects.toThrow();
  });
});

describe("developer router — messages + agreements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
  });

  it("appends a message to the admin thread and notifies admin", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.sendMessage({
      subject: "Spec clarification",
      body: "Could you confirm the SLA for batch processing?",
    });
    expect(out!.id).toBe(9100);
    const { appendDeveloperAudit } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "message.sent", developerId: 100 }),
    );
  });

  it("marks admin messages as read", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.markMessagesRead();
    expect(out.updated).toBe(2);
  });

  it("lets a developer sign an agreement even before all gates pass", async () => {
    // Simulate "agreements_required" — signAgreement uses protectedProcedure
    // and re-evaluates manually so it must still succeed.
    gateState().gate = { ok: false, reason: "agreements_required", missing: ["nda"] };
    const caller = appRouter.createCaller(makeCtx({}));
    const row = await caller.developer.signAgreement({
      agreementType: "nda",
      version: "v1",
    });
    expect(row!.id).toBe(9200);
    const { appendDeveloperAudit } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "agreement.signed" }),
    );
  });
});


// -------------------------------------------------------------------
// Support tickets + access extension — proves the audit + admin-notify
// side-effects fire on the two surfaces wired in Phase 4.
// -------------------------------------------------------------------
describe("developer router — support tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
  });

  it("rejects subjects that are too short", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.createSupportTicket({
        subject: "no",
        body: "Need help with my workspace please",
        category: "general",
        priority: "normal",
      }),
    ).rejects.toThrow();
  });

  it("opens a ticket, audits, and notifies the engineering desk", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    const out = await caller.developer.createSupportTicket({
      subject: "Cannot open repo",
      body: "Repository scope seems revoked.",
      category: "access",
      priority: "high",
    });
    expect((out as any)?.publicRef).toBe("ENG-TEST");
    const { appendDeveloperAudit } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "support.ticket_opened", developerId: 100 }),
    );
    const { notifyOwner } = await import("./_core/notification");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });
});

describe("developer router — access extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];
  });

  it("rejects extension reasons that are too short", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    await expect(
      caller.developer.requestAccessExtension({ reason: "x" }),
    ).rejects.toThrow();
  });

  it("creates an access request, audits, and notifies admin", async () => {
    const caller = appRouter.createCaller(makeCtx({}));
    await caller.developer.requestAccessExtension({
      reason: "Need extended access for security audit kickoff next week.",
    });
    const { appendDeveloperAudit } = await import("./db");
    expect(appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "access.extension_requested", developerId: 100 }),
    );
    const { notifyOwner } = await import("./_core/notification");
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Editable profile + security
// ─────────────────────────────────────────────────────────────────────────────

describe("developer router — Step 2: editable profile + security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = gateState();
    s.gate = { ok: true };
    s.profile = {
      id: 100,
      userId: 1,
      fullName: "Alex Engineer",
      availability: "available",
      status: "active",
      mfaRequired: 1,
    };
    s.scope = { id: 200, status: "active", expiresMs: Date.now() + 1000 * 60 * 60 * 24 };
    s.signedTypes = ["nda", "confidentiality", "non-solicitation", "liability", "security-policy"];
    s.assignments = [{ projectId: 500, developerId: 100, status: "active" }];

    // Make sure the mocked helpers we added exist on the module.
    (dbModule as any).updateDeveloperProfile = vi.fn(async (_id: number, patch: any) => ({
      id: 100,
      fullName: patch.fullName ?? "Alex Engineer",
      availability: patch.availability ?? "available",
    }));
    (dbModule as any).updateUserMfaMethod = vi.fn(async () => undefined);
    (dbModule as any).listDeveloperAuditEventsForSelf = vi.fn(async (_id: number, _limit: number) => [
      { id: 1, developerId: 100, action: "profile.update", createdAt: new Date() },
      { id: 2, developerId: 100, action: "security.mfa_method.update", createdAt: new Date() },
    ]);
  });

  it("updateProfile writes patch + audit row and skips notify when availability stays the same", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    await caller.developer.updateProfile({ fullName: "Alex E.", country: "NL" });
    expect((dbModule as any).updateDeveloperProfile).toHaveBeenCalledWith(100, {
      fullName: "Alex E.",
      country: "NL",
    });
    expect((dbModule as any).appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "profile.update", developerId: 100 }),
    );
    // No availability change → no notifyOwner call
    const notif = await import("./_core/notification");
    expect((notif.notifyOwner as any).mock.calls.length).toBe(0);
  });

  it("updateProfile fires notifyOwner when availability changes", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    await caller.developer.updateProfile({ availability: "unavailable" });
    const notif = await import("./_core/notification");
    expect((notif.notifyOwner as any)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("availability changed"),
      }),
    );
  });

  it("updateProfile is rejected for client, user, and even admin (self-service only)", async () => {
    for (const role of ["client", "user", "admin"] as const) {
      const caller = appRouter.createCaller(makeCtx({ role }));
      await expect(
        caller.developer.updateProfile({ fullName: "Hacker" }),
      ).rejects.toThrow();
    }
  });

  it("setMfaMethodLite is rejected for client, user, and even admin (self-service only)", async () => {
    for (const role of ["client", "user", "admin"] as const) {
      const caller = appRouter.createCaller(makeCtx({ role }));
      await expect(
        caller.developer.setMfaMethodLite({ method: "email" }),
      ).rejects.toThrow();
    }
  });

  it("getProfileForEdit is rejected for client, user, and even admin (self-service only)", async () => {
    for (const role of ["client", "user", "admin"] as const) {
      const caller = appRouter.createCaller(makeCtx({ role }));
      await expect(caller.developer.getProfileForEdit()).rejects.toThrow();
    }
  });

  it("setMfaMethodLite rejects 'none' when mfaRequired=1 and records a security event", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    await expect(caller.developer.setMfaMethodLite({ method: "none" })).rejects.toThrow();
    expect((dbModule as any).appendDeveloperSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "mfa.disable_denied" }),
    );
    // The actual MFA method must never change in this path.
    expect((dbModule as any).updateUserMfaMethod).not.toHaveBeenCalled();
  });

  it("setMfaMethodLite allows switching to 'email' and writes an audit row", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    const out = await caller.developer.setMfaMethodLite({ method: "email" });
    expect(out).toEqual({ ok: true, method: "email" });
    expect((dbModule as any).updateUserMfaMethod).toHaveBeenCalledWith(1, "email");
    expect((dbModule as any).appendDeveloperAudit).toHaveBeenCalledWith(
      expect.objectContaining({ event: "security.mfa_method.update" }),
    );
  });

  it("setMfaMethodLite allows 'none' when mfaRequired=0 and notifies the admin", async () => {
    const s = gateState();
    s.profile = { ...s.profile, mfaRequired: 0 };
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    const out = await caller.developer.setMfaMethodLite({ method: "none" });
    expect(out).toEqual({ ok: true, method: "none" });
    const notif = await import("./_core/notification");
    expect((notif.notifyOwner as any)).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Developer disabled MFA" }),
    );
  });

  it("listAuditEvents returns the calling developer's audit rows only", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "developer" }));
    const rows = await caller.developer.listAuditEvents({ limit: 25 });
    expect((dbModule as any).listDeveloperAuditEventsForSelf).toHaveBeenCalledWith(100, 25);
    expect(rows).toHaveLength(2);
  });

  it("listAuditEvents is rejected for client, user, and even admin (self-service only)", async () => {
    for (const role of ["client", "user", "admin"] as const) {
      const caller = appRouter.createCaller(makeCtx({ role }));
      await expect(caller.developer.listAuditEvents()).rejects.toThrow();
    }
  });
});
