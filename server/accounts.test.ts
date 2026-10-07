/*
 * Account activation (SRS 8.7): the public surface must give nothing away on a
 * bad link, enforce the password and agreement rules, sign the new user in, and
 * invitations must be role-gated and never expose the link to the inviter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getInvitationByToken: vi.fn(),
  activateAccount: vi.fn(),
  getLiveAgreementVersion: vi.fn(),
  recordAgreementAcceptance: vi.fn(async () => true),
  appendLoginAudit: vi.fn(async () => {}),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
  listInvitations: vi.fn(async () => []),
  emitNotification: vi.fn(async () => ({ delivered: true })),
  dispatchSimpleEmail: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]),
    getInvitationByToken: m.getInvitationByToken,
    activateAccount: m.activateAccount,
    getLiveAgreementVersion: m.getLiveAgreementVersion,
    recordAgreementAcceptance: m.recordAgreementAcceptance,
    appendLoginAudit: m.appendLoginAudit,
    createInvitation: m.createInvitation,
    revokeInvitation: m.revokeInvitation,
    listInvitations: m.listInvitations,
  };
});
vi.mock("./notificationDispatcher", () => ({ emitNotification: m.emitNotification }));
vi.mock("./email", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, dispatchSimpleEmail: (...a: unknown[]) => m.dispatchSimpleEmail(...a) };
});
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: vi.fn(async () => "session-token"), authenticateRequest: vi.fn(async () => null) } }));

import { COOKIE_NAME } from "@shared/const";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const TOKEN = "t".repeat(43);
const pending = (over: Record<string, unknown> = {}) => ({
  state: "pending",
  invitation: { id: 5, email: "new.person@example.com", role: "client", organizationId: 3, expiresAt: new Date(Date.now() + 86_400_000), ...over },
});

function publicCtx() {
  const cookie = vi.fn();
  const ctx = {
    user: null,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, socket: { remoteAddress: "127.0.0.1" } },
    res: { cookie, clearCookie: () => {} },
  } as unknown as TrpcContext;
  return { ctx, cookie };
}

function staffCtx(role: "admin" | "super_admin" | "client"): TrpcContext {
  return {
    user: { id: 77, openId: "s", email: "boss@example.com", name: "Boss", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as never,
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getLiveAgreementVersion.mockImplementation(async (kind: string) => ({ document: { title: kind }, version: { id: kind === "privacy-policy" ? 11 : 12 } }));
  m.dispatchSimpleEmail.mockResolvedValue({ ok: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("accounts.activationDetails", () => {
  it("returns the email, role, MFA requirement and live agreements for a valid link", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending({ role: "admin" }));
    const r = await appRouter.createCaller(publicCtx().ctx).accounts.activationDetails({ token: TOKEN });
    expect(r).toMatchObject({ email: "new.person@example.com", role: "admin", mfaRequired: true });
    expect(r.agreements.map((a) => a.kind)).toEqual(["privacy-policy", "terms-of-service"]);
  });

  it("gives the same answer for an unknown, expired, revoked or used link", async () => {
    const msgs = new Set<string>();
    for (const found of [null, { ...pending(), state: "expired" }, { ...pending(), state: "revoked" }, { ...pending(), state: "accepted" }]) {
      m.getInvitationByToken.mockResolvedValueOnce(found);
      await appRouter.createCaller(publicCtx().ctx).accounts.activationDetails({ token: TOKEN }).catch((e) => msgs.add(e.message));
    }
    expect(msgs.size).toBe(1);
  });
});

describe("accounts.activate", () => {
  const input = (over: Record<string, unknown> = {}) => ({ token: TOKEN, name: "New Person", password: "correct7horse9battery", acceptedAgreements: true as const, ...over });

  it("creates the account, records the agreements, audits, and signs the user in", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    m.activateAccount.mockResolvedValueOnce({ ok: true, user: { id: 90, openId: "local:x", email: "new.person@example.com", name: "New Person", role: "client", organizationId: 3 }, invitation: {} });
    const { ctx, cookie } = publicCtx();
    const r = await appRouter.createCaller(ctx).accounts.activate(input() as never);
    expect(r).toMatchObject({ ok: true, role: "client", mfaRequired: false });
    expect(m.activateAccount).toHaveBeenCalledWith(expect.objectContaining({ token: TOKEN, name: "New Person", passwordHash: expect.stringMatching(/^\$2[aby]\$/) }));
    expect(m.recordAgreementAcceptance).toHaveBeenCalledTimes(2);
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ userId: 90, provider: "activation", reason: "activated:client" }));
    expect(cookie).toHaveBeenCalledTimes(1);
    const [name, value, opts] = cookie.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(value).toBe("session-token");
    expect(opts.maxAge).toBeGreaterThan(0);
    expect(opts.httpOnly).toBe(true);
    expect(m.emitNotification).toHaveBeenCalledWith(expect.objectContaining({ event: "CLIENT_ACCOUNT_CREATED" }));
  });

  it("never stores the password itself", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    m.activateAccount.mockResolvedValueOnce({ ok: true, user: { id: 90, openId: "local:x", email: "e", name: "n", role: "client", organizationId: 3 }, invitation: {} });
    await appRouter.createCaller(publicCtx().ctx).accounts.activate(input() as never);
    expect(JSON.stringify(m.activateAccount.mock.calls)).not.toContain("correct7horse9battery");
  });

  it("refuses a weak password before touching the database", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    await expect(appRouter.createCaller(publicCtx().ctx).accounts.activate(input({ password: "short1" }) as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.activateAccount).not.toHaveBeenCalled();
  });

  it("refuses a password built from the invited email", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    await expect(appRouter.createCaller(publicCtx().ctx).accounts.activate(input({ password: "new.person2026!x" }) as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the agreements to be accepted", async () => {
    await expect(appRouter.createCaller(publicCtx().ctx).accounts.activate(input({ acceptedAgreements: false }) as never)).rejects.toThrow();
    expect(m.activateAccount).not.toHaveBeenCalled();
  });

  it("rejects a link that went stale between the check and the create, with the generic message", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    m.activateAccount.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    await expect(appRouter.createCaller(publicCtx().ctx).accounts.activate(input() as never)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("tells a person who already has an account to sign in", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending());
    m.activateAccount.mockResolvedValueOnce({ ok: false, reason: "user_exists" });
    await expect(appRouter.createCaller(publicCtx().ctx).accounts.activate(input() as never)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("sends a privileged role on to MFA enrolment", async () => {
    m.getInvitationByToken.mockResolvedValueOnce(pending({ role: "technical_operator" }));
    m.activateAccount.mockResolvedValueOnce({ ok: true, user: { id: 91, openId: "local:y", email: "e", name: "n", role: "technical_operator", organizationId: null }, invitation: {} });
    const r = await appRouter.createCaller(publicCtx().ctx).accounts.activate(input() as never);
    expect(r.mfaRequired).toBe(true);
  });
});

describe("adminOps.inviteUser", () => {
  it("lets an admin invite a client and emails the link without returning it", async () => {
    m.createInvitation.mockResolvedValueOnce({ invitation: { id: 5, email: "c@example.com", expiresAt: new Date() }, token: "SECRET-TOKEN-VALUE" });
    const r = await appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "c@example.com", role: "client", organizationId: 3 });
    expect(JSON.stringify(r)).not.toContain("SECRET-TOKEN-VALUE");
    expect(m.dispatchSimpleEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "c@example.com", text: expect.stringContaining("/activate?token=SECRET-TOKEN-VALUE") }));
    expect(m.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.invitation.create(5:client") }));
    expect(JSON.stringify(m.appendLoginAudit.mock.calls)).not.toContain("SECRET-TOKEN-VALUE");
  });

  it("stops an admin inviting a privileged role", async () => {
    await expect(appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "a@example.com", role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "a@example.com", role: "super_admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.createInvitation).not.toHaveBeenCalled();
  });

  it("lets a super admin invite an admin", async () => {
    m.createInvitation.mockResolvedValueOnce({ invitation: { id: 6, email: "a@example.com", expiresAt: new Date() }, token: "tok" });
    await expect(appRouter.createCaller(staffCtx("super_admin")).adminOps.inviteUser({ email: "a@example.com", role: "admin" })).resolves.toMatchObject({ id: 6 });
  });

  it("needs an organization for a client", async () => {
    await expect(appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "c@example.com", role: "client" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an address that already has an account", async () => {
    m.createInvitation.mockResolvedValueOnce("user_exists");
    await expect(appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "c@example.com", role: "developer" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reports when the email could not be sent", async () => {
    m.createInvitation.mockResolvedValueOnce({ invitation: { id: 7, email: "c@example.com", expiresAt: new Date() }, token: "tok" });
    m.dispatchSimpleEmail.mockResolvedValueOnce({ ok: false });
    await expect(appRouter.createCaller(staffCtx("admin")).adminOps.inviteUser({ email: "c@example.com", role: "developer" })).resolves.toMatchObject({ emailSent: false });
  });

  it("keeps a client out of invitations", async () => {
    await expect(appRouter.createCaller(staffCtx("client")).adminOps.inviteUser({ email: "x@example.com", role: "client", organizationId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
