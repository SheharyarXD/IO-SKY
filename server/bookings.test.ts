/**
 * IO SKY — bookings router tests.
 *
 * Strategy:
 *   - Mock the DB layer (`./db`) so we don't need a live MySQL connection.
 *   - Mock the email transport (`./email`) so we don't try to send mail.
 *   - Mock the owner notification (`./_core/notification`).
 *   - Drive bookings.create / bookings.getByRef through appRouter.createCaller.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing the router.
// ---------------------------------------------------------------------------

vi.mock("./db", () => {
  const state = {
    bookings: [] as Array<{
      id: number;
      publicRef: string;
      serviceId: string;
      slotStartMs: number;
      durationMin: number;
      timezone: string;
      fullName: string;
      email: string;
      company: string | null;
      role: string | null;
      phone: string | null;
      preparation: string | null;
      note: string | null;
      utmSource: string | null;
      utmCampaign: string | null;
      status: string;
      ip: string | null;
      userAgent: string | null;
      emailSent: number;
      ownerNotified: number;
      createdAt: Date;
    }>,
    audit: [] as Array<{ bookingId: number; event: string; detail?: string }>,
    nextId: 1,
  };

  return {
    __state: state,
    createBooking: vi.fn(async (input: Record<string, unknown>) => {
      const row = {
        id: state.nextId++,
        emailSent: 0,
        ownerNotified: 0,
        createdAt: new Date(),
        ...input,
      } as (typeof state.bookings)[number];
      state.bookings.push(row);
      return row;
    }),
    appendBookingAudit: vi.fn(
      async (input: { bookingId: number; event: string; detail?: string }) => {
        state.audit.push(input);
      },
    ),
    markBookingEmailSent: vi.fn(async (id: number) => {
      const row = state.bookings.find((b) => b.id === id);
      if (row) row.emailSent = 1;
    }),
    markBookingOwnerNotified: vi.fn(async (id: number) => {
      const row = state.bookings.find((b) => b.id === id);
      if (row) row.ownerNotified = 1;
    }),
    listRecentBookings: vi.fn(async () => [...state.bookings].reverse()),
    getBookingByPublicRef: vi.fn(async (ref: string) =>
      state.bookings.find((b) => b.publicRef === ref) ?? null,
    ),
    // Native booking adapter helpers (in-memory stubs)
    tryHoldBookingSlot: vi.fn(async () => ({ ok: true as const, id: 1 })),
    confirmBookingSlot: vi.fn(async () => true),
    cancelBookingSlot: vi.fn(async () => undefined),
    insertBookingAnswers: vi.fn(async () => undefined),
    scheduleBookingReminders: vi.fn(async () => undefined),
    rememberTimezonePreference: vi.fn(async () => undefined),
    appendBookingEvent: vi.fn(async () => undefined),
    listAdminAvailability: vi.fn(async () => []),
    listAvailabilityWindows: vi.fn(async () => []),
    listCalendarBlocks: vi.fn(async () => []),
    listTakenBookingSlots: vi.fn(async () => []),
    insertAdminAvailability: vi.fn(async () => undefined),
    deleteAdminAvailability: vi.fn(async () => undefined),
    insertAvailabilityWindow: vi.fn(async () => undefined),
    deleteAvailabilityWindow: vi.fn(async () => undefined),
    insertCalendarBlock: vi.fn(async () => undefined),
    deleteCalendarBlock: vi.fn(async () => undefined),
    listBookingAnswers: vi.fn(async () => []),
    listBookingEvents: vi.fn(async () => []),
    listDueBookingReminders: vi.fn(async () => []),
    markBookingReminderSent: vi.fn(async () => undefined),
    listAllBookingSlotsForBookingId: vi.fn(async () => []),
    // CRM helper
    createLead: vi.fn(async () => ({ id: 1 })),
    // login audit
    appendLoginAudit: vi.fn(async () => undefined),
    // user helpers (unused here but kept for compatibility)
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    getDb: vi.fn(async () => null),
  };
});

vi.mock("./email", () => ({
  sendBookingConfirmation: vi.fn(async () => ({
    ok: true,
    transport: "console" as const,
    messageId: "test-msg-1",
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

const validInput = () => ({
  serviceId: "growth" as const,
  // 7 days from now
  slotStartMs: Date.now() + 7 * 24 * 3600 * 1000,
  timezone: "Europe/Amsterdam",
  fullName: "Test User",
  email: "test@example.com",
  company: "Example BV",
  role: "Director",
  preparation: { challenge: "Bottlenecks across CRM and ops." },
});

beforeEach(async () => {
  // Reset the in-memory state between tests.
  const dbMod: unknown = await import("./db");
  const state = (dbMod as { __state: { bookings: unknown[]; audit: unknown[]; nextId: number } }).__state;
  state.bookings.length = 0;
  state.audit.length = 0;
  state.nextId = 1;
});

describe("bookings.create", () => {
  it("creates a confirmed booking and returns a public reference", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.bookings.create(validInput());

    expect(result.success).toBe(true);
    expect(result.publicRef).toMatch(/^IOSKY-[A-Z0-9X]{4}-[A-Z0-9X]{4}$/);
    expect(result.emailTransport).toBe("console");
  });

  it("rejects honeypot submissions at input validation", async () => {
    const caller = appRouter.createCaller(createCtx());
    // The `website` honeypot is z.string().max(0) — any value rejects.
    await expect(
      caller.bookings.create({
        ...validInput(),
        website: "spam-link",
      } as never),
    ).rejects.toThrow();
  });

  it("rejects slot times in the deep past", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.bookings.create({
        ...validInput(),
        slotStartMs: Date.now() - 30 * 24 * 3600 * 1000,
      }),
    ).rejects.toThrow();
  });

  it("rejects malformed emails", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.bookings.create({
        ...validInput(),
        email: "not-an-email",
      }),
    ).rejects.toThrow();
  });
});

describe("bookings.getByRef", () => {
  it("returns null for an unknown reference", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.bookings.getByRef({
      publicRef: "IOSKY-AAAA-BBBB",
    });
    expect(result).toBeNull();
  });

  it("returns sanitized booking data when reference exists", async () => {
    const caller = appRouter.createCaller(createCtx());
    const created = await caller.bookings.create(validInput());

    const fetched = await caller.bookings.getByRef({
      publicRef: created.publicRef,
    });

    expect(fetched).not.toBeNull();
    expect(fetched?.publicRef).toBe(created.publicRef);
    expect(fetched?.serviceId).toBe("growth");
    expect(fetched?.status).toBe("confirmed");
    // Personal contact info must NOT be exposed by the public lookup.
    expect(fetched).not.toHaveProperty("email");
    expect(fetched).not.toHaveProperty("fullName");
  });
});

describe("bookings.listRecent", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.bookings.listRecent()).rejects.toThrow();
  });

  it("rejects authenticated non-admin callers", async () => {
    const caller = appRouter.createCaller(
      createCtx({
        user: {
          id: 1,
          openId: "u-1",
          email: "u@example.com",
          name: "U",
          loginMethod: "manus",
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as never,
      }),
    );
    await expect(caller.bookings.listRecent()).rejects.toThrow();
  });

  it("returns recent bookings for admin callers", async () => {
    const adminCtx = createCtx({
      user: {
        id: 2,
        openId: "owner",
        email: "owner@example.com",
        name: "Owner",
        loginMethod: "manus",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as never,
    });
    const publicCaller = appRouter.createCaller(createCtx());
    await publicCaller.bookings.create(validInput());
    await publicCaller.bookings.create({
      ...validInput(),
      email: "second@example.com",
    });

    const adminCaller = appRouter.createCaller(adminCtx);
    const recent = await adminCaller.bookings.listRecent();
    expect(recent.length).toBe(2);
  });
});
