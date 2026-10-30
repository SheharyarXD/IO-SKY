/*
 * J07 (SRS 15.10, 17.x; 29 Oct Ch10.1): staff-mediated messaging between developers
 * and clients. Pure rules plus the endpoints with the data layer mocked. The
 * transactions in server/db/mediatedMessaging.ts and migration 0047 have not run
 * against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkMessage, describeLeaks, findIdentityLeaks, MESSAGE_LIMITS, planRecipients, STAFF_SENDER_NAME, type HiddenIdentity } from "../shared/mediatedMessaging";

const dev: HiddenIdentity[] = [
  { kind: "name", value: "Sam Peeters" },
  { kind: "email", value: "sam.peeters@devmail.example" },
  { kind: "phone", value: "+31 6 1234 5678" },
];
const org: HiddenIdentity[] = [
  { kind: "company", value: "Acme Logistics BV" },
  { kind: "name", value: "Priya Nair" },
];
const kinds = (text: string, ids: HiddenIdentity[]) => findIdentityLeaks(text, ids).blocking.map((b) => b.kind);

describe("what must not be revealed", () => {
  it("a message that names nobody is clean", () => {
    expect(findIdentityLeaks("The developer needs the API credentials by Friday.", dev)).toEqual({ blocking: [], warnings: [] });
  });
  it("blocks the full name, in any case and spacing, and with accents removed", () => {
    for (const t of ["Please ask Sam Peeters about it", "sam   peeters is blocked", "SAM PEETERS", "thanks, Sam Peeters."]) expect(kinds(t, dev), t).toEqual(["name"]);
    expect(kinds("Hello Zoë Müller", [{ kind: "name", value: "Zoe Muller" }])).toEqual(["name"]);
  });
  it("only a first name is a warning, not a block", () => {
    const r = findIdentityLeaks("Sam says the build is green", dev);
    expect(r.blocking).toEqual([]);
    expect(r.warnings).toEqual([{ kind: "first_name" }]);
  });
  it("does not match a name inside another word", () => {
    expect(findIdentityLeaks("The Samsung tablet is ready", dev)).toEqual({ blocking: [], warnings: [] });
    expect(kinds("Sam Peeterson is someone else", dev)).toEqual([]);
  });
  it("blocks the email address", () => {
    expect(kinds("Write to sam.peeters@devmail.example please", dev)).toEqual(["email"]);
    expect(kinds("SAM.PEETERS@DEVMAIL.EXAMPLE", dev)).toEqual(["email"]);
  });
  it("blocks the phone number however it is written, but not unrelated numbers", () => {
    for (const t of ["call +31612345678", "call 06 1234 5678 now", "ring 31-6-1234-5678", "phone: (0031) 6 12345678"]) expect(kinds(t, dev), t).toEqual(["phone"]);
    expect(kinds("Invoice 20261030 for 4500 euro, order 12345", dev)).toEqual([]);
  });
  it("blocks the company name as a whole word", () => {
    expect(kinds("This is for Acme Logistics BV", org)).toEqual(["company"]);
    expect(kinds("acme logistics bv wants a quote", org)).toEqual(["company"]);
    expect(kinds("The logistics team at a large company", org)).toEqual([]);
  });
  it("reports each kind once, and several at once", () => {
    expect(kinds("Sam Peeters sam.peeters@devmail.example Sam Peeters +31612345678", dev).sort()).toEqual(["email", "name", "phone"]);
  });
  it("ignores identities that are empty or too short to mean anything", () => {
    expect(findIdentityLeaks("anything at all", [{ kind: "name", value: "" }, { kind: "company", value: "A" }, { kind: "phone", value: "123" }])).toEqual({ blocking: [], warnings: [] });
    expect(findIdentityLeaks("anything", [])).toEqual({ blocking: [], warnings: [] });
  });
  it("explains what to change without repeating the secret", () => {
    const text = describeLeaks(findIdentityLeaks("Sam Peeters sam.peeters@devmail.example", dev));
    expect(text).toContain("the other party's name");
    expect(text).toContain("the other party's email address");
    expect(text).not.toMatch(/Sam|Peeters|devmail/);
  });
  it("is not fooled by regular-expression characters in an identity", () => {
    expect(() => findIdentityLeaks("hello (world)", [{ kind: "company", value: "Acme (EU) [Ltd] .*" }])).not.toThrow();
    expect(kinds("We are Acme (EU) [Ltd] .*", [{ kind: "company", value: "Acme (EU) [Ltd] .*" }])).toEqual(["company"]);
    expect(kinds("We are Acme EU Ltd", [{ kind: "company", value: "Acme (EU) [Ltd] .*" }])).toEqual([]);
  });
});

describe("message checks and audiences", () => {
  it("trims, normalises line endings and subject spacing", () => {
    expect(checkMessage({ subject: "  Hello \n there ", body: "  Line one\r\nLine two  " })).toEqual({ ok: true, subject: "Hello there", body: "Line one\nLine two" });
    expect(checkMessage({ subject: "   ", body: "x" })).toEqual({ ok: true, subject: null, body: "x" });
  });
  it("refuses empty and oversized text", () => {
    expect(checkMessage({ body: "   " })).toEqual({ ok: false, reason: "empty_body" });
    expect(checkMessage({ body: "x".repeat(MESSAGE_LIMITS.body + 1) })).toEqual({ ok: false, reason: "body_too_long" });
    expect(checkMessage({ subject: "s".repeat(MESSAGE_LIMITS.subject + 1), body: "x" })).toEqual({ ok: false, reason: "subject_too_long" });
  });
  it("de-duplicates recipients, drops invalid ids, and caps the audience", () => {
    expect(planRecipients([3, 3, 4, 0, -1, 1.5, NaN])).toEqual({ ok: true, ids: [3, 4] });
    expect(planRecipients([])).toEqual({ ok: false, reason: "no_recipients" });
    expect(planRecipients([0, -2])).toEqual({ ok: false, reason: "no_recipients" });
    expect(planRecipients(Array.from({ length: MESSAGE_LIMITS.recipients + 1 }, (_, i) => i + 1))).toEqual({ ok: false, reason: "too_many" });
    expect(planRecipients(Array.from({ length: MESSAGE_LIMITS.recipients }, (_, i) => i + 1)).ok).toBe(true);
  });
  it("staff messages carry the company name, not a person", () => {
    expect(STAFF_SENDER_NAME).toBe("IO SKY");
  });
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  appendDeveloperNotification: vi.fn(async () => null),
  appendClientNotification: vi.fn(async () => null),
  getDeveloperMessage: vi.fn(),
  getClientMessage: vi.fn(),
  developerServesOrganization: vi.fn(),
  developerIdentities: vi.fn(),
  clientIdentities: vi.fn(),
  relayToClient: vi.fn(),
  relayToDeveloper: vi.fn(),
  broadcastToDevelopers: vi.fn(),
  listMediationLog: vi.fn(async () => []),
  notifyClient: vi.fn(async () => undefined),
}));
vi.mock("./db/mediatedMessaging", () => ({
  getDeveloperMessage: d.getDeveloperMessage,
  getClientMessage: d.getClientMessage,
  developerServesOrganization: d.developerServesOrganization,
  developerIdentities: d.developerIdentities,
  clientIdentities: d.clientIdentities,
  relayToClient: d.relayToClient,
  relayToDeveloper: d.relayToDeveloper,
  broadcastToDevelopers: d.broadcastToDevelopers,
  listMediationLog: d.listMediationLog,
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit, appendDeveloperNotification: d.appendDeveloperNotification, appendClientNotification: d.appendClientNotification };
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

describe("relay: developer to client", () => {
  const input = { developerMessageId: 5, organizationId: 3, body: "The team needs the staging credentials by Friday." };
  beforeEach(() => {
    vi.clearAllMocks();
    d.getDeveloperMessage.mockResolvedValue({ id: 5, developerId: 11, sender: "developer", body: "…" });
    d.developerServesOrganization.mockResolvedValue(true);
    d.developerIdentities.mockResolvedValue(dev);
    d.relayToClient.mockResolvedValue({ ok: true, messageId: 70 });
  });

  it("is staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) await expect(ops(role).relayDeveloperMessageToClient(input), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.relayToClient).not.toHaveBeenCalled();
  });
  it("sends a clean message as IO SKY, records the staff member, and audits", async () => {
    await expect(ops().relayDeveloperMessageToClient({ ...input, subject: "Credentials" })).resolves.toEqual({ ok: true, warnings: [] });
    expect(d.relayToClient).toHaveBeenCalledWith({ sourceMessageId: 5, developerId: 11, organizationId: 3, subject: "Credentials", body: input.body, actorUserId: 99 });
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.message.relay(developer_to_client:src=5:org=3)") }));
  });
  it("refuses a message that reveals the developer, and sends nothing", async () => {
    for (const body of ["Sam Peeters says hi", "Email sam.peeters@devmail.example", "Call +31 6 1234 5678"]) await expect(ops().relayDeveloperMessageToClient({ ...input, body }), body).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Reword it") });
    await expect(ops().relayDeveloperMessageToClient({ ...input, subject: "From Sam Peeters", body: "fine" })).rejects.toMatchObject({ code: "BAD_REQUEST" }); // the subject is checked too
    expect(d.relayToClient).not.toHaveBeenCalled();
  });
  it("passes a first-name-only mention but warns", async () => {
    await expect(ops().relayDeveloperMessageToClient({ ...input, body: "Sam needs access" })).resolves.toEqual({ ok: true, warnings: ["first_name"] });
  });
  it("refuses a developer who does not work for this client", async () => {
    d.developerServesOrganization.mockResolvedValueOnce(false);
    await expect(ops().relayDeveloperMessageToClient(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(d.relayToClient).not.toHaveBeenCalled();
  });
  it("only relays a message a developer actually wrote", async () => {
    d.getDeveloperMessage.mockResolvedValueOnce(null);
    await expect(ops().relayDeveloperMessageToClient(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.getDeveloperMessage.mockResolvedValueOnce({ id: 5, developerId: 11, sender: "admin" });
    await expect(ops().relayDeveloperMessageToClient(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("sends nothing and says so when the record cannot be written", async () => {
    d.relayToClient.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    await expect(ops().relayDeveloperMessageToClient(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("nothing was delivered") });
    expect(d.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.message.relay") }));
  });
  it("rejects empty and oversized text before looking anything up", async () => {
    await expect(ops().relayDeveloperMessageToClient({ ...input, body: "   " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(ops().relayDeveloperMessageToClient({ ...input, body: "x".repeat(MESSAGE_LIMITS.body + 1) })).rejects.toThrow();
    expect(d.relayToClient).not.toHaveBeenCalled();
  });
});

describe("relay: client to developer", () => {
  const input = { clientMessageId: 8, developerId: 11, body: "The client would like a status update on the portal work." };
  beforeEach(() => {
    vi.clearAllMocks();
    d.getClientMessage.mockResolvedValue({ id: 8, organizationId: 3, sender: "client", senderName: "Priya Nair" });
    d.developerServesOrganization.mockResolvedValue(true);
    d.clientIdentities.mockResolvedValue(org);
    d.relayToDeveloper.mockResolvedValue({ ok: true, messageId: 71 });
  });
  it("sends a clean message and audits, without naming the client", async () => {
    await expect(ops().relayClientMessageToDeveloper(input)).resolves.toEqual({ ok: true, warnings: [] });
    expect(d.relayToDeveloper).toHaveBeenCalledWith({ sourceMessageId: 8, developerId: 11, organizationId: 3, subject: null, body: input.body, actorUserId: 99 });
    expect(d.clientIdentities).toHaveBeenCalledWith(3, "Priya Nair");
  });
  it("refuses a message that names the client's company or contact", async () => {
    for (const body of ["Acme Logistics BV wants an update", "Priya Nair asked about it"]) await expect(ops().relayClientMessageToDeveloper({ ...input, body }), body).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(d.relayToDeveloper).not.toHaveBeenCalled();
  });
  it("refuses a developer who does not serve that client", async () => {
    d.developerServesOrganization.mockResolvedValueOnce(false);
    await expect(ops().relayClientMessageToDeveloper(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(d.developerServesOrganization).toHaveBeenCalledWith(11, 3);
  });
  it("only relays a message a client wrote", async () => {
    d.getClientMessage.mockResolvedValueOnce({ id: 8, organizationId: 3, sender: "io-sky" });
    await expect(ops().relayClientMessageToDeveloper(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("broadcast to developers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    d.broadcastToDevelopers.mockResolvedValue({ ok: true, recipients: [4, 5, 6] });
  });
  it("is staff only", async () => {
    await expect(ops("developer").messageDevelopers({ audience: { type: "team", id: 1 }, body: "hi" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(d.broadcastToDevelopers).not.toHaveBeenCalled();
  });
  it("sends to a team, notifies every recipient, and audits the count (not the text)", async () => {
    await expect(ops().messageDevelopers({ audience: { type: "team", id: 2 }, subject: "Freeze", body: "Code freeze at noon." })).resolves.toEqual({ ok: true, recipients: 3 });
    expect(d.broadcastToDevelopers).toHaveBeenCalledWith({ audienceType: "team", audienceRef: 2, subject: "Freeze", body: "Code freeze at noon.", actorUserId: 99 });
    expect(d.appendDeveloperNotification).toHaveBeenCalledTimes(3);
    const reason = (d.appendLoginAudit.mock.calls.at(-1)?.[0] as { reason: string }).reason;
    expect(reason).toContain("admin.message.broadcast(team=2:recipients=3)");
    expect(reason).not.toContain("freeze");
  });
  it("refuses an empty audience and a too-large one, and an unknown audience type", async () => {
    d.broadcastToDevelopers.mockResolvedValueOnce({ ok: false, reason: "no_recipients" });
    await expect(ops().messageDevelopers({ audience: { type: "project", id: 9 }, body: "hi" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    d.broadcastToDevelopers.mockResolvedValueOnce({ ok: false, reason: "too_many" });
    await expect(ops().messageDevelopers({ audience: { type: "project", id: 9 }, body: "hi" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    d.broadcastToDevelopers.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    await expect(ops().messageDevelopers({ audience: { type: "project", id: 9 }, body: "hi" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(ops().messageDevelopers({ audience: { type: "everyone" as never, id: 1 }, body: "hi" })).rejects.toThrow();
    expect(d.appendDeveloperNotification).not.toHaveBeenCalled();
  });
});

describe("mediation log", () => {
  it("is readable by staff only", async () => {
    await expect(ops("client").mediationLog()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ops().mediationLog()).resolves.toEqual([]);
  });
});
