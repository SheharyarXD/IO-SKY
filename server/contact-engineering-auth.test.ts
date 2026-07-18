/**
 * IO SKY — Contact / Engineering Access / Auth audit router tests.
 *
 * Strategy:
 *   - Mock the DB layer (`./db`) so the suite has no network dependency.
 *   - Mock the email transport (`./email`) and owner notification (`./_core/notification`).
 *   - Drive each procedure through `appRouter.createCaller`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing the router.
// ---------------------------------------------------------------------------

vi.mock("./db", () => {
  const state = {
    contacts: [] as Array<{
      id: number;
      publicRef: string;
      fullName: string;
      email: string;
      subject: string;
      status: string;
      ownerNotified: number;
      emailSent: number;
    }>,
    devApps: [] as Array<{
      id: number;
      publicRef: string;
      fullName: string;
      email: string;
      ackNda: number;
      ackConfidentiality: number;
      ackNonSolicitation: number;
      status: string;
      ownerNotified: number;
    }>,
    leads: [] as Array<Record<string, unknown>>,
    loginAudit: [] as Array<{
      identifier: string | null;
      provider: string;
      outcome: string;
      reason: string | null;
    }>,
    nextContactId: 1,
    nextDevId: 1,
  };

  return {
    __state: state,

    // contact
    createContactSubmission: vi.fn(async (input: Record<string, unknown>) => {
      const row = {
        id: state.nextContactId++,
        ownerNotified: 0,
        emailSent: 0,
        ...input,
      } as (typeof state.contacts)[number];
      state.contacts.push(row);
      return row;
    }),
    listRecentContactSubmissions: vi.fn(async () => [...state.contacts].reverse()),
    markContactEmailSent: vi.fn(async (id: number) => {
      const row = state.contacts.find((r) => r.id === id);
      if (row) row.emailSent = 1;
    }),
    markContactOwnerNotified: vi.fn(async (id: number) => {
      const row = state.contacts.find((r) => r.id === id);
      if (row) row.ownerNotified = 1;
    }),

    // dev applications
    createDevApplication: vi.fn(async (input: Record<string, unknown>) => {
      const row = {
        id: state.nextDevId++,
        ownerNotified: 0,
        ...input,
      } as (typeof state.devApps)[number];
      state.devApps.push(row);
      return row;
    }),
    listRecentDevApplications: vi.fn(async () => [...state.devApps].reverse()),
    markDevAppOwnerNotified: vi.fn(async (id: number) => {
      const row = state.devApps.find((r) => r.id === id);
      if (row) row.ownerNotified = 1;
    }),
    updateDevAppStatus: vi.fn(async (_id: number, _status: string) => {
      /* no-op for the suite */
    }),

    // shared
    createLead: vi.fn(async (input: Record<string, unknown>) => {
      state.leads.push(input);
      return { id: state.leads.length, ...input };
    }),
    listRecentLeads: vi.fn(async () => [...state.leads].reverse()),

    // login audit
    appendLoginAudit: vi.fn(async (input: Record<string, unknown>) => {
      state.loginAudit.push(input as (typeof state.loginAudit)[number]);
    }),
    listRecentLoginAudit: vi.fn(async () => [...state.loginAudit].reverse()),

    // unused but referenced indirectly
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    getDb: vi.fn(async () => null),

    // bookings helpers (kept so appRouter import doesn't break)
    createBooking: vi.fn(),
    appendBookingAudit: vi.fn(),
    markBookingEmailSent: vi.fn(),
    markBookingOwnerNotified: vi.fn(),
    listRecentBookings: vi.fn(async () => []),
    getBookingByPublicRef: vi.fn(async () => null),
  };
});

