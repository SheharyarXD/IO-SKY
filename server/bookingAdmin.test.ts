/**
 * IO SKY — bookingAdmin router + adapter tests.
 *
 * Covers:
 *  - HMAC-signed action tokens roundtrip + tamper detection
 *  - bookingAdmin.upsertAvailabilityRule input validation
 *  - bookingAdmin.addAvailabilityWindow rejects inverted ranges
 *  - bookings.hold honours hold-token race semantics
 *  - bookings.cancelByToken rejects invalid token signatures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock DB layer so we don't need a live MySQL connection.
// ---------------------------------------------------------------------------
vi.mock("./db", () => {
  const state = {
    bookings: [] as Array<Record<string, unknown> & { id: number }>,
    nextBookingId: 1,
    audit: [] as Array<Record<string, unknown>>,
    holds: [] as Array<{ id: number; consultationType: string; slotStartMs: number; holdToken: string }>,
    rules: [] as Array<{ id: number; consultationType: string; weekday: number; startMinute: number; endMinute: number; timezone: string; active: number }>,
    windows: [] as Array<{ id: number; startMs: number; endMs: number; kind: "open" | "close"; consultationType: string | null; reason: string | null }>,
    blocks: [] as Array<{ id: number; startMs: number; endMs: number; label: string }>,
  };
  let nextId = 1;
  return {
    __state: state,
    createBooking: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: state.nextBookingId++, ...input, createdAt: new Date(), emailSent: 0, ownerNotified: 0 };
      state.bookings.push(row as never);
      return row;
    }),
    appendBookingAudit: vi.fn(async (row: Record<string, unknown>) => { state.audit.push(row); }),
    markBookingEmailSent: vi.fn(),
    markBookingOwnerNotified: vi.fn(),
    listRecentBookings: vi.fn(async () => [...state.bookings].reverse()),
    getBookingByPublicRef: vi.fn(async (ref: string) =>
      state.bookings.find((b) => b.publicRef === ref) ?? null,
    ),
    tryHoldBookingSlot: vi.fn(async (input: { consultationType: string; slotStartMs: number; holdToken: string }) => {
      const clash = state.holds.find((h) => h.consultationType === input.consultationType && h.slotStartMs === input.slotStartMs);
      if (clash) return { ok: false as const, reason: "taken" as const };
      const id = nextId++;
      state.holds.push({ id, consultationType: input.consultationType, slotStartMs: input.slotStartMs, holdToken: input.holdToken });
      return { ok: true as const, id };
    }),
    confirmBookingSlot: vi.fn(async () => true),
    cancelBookingSlot: vi.fn(),
    insertBookingAnswers: vi.fn(),
    scheduleBookingReminders: vi.fn(),
    rememberTimezonePreference: vi.fn(),
    appendBookingEvent: vi.fn(),
    listAdminAvailability: vi.fn(async () => state.rules),
    listAvailabilityWindows: vi.fn(async () => state.windows),
    listCalendarBlocks: vi.fn(async () => state.blocks),
    listTakenBookingSlots: vi.fn(async () => []),
    insertAdminAvailability: vi.fn(async (row: { consultationType: string; weekday: number; startMinute: number; endMinute: number; timezone: string; active: number }) => {
      state.rules.push({ id: nextId++, ...row });
    }),
    deleteAdminAvailability: vi.fn(async (id: number) => {
      state.rules = state.rules.filter((r) => r.id !== id);
    }),
    insertAvailabilityWindow: vi.fn(async (row: { startMs: number; endMs: number; kind: "open" | "close"; consultationType: string | null; reason: string | null }) => {
      state.windows.push({ id: nextId++, ...row });
    }),
    deleteAvailabilityWindow: vi.fn(async (id: number) => {
      state.windows = state.windows.filter((w) => w.id !== id);
    }),
    insertCalendarBlock: vi.fn(async (row: { startMs: number; endMs: number; label: string }) => {
      state.blocks.push({ id: nextId++, ...row });
    }),
    deleteCalendarBlock: vi.fn(async (id: number) => {
      state.blocks = state.blocks.filter((b) => b.id !== id);
    }),
    listBookingAnswers: vi.fn(async () => []),
    listBookingEvents: vi.fn(async () => []),
    listDueBookingReminders: vi.fn(async () => []),
    markBookingReminderSent: vi.fn(),
    listAllBookingSlotsForBookingId: vi.fn(async () => []),
    createLead: vi.fn(async () => ({ id: 1 })),
    appendLoginAudit: vi.fn(),
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    getDb: vi.fn(async () => null),
  };
});

vi.mock("./email", () => ({
  sendBookingConfirmation: vi.fn(async () => ({ ok: true, transport: "console" as const, messageId: "m1" })),
}));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn(async () => true) }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { makeBookingActionToken, verifyBookingActionToken } from "./_core/booking/tokens";

function ctx(role: "admin" | "user" | null = null): TrpcContext {
  if (role === null) {
    return {
      user: null,
      req: { headers: { "user-agent": "v" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
  }
  return {
    user: {
      id: 1,
      openId: "owner",
      email: "owner@example.com",
      name: "Owner",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never,
    req: { headers: { "user-agent": "v" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(async () => {
  const mod = (await import("./db")) as unknown as { __state: { bookings: unknown[]; audit: unknown[]; holds: unknown[]; rules: unknown[]; windows: unknown[]; blocks: unknown[]; nextBookingId: number } };
  mod.__state.bookings.length = 0;
  mod.__state.audit.length = 0;
  mod.__state.holds.length = 0;
  mod.__state.rules.length = 0;
  mod.__state.windows.length = 0;
  mod.__state.blocks.length = 0;
  mod.__state.nextBookingId = 1;
});

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

describe("booking action tokens", () => {
  it("round-trips and verifies correctly", () => {
    const token = makeBookingActionToken({ bookingId: 42, action: "cancel" });
    const result = verifyBookingActionToken(token, "cancel");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bookingId).toBe(42);
      expect(result.action).toBe("cancel");
    }
  });
  it("rejects a tampered signature", () => {
    const token = makeBookingActionToken({ bookingId: 42, action: "cancel" });
    const parts = token.split(".");
    parts[3] = parts[3].split("").reverse().join("");
    const tampered = parts.join(".");
    const result = verifyBookingActionToken(tampered, "cancel");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature");
  });
  it("rejects when the requested action does not match", () => {
    const token = makeBookingActionToken({ bookingId: 42, action: "cancel" });
    const result = verifyBookingActionToken(token, "reschedule");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("action");
  });
});

// ---------------------------------------------------------------------------
// Admin sub-router authz
// ---------------------------------------------------------------------------

describe("bookingAdmin router authz", () => {
  it("rejects anonymous callers on listAvailabilityRules", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.bookingAdmin.listAvailabilityRules()).rejects.toThrow();
  });
  it("rejects authenticated non-admin callers", async () => {
    const caller = appRouter.createCaller(ctx("user"));
    await expect(caller.bookingAdmin.listAvailabilityRules()).rejects.toThrow();
  });
  it("allows admin callers", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    await expect(caller.bookingAdmin.listAvailabilityRules()).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("bookingAdmin input validation", () => {
  it("rejects rules where end <= start", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    await expect(caller.bookingAdmin.upsertAvailabilityRule({
      consultationType: "discovery",
      weekday: 1,
      startMinute: 600,
      endMinute: 600,
      timezone: "Europe/Amsterdam",
    })).rejects.toThrow();
  });
  it("accepts a valid rule and lists it back", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    await caller.bookingAdmin.upsertAvailabilityRule({
      consultationType: "growth",
      weekday: 3,
      startMinute: 540,
      endMinute: 1080,
      timezone: "Europe/Amsterdam",
    });
    const rules = await caller.bookingAdmin.listAvailabilityRules();
    expect(rules.length).toBe(1);
    expect(rules[0]?.consultationType).toBe("growth");
  });
  it("rejects calendar block with end < start", async () => {
    const caller = appRouter.createCaller(ctx("admin"));
    const now = Date.now();
    await expect(caller.bookingAdmin.addCalendarBlock({
      startMs: now + 1000,
      endMs: now,
      label: "Bad block",
    })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Hold race
// ---------------------------------------------------------------------------

describe("bookings.hold", () => {
  it("rejects a second hold on the same slot with CONFLICT", async () => {
    const slotStartMs = Date.now() + 7 * 24 * 3600_000;
    const caller = appRouter.createCaller(ctx());
    const first = await caller.bookings.hold({ consultationType: "discovery", slotStartMs });
    expect(first.holdToken.length).toBeGreaterThan(8);
    await expect(caller.bookings.hold({ consultationType: "discovery", slotStartMs })).rejects.toThrow(/just taken/);
  });
});

// ---------------------------------------------------------------------------
// cancelByToken
// ---------------------------------------------------------------------------

describe("bookings.cancelByToken", () => {
  it("rejects bad signatures", async () => {
    const caller = appRouter.createCaller(ctx());
    await expect(caller.bookings.cancelByToken({ token: "1.cancel.999999999999.bad", reason: "x" })).rejects.toThrow();
  });
  it("accepts a properly signed token", async () => {
    const caller = appRouter.createCaller(ctx());
    const token = makeBookingActionToken({ bookingId: 1, action: "cancel" });
    const result = await caller.bookings.cancelByToken({ token, reason: "Schedule conflict" });
    expect(result.ok).toBe(true);
  });
});
