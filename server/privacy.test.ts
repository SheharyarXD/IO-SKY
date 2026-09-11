/**
 * Data Subject Rights administration.
 *
 * The three properties under test are the ones the client was explicit about,
 * and each is the kind of thing that is easy to get right once and then lose
 * to a later refactor:
 *
 *   1. Authority comes from an explicit grant, never from a role. A Super
 *      Admin with no grant must be refused.
 *   2. A staged action cannot be approved by the person who staged it.
 *   3. Erasure is refused outright rather than reported as done.
 *
 * The database layer is faked in memory so these assert on the router's
 * decisions rather than on Postgres. The authorisation middleware itself is
 * NOT faked: it runs for real against the fake grant store, because the
 * middleware is the thing most worth covering.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
});

interface FakeGrant {
  id: number;
  userId: number;
  grantedByUserId: number | null;
  reason: string;
  grantedAt: Date;
  revokedAt: Date | null;
  revokedByUserId: number | null;
  revokedReason: string | null;
}

let grants: FakeGrant[] = [];
let requests: any[] = [];
let events: any[] = [];
let verifiedFactors: number[] = [];
let nextId = 1;

vi.mock("./db", () => ({
  getActivePrivacyOfficerGrant: vi.fn(async (userId: number) =>
    grants.find((g) => g.userId === userId && g.revokedAt === null) ?? null,
  ),
  listPrivacyOfficerGrants: vi.fn(async () => grants),
  grantPrivacyOfficer: vi.fn(async (input: any) => {
    const g: FakeGrant = {
      id: nextId++,
      userId: input.userId,
      grantedByUserId: input.grantedByUserId,
      reason: input.reason,
      grantedAt: new Date(),
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
    };
    grants.push(g);
    return g;
  }),
  revokePrivacyOfficer: vi.fn(async (input: any) => {
    const g = grants.find((g) => g.userId === input.userId && g.revokedAt === null);
    if (g) {
      g.revokedAt = new Date();
      g.revokedByUserId = input.revokedByUserId;
      g.revokedReason = input.reason;
    }
  }),

  createPrivacyRequest: vi.fn(async (input: any) => {
    const r = { id: nextId++, ...input };
    requests.push(r);
    return r;
  }),
  getPrivacyRequestById: vi.fn(async (id: number) => requests.find((r) => r.id === id) ?? null),
  listPrivacyRequests: vi.fn(async (opts: any = {}) =>
    opts.status ? requests.filter((r) => r.status === opts.status) : requests,
  ),
  updatePrivacyRequest: vi.fn(async (id: number, patch: any) => {
    const r = requests.find((r) => r.id === id);
    if (!r) return null;
    Object.assign(r, patch);
    return r;
  }),
  appendPrivacyRequestEvent: vi.fn(async (input: any) => {
    events.push({ id: nextId++, ...input });
  }),
  listPrivacyRequestEvents: vi.fn(async (requestId: number) =>
    events.filter((e) => e.requestId === requestId),
  ),
  locatePersonalData: vi.fn(async () => [
    {
      table: "users",
      matchedBy: "email" as const,
      rows: [{ id: 9, email: "subject@example.com", name: 'Su "Bject"' }],
    },
    { table: "bookings", matchedBy: "email" as const, rows: [{ id: 1, note: "a,b" }] },
  ]),
  PERSONAL_DATA_SOURCES: [{ table: "users" }, { table: "bookings" }],

  getUserByEmail: vi.fn(async () => null),

  // The privileged MFA gate runs for real and reads this.
  listVerifiedMfaFactorsForUser: vi.fn(async (userId: number) =>
    verifiedFactors.includes(userId) ? [{ id: 1 }] : [],
  ),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function ctxFor(user: { id: number; role: string } | null): TrpcContext {
  return {
    user: user
      ? ({
          id: user.id,
          openId: `u-${user.id}`,
          email: `u${user.id}@example.com`,
          name: `User ${user.id}`,
          role: user.role,
        } as never)
      : null,
    req: {
      headers: { "user-agent": "vitest" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext;
}

const caller = (user: { id: number; role: string } | null) =>
  appRouter.createCaller(ctxFor(user));

const OFFICER_A = { id: 10, role: "admin" };
const OFFICER_B = { id: 11, role: "developer" };
const SUPER_ADMIN_NO_GRANT = { id: 12, role: "super_admin" };

beforeEach(() => {
  grants = [];
  requests = [];
  events = [];
  // Everyone in these tests has cleared MFA unless a test says otherwise;
  // the MFA gate has its own coverage elsewhere.
  verifiedFactors = [10, 11, 12];
  nextId = 1;
});

/** Give both officers a live grant and return a verified access request. */
async function seedVerifiedRequest() {
  grants.push(
    {
      id: 900,
      userId: OFFICER_A.id,
      grantedByUserId: 1,
      reason: "seed",
      grantedAt: new Date(),
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
    },
    {
      id: 901,
      userId: OFFICER_B.id,
      grantedByUserId: 1,
      reason: "seed",
      grantedAt: new Date(),
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
    },
  );

  const created = await caller(OFFICER_A).privacy.create({
    requestType: "access",
    subjectEmail: "Subject@Example.com",
    subjectName: "Su Bject",
  });
  await caller(OFFICER_A).privacy.setIdentityVerification({
    id: created.id,
    status: "verified",
    note: "Passport checked against the account address.",
  });
  return created;
}

