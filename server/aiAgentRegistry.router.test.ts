/*
 * G02: the admin API for the AI Agent Registry. Only a Super Admin edits it,
 * bad registry input is refused with a readable reason, and an update that does
 * not mention a registry field passes nothing for it to the data layer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  upsertAiAgent: vi.fn(),
  appendLoginAudit: vi.fn(async () => undefined),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    upsertAiAgent: m.upsertAiAgent,
    appendLoginAudit: m.appendLoginAudit,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 5, kind: "totp", verifiedAt: new Date() }]),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const ctx = (role: string | null): TrpcContext => ({
  user: role ? ({ id: 5, openId: "u", email: "u@example.com", name: "U", loginMethod: "local", role, organizationId: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never) : null,
  impersonation: null,
  req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
  res: { clearCookie: () => {} } as TrpcContext["res"],
});

const base = { key: "support_scribe", name: "Support scribe", permissions: ["draft_reply"], requiresHumanApproval: true, status: "active" as const };
const call = (role: string | null, input: Record<string, unknown>) => appRouter.createCaller(ctx(role)).adminOps.upsertAiAgent({ ...base, ...input } as never);

beforeEach(() => {
  vi.clearAllMocks();
  m.upsertAiAgent.mockImplementation(async (a: { key: string; status: string }) => ({ id: 1, key: a.key, status: a.status, registryVersion: 4 }));
});

describe("adminOps.upsertAiAgent", () => {
  it("is for the Super Admin only", async () => {
    for (const role of ["admin", "technical_operator", "client", "developer", null]) {
      await expect(call(role, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(m.upsertAiAgent).not.toHaveBeenCalled();
  });

  it("saves a full registry entry and records the registry version in the audit trail", async () => {
    const r = await call("super_admin", { businessFunction: "Support", supportedModules: ["support"], tools: ["search_documents"], knowledgeSources: ["business_rules"], maxAuthority: "draft_only", escalationRules: "Hand over to the support lead", responsibleAdminUserId: 7, capabilities: ["draft_reply"] });
    expect(r).toMatchObject({ key: "support_scribe", registryVersion: 4 });
    expect(m.upsertAiAgent).toHaveBeenCalledWith(expect.objectContaining({ businessFunction: "Support", knowledgeSources: ["business_rules"], maxAuthority: "draft_only", responsibleAdminUserId: 7 }));
    await new Promise((r2) => setTimeout(r2, 10));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("registry v4") }));
  });

  it("a request that omits the registry fields passes none of them on (so none can be blanked)", async () => {
    await call("super_admin", {});
    const arg = m.upsertAiAgent.mock.calls[0][0] as Record<string, unknown>;
    for (const f of ["businessFunction", "capabilities", "supportedModules", "tools", "knowledgeSources", "escalationRules", "maxAuthority", "responsibleAdminUserId"]) {
      expect(arg[f], f).toBeUndefined();
    }
  });

  it("refuses an unknown knowledge source, a bad identifier and an authority conflict, saving nothing", async () => {
    await expect(call("super_admin", { knowledgeSources: ["the_whole_internet"] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("not a known source") });
    await expect(call("super_admin", { tools: ["Not A Slug"] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(call("super_admin", { maxAuthority: "act_autonomously", requiresHumanApproval: true })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("autonomous") });
    await expect(call("super_admin", { maxAuthority: "root" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.upsertAiAgent).not.toHaveBeenCalled();
  });

  it("refuses a responsible admin who is not an admin", async () => {
    m.upsertAiAgent.mockResolvedValueOnce("invalid_responsible_admin");
    await expect(call("super_admin", { responsibleAdminUserId: 99 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("admin or super admin") });
  });

  it("autonomous authority is allowed only for an agent that does not require approval", async () => {
    await expect(call("super_admin", { maxAuthority: "act_autonomously", requiresHumanApproval: false })).resolves.toMatchObject({ key: "support_scribe" });
  });
});
