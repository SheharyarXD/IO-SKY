/*
 * Audit coverage (SRS 20.5, BR-020): every business mutation leaves a record.
 *
 * This reads the router source and fails when a new mutation is added with no
 * audit call and no entry in the central allowlist, so coverage cannot quietly
 * regress. It is deliberately a source scan: it catches the omission at the
 * moment it is made, which a behavioural test of existing procedures cannot.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { shouldAuditMutation } from "../shared/srsRules";

const ROUTERS = ["admin", "adminOps", "bookingAdmin", "clientPortal", "developer", "ops", "privacy", "profile", "mfa"];

/** Mutations that only flip a read or archived flag on the caller's own data. */
const TRIVIAL = new Set([
  "markNotificationsRead",
  "markNotificationRead",
  "archiveNotification",
  "markMessagesRead",
  "setNotificationPreference",
]);

const SELF_AUDIT = /recordAdminEvent|appendLoginAudit|appendDeveloperAudit|appendBookingEvent|recordPrivacy|appendPrivacy|createPrivacyRequestEvent|logPrivacy/;

function mutationsIn(router: string): Array<{ name: string; body: string }> {
  const src = fs.readFileSync(path.resolve(__dirname, "routers", `${router}.ts`), "utf8").replace(/\r\n/g, "\n");
  const starts: Array<{ name: string; at: number }> = [];
  const re = /\n {2}(\w+): \w*[pP]rocedure\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) starts.push({ name: m[1], at: m.index });
  const out: Array<{ name: string; body: string }> = [];
  for (let i = 0; i < starts.length; i++) {
    const body = src.slice(starts[i].at, i + 1 < starts.length ? starts[i + 1].at : src.length);
    if (body.includes(".mutation(")) out.push({ name: starts[i].name, body });
  }
  return out;
}

describe("audit coverage", () => {
  for (const router of ROUTERS) {
    it(`${router}: every mutation audits itself or is on the central list`, () => {
      const unaudited = mutationsIn(router)
        .filter((m) => !TRIVIAL.has(m.name))
        .filter((m) => !SELF_AUDIT.test(m.body))
        .filter((m) => !shouldAuditMutation(`${router}.${m.name}`))
        .map((m) => m.name);
      expect(unaudited, `Add an audit call, or add the path to AUDITED_MUTATION_PATHS: ${unaudited.join(", ")}`).toEqual([]);
    });
  }

  it("finds mutations to check, so the scan is not passing on an empty parse", () => {
    expect(mutationsIn("admin").length).toBeGreaterThan(20);
    expect(mutationsIn("adminOps").length).toBeGreaterThan(20);
    expect(mutationsIn("bookingAdmin").length).toBeGreaterThan(5);
  });
});

describe("shouldAuditMutation", () => {
  it("covers the booking admin router and the listed client actions", () => {
    expect(shouldAuditMutation("bookingAdmin.markNoShow")).toBe(true);
    expect(shouldAuditMutation("bookingAdmin.upsertAvailabilityRule")).toBe(true);
    expect(shouldAuditMutation("clientPortal.sendMessage")).toBe(true);
    expect(shouldAuditMutation("ops.acknowledgeSecurityEvent")).toBe(true);
  });
  it("does not audit unrelated paths", () => {
    expect(shouldAuditMutation("clientPortal.markNotificationRead")).toBe(false);
    expect(shouldAuditMutation("aiScans.submitQuestionnaire")).toBe(false);
  });
});

// ---- the middleware itself -----------------------------------------------
const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  decideProjectApproval: vi.fn(),
  createAdminNotification: vi.fn(async () => null),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, appendLoginAudit: m.appendLoginAudit, decideProjectApproval: m.decideProjectApproval, createAdminNotification: m.createAdminNotification };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function clientCtx(): TrpcContext {
  return {
    user: { id: 31, openId: "c", email: "c@example.com", name: "C", loginMethod: "local", role: "client", organizationId: 8, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("mutation audit middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records a successful listed mutation with the caller and the path", async () => {
    m.decideProjectApproval.mockResolvedValueOnce({ id: 4, title: "Design", status: "approved" });
    await appRouter.createCaller(clientCtx()).clientPortal.decideApproval({ id: 4, decision: "approved" });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ userId: 31, provider: "client", outcome: "success", reason: "mutation:clientPortal.decideApproval" }));
  });

  it("records nothing when the mutation fails", async () => {
    m.decideProjectApproval.mockResolvedValueOnce("not_found");
    await expect(appRouter.createCaller(clientCtx()).clientPortal.decideApproval({ id: 4, decision: "approved" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await new Promise((r) => setTimeout(r, 20));
    expect(m.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: "mutation:clientPortal.decideApproval" }));
  });
});