describe("privacy officer authorisation", () => {
  it("refuses a Super Admin who holds no grant", async () => {
    // The client's requirement, and the whole point of the design: authority
    // does not follow from a role, however senior.
    await expect(caller(SUPER_ADMIN_NO_GRANT).privacy.list()).rejects.toThrow(
      /privacy_officer_required/,
    );
  });

  it("refuses an anonymous caller", async () => {
    await expect(caller(null).privacy.list()).rejects.toThrow();
  });

  it("admits a granted user whose role is not privileged", async () => {
    await seedVerifiedRequest();
    // OFFICER_B is a "developer". The grant is what admits them.
    await expect(caller(OFFICER_B).privacy.list()).resolves.toBeInstanceOf(Array);
  });

  it("refuses a granted user who has not cleared MFA", async () => {
    await seedVerifiedRequest();
    verifiedFactors = [];
    await expect(caller(OFFICER_A).privacy.list()).rejects.toThrow(/privileged_gate/);
  });

  it("refuses once a grant is revoked", async () => {
    await seedVerifiedRequest();
    grants.forEach((g) => {
      if (g.userId === OFFICER_A.id) g.revokedAt = new Date();
    });
    await expect(caller(OFFICER_A).privacy.list()).rejects.toThrow(
      /privacy_officer_required/,
    );
  });
});

describe("identity verification gate", () => {
  it("refuses to locate data for an unverified subject", async () => {
    grants.push({
      id: 900,
      userId: OFFICER_A.id,
      grantedByUserId: 1,
      reason: "seed",
      grantedAt: new Date(),
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
    });
    const created = await caller(OFFICER_A).privacy.create({
      requestType: "access",
      subjectEmail: "subject@example.com",
    });

    // Handing one person's data to another is precisely the breach this
    // gate exists to stop, so it is enforced rather than advised.
    await expect(caller(OFFICER_A).privacy.locate({ id: created.id })).rejects.toThrow(
      /identity must be verified/i,
    );
    await expect(
      caller(OFFICER_A).privacy.export({ id: created.id, format: "json" }),
    ).rejects.toThrow(/identity must be verified/i);
  });

  it("locates data once the subject is verified and records what was searched", async () => {
    const created = await seedVerifiedRequest();
    const out = await caller(OFFICER_A).privacy.locate({ id: created.id });

    expect(out.summary.map((s) => s.table)).toEqual(["users", "bookings"]);

    // A nil return is only meaningful if we recorded what we looked in.
    const stored = JSON.parse(requests[0].affectedSystemsJson);
    expect(stored.tablesSearched).toEqual(["users", "bookings"]);
    expect(events.some((e) => e.event === "data_located")).toBe(true);
  });
});

describe("export", () => {
  it("produces JSON carrying the reference and the located data", async () => {
    const created = await seedVerifiedRequest();
    const out = await caller(OFFICER_A).privacy.export({ id: created.id, format: "json" });
    expect(out.contentType).toBe("application/json");
    const parsed = JSON.parse(out.content);
    expect(parsed.request.reference).toBe(requests[0].publicRef);
    expect(parsed.data).toHaveLength(2);
  });

  it("escapes quotes and commas in CSV rather than shifting columns", async () => {
    const created = await seedVerifiedRequest();
    const out = await caller(OFFICER_A).privacy.export({ id: created.id, format: "csv" });

    // The fake data deliberately contains a value with embedded quotes and
    // one with a comma. Both are the classic ways a naive CSV writer
    // corrupts every column to the right of them.
    expect(out.content).toContain('"Su ""Bject"""');
    expect(out.content).toContain('"a,b"');
    expect(out.filename).toMatch(/\.csv$/);
  });

  it("records every export in the audit history", async () => {
    const created = await seedVerifiedRequest();
    await caller(OFFICER_A).privacy.export({ id: created.id, format: "json" });
    const exported = events.filter((e) => e.event === "data_exported");
    expect(exported).toHaveLength(1);
    expect(exported[0].actorUserId).toBe(OFFICER_A.id);
  });
});

