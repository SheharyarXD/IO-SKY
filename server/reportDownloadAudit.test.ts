/*
 * M4-01 (SRS 9.10 "Log all report downloads"): every PDF download of an AI Scan
 * report, and every refused attempt, leaves an audit row with who, what and when,
 * and no report content and no access token. Auditing never changes the result.
 * No database, storage or PDF renderer is used.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  scans: new Map<string, Record<string, any>>(),
  audit: [] as Array<Record<string, any>>,
  appendReportDownloadAudit: vi.fn(),
  setAiScanReportPdfKey: vi.fn(async () => undefined),
  storageGetSignedUrl: vi.fn(async (_b: string, key: string) => `https://signed.example/${key}?sig=1`),
  storagePut: vi.fn(async (_b: string, key: string) => ({ key })),
  renderAiScanReportPdf: vi.fn(async () => Buffer.from("%PDF-test")),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getAiScanByToken: vi.fn(async (t: string) => m.scans.get(t) ?? null),
    setAiScanReportPdfKey: m.setAiScanReportPdfKey,
    appendReportDownloadAudit: m.appendReportDownloadAudit,
  };
});
vi.mock("./storage", () => ({ storageGetSignedUrl: m.storageGetSignedUrl, storagePut: m.storagePut }));
vi.mock("./aiScanReportPdf", () => ({ renderAiScanReportPdf: m.renderAiScanReportPdf }));

import { aiScansRouter } from "./routers/aiScans";

const TOKEN = "t".repeat(48);
const PUBLISHED = new Date("2026-10-20T10:00:00Z");
const scan = (over: Record<string, unknown> = {}) => ({
  id: 77, reportToken: TOKEN, tier: "growth", email: "owner@acme.test", company: "Acme", status: "ready", reportStatus: "published", publishedAt: PUBLISHED, createdAt: new Date(),
  reportPayload: JSON.stringify({ overallScore: 70, executiveSummary: "VERY-CONFIDENTIAL-FINDINGS", dimensions: [], opportunities: [], roadmap: [], disclaimers: [] }), reportPdfKey: null, ...over,
});
const caller = (user: { id: number; email: string; role: string; organizationId?: number | null } | null, ip = "203.0.113.5") =>
  aiScansRouter.createCaller({ user, impersonation: null, req: { headers: { "user-agent": "vitest-browser", "x-forwarded-for": ip }, socket: { remoteAddress: ip } } as never, res: {} as never } as never);
const owner = { id: 9, email: "Owner@Acme.test", role: "client", organizationId: 4 };
const stranger = { id: 8, email: "mallory@other.test", role: "client", organizationId: 5 };
const staff = { id: 1, email: "staff@iosky.test", role: "admin", organizationId: null };
const settle = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  m.scans.clear();
  m.audit.length = 0;
  vi.clearAllMocks();
  m.scans.set(TOKEN, scan());
  m.appendReportDownloadAudit.mockImplementation(async (row: Record<string, any>) => void m.audit.push(row));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("allowed downloads are recorded", () => {
  it("the owner's PDF download is recorded with who, which report, which release and when, and nothing sensitive", async () => {
    const r = await caller(owner).getReportPdf({ token: TOKEN });
    expect(r.url).toContain("https://signed.example/");
    expect(m.audit).toHaveLength(1);
    expect(m.audit[0]).toMatchObject({
      scanId: 77, action: "pdf_download", outcome: "allowed", denyReason: null, actorKind: "owner", actorUserId: 9, actorRole: "client", organizationId: 4,
      reportStatus: "published", reportPublishedAt: PUBLISHED, tier: "growth", ip: "203.0.113.5", userAgent: "vitest-browser",
    });
    const flat = JSON.stringify(m.audit);
    expect(flat).not.toContain(TOKEN); // never the token itself
    expect(flat).not.toContain("VERY-CONFIDENTIAL"); // never report content
    expect(flat).not.toContain(r.url); // never the signed link
    expect(m.audit[0].tokenFingerprint).toHaveLength(12);
    expect(TOKEN).not.toContain(m.audit[0].tokenFingerprint);
  });

  it("a staff download is recorded as staff, a free guest scan as a guest link", async () => {
    await caller(staff).getReportPdf({ token: TOKEN });
    m.scans.set(TOKEN, scan({ tier: "free" }));
    await caller(null).getReportPdf({ token: TOKEN });
    expect(m.audit.map((a) => [a.actorKind, a.actorUserId, a.organizationId])).toEqual([["staff", 1, null], ["guest_link", null, null]]);
  });

  it("is recorded on the cached-PDF path too, and the link is the cached object's", async () => {
    m.scans.set(TOKEN, scan({ reportPdfKey: "ai-scan-reports/existing.pdf" }));
    const r = await caller(owner).getReportPdf({ token: TOKEN });
    expect(r.url).toContain("existing.pdf");
    expect(m.renderAiScanReportPdf).not.toHaveBeenCalled();
    expect(m.audit).toHaveLength(1);
  });

  it("one row per download, however the PDF was produced", async () => {
    await caller(owner).getReportPdf({ token: TOKEN });
    await caller(owner).getReportPdf({ token: TOKEN });
    expect(m.audit).toHaveLength(2);
  });

  it("an unpublished report cannot be downloaded and is not recorded as a download", async () => {
    m.scans.set(TOKEN, scan({ reportStatus: "awaiting_expert_review" }));
    await expect(caller(owner).getReportPdf({ token: TOKEN })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(m.audit.filter((a) => a.outcome === "allowed")).toHaveLength(0);
    expect(m.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("a failed URL issue is not recorded as a download", async () => {
    m.storageGetSignedUrl.mockRejectedValueOnce(new Error("storage down"));
    await expect(caller(owner).getReportPdf({ token: TOKEN })).rejects.toBeTruthy();
    expect(m.audit.filter((a) => a.outcome === "allowed")).toHaveLength(0);
  });
});

describe("denied attempts are recorded with the reason", () => {
  it("an anonymous holder of a paid report's link: login required, recorded as anonymous with no user", async () => {
    await expect(caller(null).getReportPdf({ token: TOKEN })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(m.audit[0]).toMatchObject({ outcome: "denied", denyReason: "login_required", actorKind: "anonymous", actorUserId: null, organizationId: null, action: "pdf_download" });
    expect(m.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("another organisation's user: forbidden, recorded with that user and organisation", async () => {
    await expect(caller(stranger).getReportPdf({ token: TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.audit[0]).toMatchObject({ outcome: "denied", denyReason: "forbidden", actorKind: "other_account", actorUserId: 8, organizationId: 5 });
    expect(m.storageGetSignedUrl).not.toHaveBeenCalled();
  });

  it("a refused view is recorded too, as a view", async () => {
    await expect(caller(stranger).getReport({ token: TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.audit[0]).toMatchObject({ action: "view", outcome: "denied" });
  });

  it("a granted view is not logged as a download", async () => {
    await caller(owner).getReport({ token: TOKEN });
    expect(m.audit).toHaveLength(0);
  });

  it("repeated attempts from one source collapse to one row, while a different source is recorded separately", async () => {
    for (let i = 0; i < 6; i++) await caller(null, "198.51.100.1").getReportPdf({ token: TOKEN }).catch(() => undefined);
    await caller(null, "198.51.100.2").getReportPdf({ token: TOKEN }).catch(() => undefined);
    expect(m.audit.map((a) => a.ip)).toEqual(["198.51.100.1", "198.51.100.2"]);
  });

  it("an unknown token is not found and writes no row (there is no report to attach it to)", async () => {
    await expect(caller(owner).getReportPdf({ token: "z".repeat(48) })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.audit).toHaveLength(0);
  });
});

describe("auditing never changes the outcome", () => {
  it("a failing audit write does not block a legitimate download", async () => {
    m.appendReportDownloadAudit.mockRejectedValue(new Error("table missing"));
    const r = await caller(owner).getReportPdf({ token: TOKEN });
    expect(r.url).toContain("https://signed.example/");
  });

  it("a failing audit write does not turn a refusal into a different error", async () => {
    m.appendReportDownloadAudit.mockRejectedValue(new Error("table missing"));
    await expect(caller(stranger).getReportPdf({ token: TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(null).getReportPdf({ token: TOKEN })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

void settle;
