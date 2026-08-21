/*
 * IO SKY — Client Portal router specs.
 * Verifies clientProcedure gating (unauth, wrong role, missing org), tenant
 * isolation in queries, support ticket creation flow, and message append +
 * notification fan-out.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./db", () => ({
  appendClientMessage: vi.fn(async () => ({ id: 1 })),
  appendClientNotification: vi.fn(async () => ({ id: 1 })),
  appendLoginAudit: vi.fn(async () => undefined),
  createClientSupportTicket: vi.fn(async () => ({ id: 1 })),
  // by-id helpers used by signed-URL flows; tests will override per case
  getClientReportById: vi.fn(async () => null),
  getClientInvoiceById: vi.fn(async () => null),
  getClientDocumentById: vi.fn(async () => null),
  getClientRecommendationById: vi.fn(async () => null),
  updateClientRecommendationStatus: vi.fn(async () => undefined),
  getBookingForOrg: vi.fn(async () => null),
  updateBookingStatus: vi.fn(async () => undefined),
  insertClientDocument: vi.fn(async () => ({ id: 999 })),
  deleteClientDocumentById: vi.fn(async () => undefined),
  markIoSkyMessagesRead: vi.fn(async () => 3),
  updateUserMfaMethod: vi.fn(async () => undefined),
  updateUserDisplayName: vi.fn(async () => undefined),
  getClientPortalDashboard: vi.fn(async (orgId: number) => ({
    organization: { id: orgId, name: "Acme Corp", operationalScore: 84, statusLabel: "Healthy" },
    counters: { reports: 3, recommendations: 7, openInvoices: 1, upcomingCalls: 1 },
    notifications: [],
    messages: [],
  })),
  getOrganizationById: vi.fn(async (orgId: number) => ({ id: orgId, name: "Acme Corp" })),
  listClientDocuments: vi.fn(async () => []),
  listClientInvoices: vi.fn(async () => []),
  listClientMessages: vi.fn(async () => []),
  listClientNotifications: vi.fn(async () => []),
  setClientNotificationRead: vi.fn(async () => ({ id: 1, readAt: Date.now() })),
  archiveClientNotification: vi.fn(async () => ({ id: 1, status: "archived" })),
  listClientProjectMilestones: vi.fn(async () => []),
  listClientProjects: vi.fn(async () => []),
  listClientRecommendations: vi.fn(async () => []),
  listClientReports: vi.fn(async () => []),
  listClientSupportTickets: vi.fn(async () => []),
  listStrategyCallsForOrg: vi.fn(async () => []),
  listLoginAuditForUser: vi.fn(async () => []),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

vi.mock("./storage", () => ({
  // Always return a deterministic signed URL so the test can assert on it
  // without touching the real Supabase Storage SDK. bucket is accepted (and
  // ignored) to match storagePut/storageGetSignedUrl's real (bucket, key, ...)
  // signature — the key is the second argument, not the first.
  storageGetSignedUrl: vi.fn(async (_bucket: string, key: string) => `https://signed.example/${key}`),
  storagePut: vi.fn(async (_bucket: string, key: string) => ({ bucket: _bucket, key })),
  storageDelete: vi.fn(async () => undefined),
}));

import { appRouter } from "./routers";

function makeCtx(opts: {
  role?: "client" | "admin" | "user";
  orgId?: number | null;
  authed?: boolean;
}) {
  const { role = "client", orgId = 42, authed = true } = opts;
  return {
    user: authed
      ? {
          id: 1,
          email: "alex@acme.test",
          name: "Alex Doe",
          role,
          organizationId: orgId,
          mfaMethod: null,
        }
      : null,
    res: {
      setHeader: () => {},
      getHeader: () => undefined,
      clearCookie: () => {},
    } as any,
    req: { protocol: "https", headers: {} } as any,
  } as any;
}

describe("clientPortal router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated calls", async () => {
    const caller = appRouter.createCaller(makeCtx({ authed: false }));
    await expect(caller.clientPortal.dashboard()).rejects.toThrow();
  });

  it("rejects users without a client role", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "user" }));
    await expect(caller.clientPortal.dashboard()).rejects.toThrow();
  });

  it("rejects clients without a linked organization", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: null }));
    await expect(caller.clientPortal.dashboard()).rejects.toThrow();
  });

  it("returns the tenant-scoped dashboard for the logged-in client", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 42 }));
    const dash = await caller.clientPortal.dashboard();
    expect(dash.organization.id).toBe(42);
    expect(dash.organization.name).toBe("Acme Corp");
  });

  it("returns the organization record for the logged-in client", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 99 }));
    const org = await caller.clientPortal.organization();
    expect(org.id).toBe(99);
  });

  it("creates a support ticket with a public reference and notifies owner", async () => {
    const { createClientSupportTicket } = await import("./db");
    const { notifyOwner } = await import("./_core/notification");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));

    const out = await caller.clientPortal.createTicket({
      subject: "Cannot download report",
      body: "We tried to download the latest AI Scan report and got a 404.",
      category: "technical",
      priority: "high",
    });

    expect(out.publicRef).toMatch(/^IOSKY-T-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(createClientSupportTicket).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("sends a client message and writes a notification", async () => {
    const { appendClientMessage, appendClientNotification } = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));

    const out = await caller.clientPortal.sendMessage({
      threadKey: "general",
      body: "Please share the latest deliverables.",
    });

    expect(out.ok).toBe(true);
    expect(appendClientMessage).toHaveBeenCalledTimes(1);
    expect(appendClientNotification).toHaveBeenCalledTimes(1);
  });

  it("requestReportSignedUrl returns a short-lived URL and audits download", async () => {
    const db = await import("./db");
    (db.getClientReportById as any).mockResolvedValueOnce({
      id: 11,
      organizationId: 7,
      title: "Operational Intelligence Report — May 2026",
      publicRef: "IOSKY-R-12AB-34CD",
      pdfKey: "reports/iosky-r-12ab.pdf",
      status: "delivered",
      score: 84,
      summary: null,
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.requestReportSignedUrl({ id: 11 });
    expect(out.url).toBe("https://signed.example/reports/iosky-r-12ab.pdf");
    expect(out.expiresInSec).toBe(600);
    expect(out.publicRef).toBe("IOSKY-R-12AB-34CD");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    const auditCall = (db.appendLoginAudit as any).mock.calls[0][0];
    expect(auditCall.reason).toBe("report-download:IOSKY-R-12AB-34CD");
    expect(auditCall.provider).toBe("client-portal");
  });

  it("requestReportSignedUrl rejects when report is not in caller's org", async () => {
    const db = await import("./db");
    (db.getClientReportById as any).mockResolvedValueOnce(null); // tenant scope returns null
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(caller.clientPortal.requestReportSignedUrl({ id: 999 })).rejects.toThrow(
      /not found/i,
    );
  });

  it("requestReportSignedUrl rejects with PRECONDITION when pdfKey is missing", async () => {
    const db = await import("./db");
    (db.getClientReportById as any).mockResolvedValueOnce({
      id: 12,
      organizationId: 7,
      title: "Pending Report",
      publicRef: "IOSKY-R-PEND-0001",
      pdfKey: null,
      status: "draft",
      score: 0,
      summary: null,
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(caller.clientPortal.requestReportSignedUrl({ id: 12 })).rejects.toThrow(
      /no downloadable pdf/i,
    );
  });

  it("recommendationAction proposal: flips status to in_progress, audits, notifies owner", async () => {
    const db = await import("./db");
    const { notifyOwner } = await import("./_core/notification");
    (db.getClientRecommendationById as any).mockResolvedValueOnce({
      id: 55,
      organizationId: 7,
      reportId: 11,
      title: "Centralize CRM signals into a single intelligence layer",
      category: "intelligence",
      impact: "high",
      status: "pending",
      body: "Today CRM signals live in three silos…",
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.recommendationAction({
      id: 55,
      kind: "proposal",
    });
    expect(out.id).toBe(55);
    expect(out.kind).toBe("proposal");
    expect(out.status).toBe("in_progress");
    expect(db.updateClientRecommendationStatus).toHaveBeenCalledTimes(1);
    const updateArgs = (db.updateClientRecommendationStatus as any).mock.calls[0];
    expect(updateArgs[0]).toBe(7); // org-scoped
    expect(updateArgs[1]).toBe(55);
    expect(updateArgs[2]).toBe("in_progress");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toBe(
      "rec-action:proposal:55",
    );
    expect(db.appendClientNotification).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("recommendationAction discuss: audits + notifies feed but does NOT flip status", async () => {
    const db = await import("./db");
    (db.getClientRecommendationById as any).mockResolvedValueOnce({
      id: 33,
      organizationId: 7,
      reportId: null,
      title: "Tighten incident response runbook",
      category: "security",
      impact: "medium",
      status: "pending",
      body: null,
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.recommendationAction({
      id: 33,
      kind: "discuss",
    });
    expect(out.status).toBe("pending"); // unchanged
    expect(db.updateClientRecommendationStatus).not.toHaveBeenCalled();
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect(db.appendClientNotification).toHaveBeenCalledTimes(1);
  });

  it("recommendationAction dismiss: flips to dismissed, audits, no owner notify", async () => {
    const db = await import("./db");
    const { notifyOwner } = await import("./_core/notification");
    (db.getClientRecommendationById as any).mockResolvedValueOnce({
      id: 99,
      organizationId: 7,
      reportId: null,
      title: "Lower-impact reorg suggestion",
      category: "operations",
      impact: "low",
      status: "pending",
      body: null,
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.recommendationAction({
      id: 99,
      kind: "dismiss",
    });
    expect(out.status).toBe("dismissed");
    expect(db.updateClientRecommendationStatus).toHaveBeenCalledTimes(1);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("recommendationAction rejects when rec is in another tenant", async () => {
    const db = await import("./db");
    (db.getClientRecommendationById as any).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.recommendationAction({ id: 12345, kind: "proposal" }),
    ).rejects.toThrow(/not found/i);
  });

  it("cancelStrategyCall: cancels a future booking, audits, notifies owner", async () => {
    const db = await import("./db");
    const { notifyOwner } = await import("./_core/notification");
    const futureMs = Date.now() + 1000 * 60 * 60 * 24 * 3; // 3 days out
    (db.getBookingForOrg as any).mockResolvedValueOnce({
      id: 77,
      publicRef: "IOSKY-B-AB12-CD34",
      organizationId: null,
      slotStartMs: futureMs,
      durationMin: 60,
      timezone: "UTC",
      email: "alex@acme.test",
      status: "confirmed",
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.cancelStrategyCall({
      id: 77,
      reason: "Conflict with board prep",
    });
    expect(out.publicRef).toBe("IOSKY-B-AB12-CD34");
    expect(out.status).toBe("cancelled");
    expect(db.updateBookingStatus).toHaveBeenCalledWith(77, "cancelled");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toBe(
      "booking-cancel:IOSKY-B-AB12-CD34",
    );
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("cancelStrategyCall: blocks self-cancel inside the 60-min window", async () => {
    const db = await import("./db");
    const soonMs = Date.now() + 1000 * 60 * 30; // 30 min away
    (db.getBookingForOrg as any).mockResolvedValueOnce({
      id: 78,
      publicRef: "IOSKY-B-SOON-0001",
      slotStartMs: soonMs,
      durationMin: 60,
      timezone: "UTC",
      email: "alex@acme.test",
      status: "confirmed",
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.cancelStrategyCall({ id: 78 }),
    ).rejects.toThrow(/within 60 minutes/i);
    expect(db.updateBookingStatus).not.toHaveBeenCalled();
  });

  it("cancelStrategyCall: rejects when booking is in another tenant", async () => {
    const db = await import("./db");
    (db.getBookingForOrg as any).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.cancelStrategyCall({ id: 9999 }),
    ).rejects.toThrow(/not found/i);
  });

  it("requestInvoiceCheckout: open invoice triggers manual flow + audit + notify", async () => {
    const db = await import("./db");
    const { notifyOwner } = await import("./_core/notification");
    (db.getClientInvoiceById as any).mockResolvedValueOnce({
      id: 22,
      organizationId: 7,
      number: "IOSKY-INV-2026-0042",
      description: "Q2 retainer",
      status: "open",
      amountCents: 250000,
      currency: "EUR",
      issuedMs: Date.now() - 86_400_000,
      dueMs: Date.now() + 86_400_000 * 14,
      pdfKey: "invoices/iosky-inv-0042.pdf",
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.requestInvoiceCheckout({ id: 22 });
    expect(out.mode).toBe("manual");
    expect(out.instructionsUrl).toContain("/client-portal/billing?pay=");
    expect(out.invoice.number).toBe("IOSKY-INV-2026-0042");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toBe(
      "invoice-pay-intent:IOSKY-INV-2026-0042",
    );
    expect(db.appendClientNotification).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("requestInvoiceCheckout: rejects already-paid invoices", async () => {
    const db = await import("./db");
    (db.getClientInvoiceById as any).mockResolvedValueOnce({
      id: 23,
      organizationId: 7,
      number: "IOSKY-INV-2026-0001",
      description: "Onboarding",
      status: "paid",
      amountCents: 100000,
      currency: "EUR",
      issuedMs: Date.now(),
      dueMs: null,
      pdfKey: null,
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.requestInvoiceCheckout({ id: 23 }),
    ).rejects.toThrow(/already paid/i);
  });

  it("requestInvoiceCheckout: rejects when invoice belongs to another tenant", async () => {
    const db = await import("./db");
    (db.getClientInvoiceById as any).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.requestInvoiceCheckout({ id: 9999 }),
    ).rejects.toThrow(/not found/i);
  });

  it("uploadDocument: rejects blocked extensions", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.uploadDocument({
        name: "payload.exe",
        category: "general",
        contentBase64: Buffer.from("hello world").toString("base64"),
      }),
    ).rejects.toThrow(/not allowed/i);
  });

  it("uploadDocument: rejects empty payload", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.uploadDocument({
        name: "empty.pdf",
        category: "general",
        // 8-char base64 of zero bytes → buffer length 0 once decoded
        contentBase64: "AAAAAAAA".replace(/A/g, ""), // empty after replace
      } as any),
    ).rejects.toThrow();
  });

  it("uploadDocument: persists, audits, notifies", async () => {
    const db = await import("./db");
    const storage = await import("./storage");
    const { notifyOwner } = await import("./_core/notification");
    (storage.storagePut as any).mockResolvedValueOnce({
      bucket: "client-portal",
      key: "7/documents/123-test.pdf",
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.uploadDocument({
      name: "brief.pdf",
      category: "deliverable",
      mimeType: "application/pdf",
      contentBase64: Buffer.from("hello world").toString("base64"),
    });
    expect(out.id).toBe(999);
    expect(out.fileKey).toBe("7/documents/123-test.pdf");
    expect(db.insertClientDocument).toHaveBeenCalledTimes(1);
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toContain(
      "document-upload:",
    );
    expect(db.appendClientNotification).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledTimes(1);
  });

  it("uploadDocument: passes supersedesDocumentId through to insertClientDocument (Milestone 2 §2.6 versioning)", async () => {
    const db = await import("./db");
    const storage = await import("./storage");
    (storage.storagePut as any).mockResolvedValueOnce({
      bucket: "client-portal",
      key: "7/documents/456-brief-v2.pdf",
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await caller.clientPortal.uploadDocument({
      name: "brief-v2.pdf",
      category: "deliverable",
      contentBase64: Buffer.from("hello world v2").toString("base64"),
      supersedesDocumentId: 5,
    });
    expect((db.insertClientDocument as any).mock.calls.at(-1)[0]).toMatchObject({
      supersedesDocumentId: 5,
    });
  });

  it("uploadDocument: surfaces a version-linking failure as BAD_REQUEST", async () => {
    const db = await import("./db");
    const storage = await import("./storage");
    (storage.storagePut as any).mockResolvedValueOnce({
      bucket: "client-portal",
      key: "7/documents/456-brief-v2.pdf",
    });
    (db.insertClientDocument as any).mockRejectedValueOnce(
      new Error("Cannot supersede document 999: not found in this organization."),
    );
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.uploadDocument({
        name: "brief-v2.pdf",
        category: "deliverable",
        contentBase64: Buffer.from("hello world v2").toString("base64"),
        supersedesDocumentId: 999,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("markNotificationRead: marks a notification read and surfaces NOT_FOUND for an unknown one (Milestone 2 §2.7)", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const r = await caller.clientPortal.markNotificationRead({ notificationId: 5 });
    expect(r).toMatchObject({ id: 1 });
    expect(db.setClientNotificationRead).toHaveBeenCalledWith(7, 5, true);

    (db.setClientNotificationRead as any).mockResolvedValueOnce(null);
    await expect(
      caller.clientPortal.markNotificationRead({ notificationId: 999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("archiveNotification: archives a notification (Milestone 2 §2.7)", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const r = await caller.clientPortal.archiveNotification({ notificationId: 5 });
    expect(r).toMatchObject({ status: "archived" });
    expect(db.archiveClientNotification).toHaveBeenCalledWith(7, 5);
  });

  it("requestDocumentDeletion: only the uploader can delete their file", async () => {
    const db = await import("./db");
    (db.getClientDocumentById as any).mockResolvedValueOnce({
      id: 55,
      organizationId: 7,
      name: "contract.pdf",
      category: "contract",
      fileKey: "client-portal/7/contract.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf",
      uploadedByUserId: 999, // someone else uploaded it
      uploadedBy: "IO SKY Team",
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.requestDocumentDeletion({ id: 55 }),
    ).rejects.toThrow(/Only documents you uploaded/i);
    expect(db.deleteClientDocumentById).not.toHaveBeenCalled();
  });

  it("requestDocumentDeletion: removes own file + audits", async () => {
    const db = await import("./db");
    (db.getClientDocumentById as any).mockResolvedValueOnce({
      id: 56,
      organizationId: 7,
      name: "my-upload.pdf",
      category: "general",
      fileKey: "client-portal/7/my-upload.pdf",
      sizeBytes: 2048,
      mimeType: "application/pdf",
      uploadedByUserId: 1, // matches makeCtx default user.id
      uploadedBy: "Alex Tester",
      createdAt: new Date(),
    });
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.requestDocumentDeletion({ id: 56 });
    expect(out.removed).toBe(true);
    expect(db.deleteClientDocumentById).toHaveBeenCalledWith(7, 56);
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    const storage = await import("./storage");
    expect(storage.storageDelete).toHaveBeenCalledWith("client-portal", "client-portal/7/my-upload.pdf");
  });

  it("requestDocumentDeletion: DB row is removed even if the storage-object delete fails (best-effort, not a partial-failure error)", async () => {
    const db = await import("./db");
    const storage = await import("./storage");
    (db.getClientDocumentById as any).mockResolvedValueOnce({
      id: 57,
      organizationId: 7,
      name: "flaky-storage.pdf",
      category: "general",
      fileKey: "client-portal/7/flaky-storage.pdf",
      sizeBytes: 512,
      mimeType: "application/pdf",
      uploadedByUserId: 1,
      uploadedBy: "Alex Tester",
      createdAt: new Date(),
    });
    (storage.storageDelete as any).mockRejectedValueOnce(new Error("bucket unreachable"));
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.requestDocumentDeletion({ id: 57 });
    expect(out.removed).toBe(true);
    expect(db.deleteClientDocumentById).toHaveBeenCalledWith(7, 57);
  });

  it("markMessagesRead returns affected-rows count and stays tenant-scoped", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.markMessagesRead();
    expect(out.updated).toBe(3);
    expect(db.markIoSkyMessagesRead).toHaveBeenCalledWith(7);
  });

  it("updateDisplayName: persists trimmed name and audits the change", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.updateDisplayName({
      name: "  Alex Updated  ",
    });
    expect(out.name).toBe("Alex Updated");
    expect(db.updateUserDisplayName).toHaveBeenCalledWith(1, "Alex Updated");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toContain(
      "profile-update:name:Alex Updated",
    );
  });

  it("updateDisplayName: rejects names shorter than 2 chars", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.updateDisplayName({ name: "A" }),
    ).rejects.toThrow();
  });

  it("setMfaMethod: enables email MFA and audits the change", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const out = await caller.clientPortal.setMfaMethod({ method: "email" });
    expect(out.method).toBe("email");
    expect(db.updateUserMfaMethod).toHaveBeenCalledWith(1, "email");
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toBe(
      "mfa-enabled:email",
    );
  });

  it("setMfaMethod: rejects unknown methods at the schema layer", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    await expect(
      caller.clientPortal.setMfaMethod({ method: "sms" as any }),
    ).rejects.toThrow();
  });

  it("revokeSession: clears the IO SKY cookie and audits the revocation", async () => {
    const db = await import("./db");
    const cleared: Array<{ name: string }> = [];
    const ctx = makeCtx({ role: "client", orgId: 7 });
    (ctx as any).res.clearCookie = (name: string) => {
      cleared.push({ name });
    };
    const caller = appRouter.createCaller(ctx);
    const out = await caller.clientPortal.revokeSession({ everywhere: true });
    expect(out.ok).toBe(true);
    expect(out.everywhere).toBe(true);
    expect(cleared.length).toBeGreaterThan(0);
    expect(db.appendLoginAudit).toHaveBeenCalledTimes(1);
    expect((db.appendLoginAudit as any).mock.calls[0][0].reason).toBe(
      "session-revoke:everywhere",
    );
  });

  it("surfaces the security center payload with recentLogins array", async () => {
    const caller = appRouter.createCaller(makeCtx({ role: "client", orgId: 7 }));
    const sec = await caller.clientPortal.security();
    expect(sec.recentLogins).toEqual([]);
    expect(sec.mfaMethod).toBeNull();
  });
});