describe("staged approval", () => {
  it("refuses to stage an erasure rather than reporting one as done", async () => {
    grants.push({
      id: 900,
      userId: OFFICER_A.id,
      grantedByUserId: 1,
      reason: "seed",
      grantedAt: new Date(),
      revokedAt: null,
      revokedByUserId: null,
      revokedReason: null,
    });
    const created = await caller(OFFICER_A).privacy.create({
      requestType: "erasure",
      subjectEmail: "subject@example.com",
    });

    await expect(
      caller(OFFICER_A).privacy.prepareAction({
        id: created.id,
        proposal: "Delete everything held about this person.",
      }),
    ).rejects.toThrow(/not yet implemented/i);

    // And the request must not have been moved on as though it had been.
    expect(requests[0].status).toBe("received");
  });

  it("refuses self-approval of a staged action", async () => {
    const created = await seedVerifiedRequest();
    await caller(OFFICER_A).privacy.prepareAction({
      id: created.id,
      proposal: "Send the subject a full export of the located data.",
    });

    // An approval step the proposer can satisfy alone is not a review.
    await expect(
      caller(OFFICER_A).privacy.approveAction({
        id: created.id,
        decision: "approve",
        note: "Looks fine to me.",
      }),
    ).rejects.toThrow(/different authorised person/i);
  });

  it("completes when a different authorised person approves", async () => {
    const created = await seedVerifiedRequest();
    await caller(OFFICER_A).privacy.prepareAction({
      id: created.id,
      proposal: "Send the subject a full export of the located data.",
    });

    const done = await caller(OFFICER_B).privacy.approveAction({
      id: created.id,
      decision: "approve",
      note: "Verified and approved for release.",
    });

    expect(done?.status).toBe("completed");
    const actions = JSON.parse(requests[0].actionsTakenJson);
    // Proposer and approver are recorded separately and must not collapse.
    expect(actions.proposedByUserId).toBe(OFFICER_A.id);
    expect(actions.decidedByUserId).toBe(OFFICER_B.id);
    expect(actions.approved).toBe(true);
  });

  it("records a rejection as a rejection, not a completion", async () => {
    const created = await seedVerifiedRequest();
    await caller(OFFICER_A).privacy.prepareAction({
      id: created.id,
      proposal: "Send the subject a full export of the located data.",
    });
    const done = await caller(OFFICER_B).privacy.approveAction({
      id: created.id,
      decision: "reject",
      note: "Identity evidence is insufficient on review.",
    });

    expect(done?.status).toBe("rejected");
    expect(events.some((e) => e.event === "action_rejected")).toBe(true);
  });

  it("refuses approval when nothing is staged", async () => {
    const created = await seedVerifiedRequest();
    await expect(
      caller(OFFICER_B).privacy.approveAction({
        id: created.id,
        decision: "approve",
        note: "Approving anyway.",
      }),
    ).rejects.toThrow(/no staged action/i);
  });
});

describe("request record", () => {
  it("sets a one month statutory deadline from receipt", async () => {
    const created = await seedVerifiedRequest();
    const days = (created.dueAt.getTime() - created.receivedAt.getTime()) / 86_400_000;
    expect(days).toBe(30);
  });

  it("normalises the subject email so casing cannot split one person in two", async () => {
    const created = await seedVerifiedRequest();
    expect(created.subjectEmail).toBe("subject@example.com");
  });

  it("keeps an append-only history of every action on the request", async () => {
    const created = await seedVerifiedRequest();
    await caller(OFFICER_A).privacy.locate({ id: created.id });
    await caller(OFFICER_A).privacy.prepareAction({
      id: created.id,
      proposal: "Send the subject a full export of the located data.",
    });
    await caller(OFFICER_B).privacy.approveAction({
      id: created.id,
      decision: "approve",
      note: "Verified and approved for release.",
    });

    expect(events.map((e) => e.event)).toEqual([
      "request_received",
      "identity_verification_updated",
      "data_located",
      "action_proposed",
      "action_approved",
    ]);
  });
});