vi.mock("./email", () => ({
  sendBookingConfirmation: vi.fn(async () => ({
    ok: true,
    transport: "console" as const,
    messageId: "test-msg-1",
  })),
  sendContactConfirmation: vi.fn(async () => ({
    ok: true,
    transport: "console" as const,
    messageId: "contact-msg-1",
  })),
  sendDevApplicationAck: vi.fn(async () => ({
    ok: true,
    transport: "console" as const,
    messageId: "dev-msg-1",
  })),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks are in place.
// ---------------------------------------------------------------------------

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createCtx(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    user: null,
    req: {
      headers: { "user-agent": "vitest" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    ...overrides,
  };
}

const validContact = () => ({
  fullName: "Test User",
  email: "test@example.com",
  company: "Example BV",
  subject: "Schedule a discovery call",
  message: "We'd like to discuss operational intelligence for our team.",
});

const validDevApp = () => ({
  fullName: "Sam Engineer",
  email: "sam@dev.example.com",
  company: "Dev Studio",
  roleTitle: "Senior Backend Engineer",
  yearsExperience: 8,
  links: "https://github.com/sam",
  message: "Interested in the IO SKY engineering programme.",
  ackNda: true,
  ackConfidentiality: true,
  ackNonSolicitation: true,
});

beforeEach(async () => {
  const dbMod: unknown = await import("./db");
  const state = (
    dbMod as { __state: Record<string, unknown[] | number> }
  ).__state;
  (state.contacts as unknown[]).length = 0;
  (state.devApps as unknown[]).length = 0;
  (state.leads as unknown[]).length = 0;
  (state.loginAudit as unknown[]).length = 0;
  (state as unknown as { nextContactId: number }).nextContactId = 1;
  (state as unknown as { nextDevId: number }).nextDevId = 1;
});

describe("contact.submit", () => {
  it("creates a submission, CRM lead, and returns a publicRef", async () => {
    const caller = appRouter.createCaller(createCtx());
    const res = await caller.contact.submit(validContact());

    expect(res.success).toBe(true);
    expect(res.publicRef).toMatch(/^IOSKY-MSG-[A-Z0-9X]{4}-[A-Z0-9X]{4}$/);
    expect(res.emailTransport).toBe("console");

    const dbMod: unknown = await import("./db");
    const state = (dbMod as { __state: { contacts: unknown[]; leads: unknown[] } }).__state;
    expect(state.contacts).toHaveLength(1);
    expect(state.leads).toHaveLength(1);
  });

  it("rejects malformed emails", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.contact.submit({ ...validContact(), email: "not-an-email" }),
    ).rejects.toThrow();
  });

  it("rejects honeypot submissions at the validator boundary", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.contact.submit({
        ...validContact(),
        website: "spam-link",
      } as never),
    ).rejects.toThrow();

    const dbMod: unknown = await import("./db");
    const state = (dbMod as { __state: { contacts: unknown[] } }).__state;
    expect(state.contacts).toHaveLength(0);
  });

  it("guards listRecent behind admin auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.contact.listRecent()).rejects.toThrow();
  });
});

describe("engineering.submit", () => {
  it("creates an application + CRM lead when all acknowledgements are present", async () => {
    const caller = appRouter.createCaller(createCtx());
    const res = await caller.engineering.submit(validDevApp());

    expect(res.success).toBe(true);
    expect(res.publicRef).toMatch(/^IOSKY-DEV-[A-Z0-9X]{4}-[A-Z0-9X]{4}$/);

    const dbMod: unknown = await import("./db");
    const state = (
      dbMod as {
        __state: { devApps: unknown[]; leads: { source?: string }[] };
      }
    ).__state;
    expect(state.devApps).toHaveLength(1);
    expect(state.leads).toHaveLength(1);
    expect(state.leads[0].source).toBe("eng-access");
  });

  it("rejects applications missing any acknowledgement", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.engineering.submit({ ...validDevApp(), ackNda: false }),
    ).rejects.toThrow();
    await expect(
      caller.engineering.submit({ ...validDevApp(), ackConfidentiality: false }),
    ).rejects.toThrow();
    await expect(
      caller.engineering.submit({ ...validDevApp(), ackNonSolicitation: false }),
    ).rejects.toThrow();
  });

  it("guards listRecent and setStatus behind admin auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.engineering.listRecent()).rejects.toThrow();
    await expect(
      caller.engineering.setStatus({ id: 1, status: "approved" }),
    ).rejects.toThrow();
  });
});

describe("auth.recordAttempt", () => {
  it("appends a login audit row with the requested provider/outcome", async () => {
    const caller = appRouter.createCaller(createCtx());
    const res = await caller.auth.recordAttempt({
      provider: "credentials",
      outcome: "failed",
      reason: "invalid-fields",
      identifier: "user@example.com",
    });
    expect(res.logged).toBe(true);

    const dbMod: unknown = await import("./db");
    const state = (
      dbMod as {
        __state: {
          loginAudit: { provider: string; outcome: string; identifier: string | null }[];
        };
      }
    ).__state;
    expect(state.loginAudit).toHaveLength(1);
    expect(state.loginAudit[0].provider).toBe("credentials");
    expect(state.loginAudit[0].outcome).toBe("failed");
    expect(state.loginAudit[0].identifier).toBe("user@example.com");
  });

  it("rejects unknown providers and outcomes", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.auth.recordAttempt({
        // @ts-expect-error intentional invalid provider
        provider: "totally-bogus",
        outcome: "success",
      }),
    ).rejects.toThrow();
    await expect(
      caller.auth.recordAttempt({
        provider: "google",
        // @ts-expect-error intentional invalid outcome
        outcome: "what",
      }),
    ).rejects.toThrow();
  });

  it("guards audit.listLeads + audit.listLogins behind admin auth", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.audit.listLeads()).rejects.toThrow();
    await expect(caller.audit.listLogins()).rejects.toThrow();
  });
});
