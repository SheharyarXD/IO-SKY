/*
 * Lead ownership (supports C01): who may own a lead, and the endpoint that sets it.
 * The SQL in setLeadOwner and the lead_owners unique index (migration 0045) have not
 * run against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canOwnLeads, OWNER_REFUSAL_TEXT, planOwnerAssignment } from "../shared/leadOwnership";

describe("who can own a lead", () => {
  it("admins and super admins only", () => {
    expect(canOwnLeads("admin")).toBe(true);
    expect(canOwnLeads("super_admin")).toBe(true);
    for (const r of ["technical_operator", "developer", "client", "user", "", null, undefined]) expect(canOwnLeads(r as never), String(r)).toBe(false);
  });
  it("planOwnerAssignment checks existence and role, and always allows clearing", () => {
    expect(planOwnerAssignment({ ownerUserId: null, ownerRole: undefined, ownerExists: false })).toEqual({ ok: true, ownerUserId: null });
    expect(planOwnerAssignment({ ownerUserId: 5, ownerRole: "admin", ownerExists: true })).toEqual({ ok: true, ownerUserId: 5 });
    expect(planOwnerAssignment({ ownerUserId: 5, ownerRole: "client", ownerExists: true })).toEqual({ ok: false, reason: "owner_not_staff" });
    expect(planOwnerAssignment({ ownerUserId: 5, ownerRole: "admin", ownerExists: false })).toEqual({ ok: false, reason: "owner_not_found" });
    for (const k of Object.keys(OWNER_REFUSAL_TEXT)) expect(OWNER_REFUSAL_TEXT[k as keyof typeof OWNER_REFUSAL_TEXT].length).toBeGreaterThan(10);
  });
});

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  setLeadOwner: vi.fn(),
}));
vi.mock("./db/crm", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, setLeadOwner: (...a: unknown[]) => d.setLeadOwner(...a) };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit };
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

describe("adminOps.assignLeadOwner", () => {
  beforeEach(() => vi.clearAllMocks());
  it("is staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) await expect(ops(role).assignLeadOwner({ leadId: 1, ownerUserId: 5 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.setLeadOwner).not.toHaveBeenCalled();
  });
  it("assigns, passes the acting admin, and audits", async () => {
    d.setLeadOwner.mockResolvedValueOnce({ ok: true, ownerUserId: 5 });
    await expect(ops().assignLeadOwner({ leadId: 3, ownerUserId: 5 })).resolves.toEqual({ ok: true, ownerUserId: 5 });
    expect(d.setLeadOwner).toHaveBeenCalledWith({ leadId: 3, ownerUserId: 5, actorUserId: 99 });
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.lead.owner(lead=3->5)") }));
  });
  it("clears the owner with null and audits it as none", async () => {
    d.setLeadOwner.mockResolvedValueOnce({ ok: true, ownerUserId: null });
    await ops().assignLeadOwner({ leadId: 3, ownerUserId: null });
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.lead.owner(lead=3->none)") }));
  });
  it("maps refusals and audits nothing on failure", async () => {
    d.setLeadOwner.mockResolvedValueOnce({ ok: false, reason: "lead_not_found" });
    await expect(ops().assignLeadOwner({ leadId: 3, ownerUserId: 5 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.setLeadOwner.mockResolvedValueOnce({ ok: false, reason: "owner_not_staff" });
    await expect(ops().assignLeadOwner({ leadId: 3, ownerUserId: 5 })).rejects.toMatchObject({ code: "BAD_REQUEST", message: OWNER_REFUSAL_TEXT.owner_not_staff });
    d.setLeadOwner.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    await expect(ops().assignLeadOwner({ leadId: 3, ownerUserId: 5 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(d.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.lead.owner") }));
  });
  it("rejects bad ids before reaching the store", async () => {
    for (const bad of [{ leadId: 0, ownerUserId: 5 }, { leadId: 1, ownerUserId: 0 }, { leadId: 1, ownerUserId: 1.5 }, { leadId: 1 }]) await expect(ops().assignLeadOwner(bad as never), JSON.stringify(bad)).rejects.toThrow();
    expect(d.setLeadOwner).not.toHaveBeenCalled();
  });
});
