/*
 * S07 (SRS 17.11, 29 Oct Doc 1 Ch7 and F-20): scheduling tracks REQUESTED versus
 * CONFIRMED, triggers emails and notifications only after the authoritative
 * state change, and is idempotent: a duplicate scheduling event produces no
 * duplicate appointment and no uncontrolled email.
 *
 * The data layer is a stateful in-memory model (bookings, slots, events,
 * reminders, leads) with the real semantics that matter: a unique slot per
 * time, a conditional confirm, and a hold that belongs to one token. Every
 * side effect is logged in order so the tests can assert "email AFTER confirm".
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
});

const m = vi.hoisted(() => {
  const state = {
    bookings: [] as any[],
    slots: [] as any[],
    events: [] as any[],
    audit: [] as any[],
    reminders: [] as any[],
    leads: [] as any[],
    order: [] as string[],
    nextBooking: 1,
    nextSlot: 1,
  };
  return {
    state,
    sendBookingConfirmation: vi.fn(async (_: any): Promise<any> => ({ ok: true, transport: "console", messageId: "m" })),
    emitNotification: vi.fn(async (_: any) => null),
    notifyOwner: vi.fn(async (_: any) => true),
    fail: { updateStatusToConfirmed: false, confirmSlot: false },
  };
});

vi.mock("./db", () => {
  const s = m.state;
  return {
    createBooking: vi.fn(async (input: any) => {
      const row = { id: s.nextBooking++, emailSent: 0, ownerNotified: 0, createdAt: new Date(), callType: "phone", meetingUrl: null, ...input };
      s.bookings.push(row);
      s.order.push(`createBooking:${row.status}`);
      return row;
    }),
    updateBookingStatus: vi.fn(async (id: number, status: string) => {
      if (status === "confirmed" && m.fail.updateStatusToConfirmed) throw new Error("db write failed");
      const b = s.bookings.find((x: any) => x.id === id);
      if (b) b.status = status;
      s.order.push(`status:${status}`);
    }),
    getBookingById: vi.fn(async (id: number) => s.bookings.find((x: any) => x.id === id) ?? null),
    getBookingByPublicRef: vi.fn(async (ref: string) => s.bookings.find((x: any) => x.publicRef === ref) ?? null),
    tryHoldBookingSlot: vi.fn(async (i: any) => {
      const existing = s.slots.find((x: any) => x.consultationType === i.consultationType && x.slotStartMs === i.slotStartMs);
      if (existing) return { ok: false as const, reason: "taken" as const };
      const row = { id: s.nextSlot++, consultationType: i.consultationType, slotStartMs: i.slotStartMs, status: "held", holdToken: i.holdToken, holdExpiresAtMs: Date.now() + i.holdTtlMs, bookingId: null };
      s.slots.push(row);
      return { ok: true as const, id: row.id };
    }),
    isHeldSlotValid: vi.fn(async (i: any) => {
      const x = s.slots.find((y: any) => y.id === i.slotId);
      return Boolean(x && x.status === "held" && x.holdToken === i.holdToken && x.consultationType === i.consultationType && x.slotStartMs === i.slotStartMs);
    }),
    confirmBookingSlot: vi.fn(async (i: any) => {
      if (m.fail.confirmSlot) return false;
      const x = s.slots.find((y: any) => y.id === i.slotId);
      if (!x || x.status !== "held" || x.holdToken !== i.holdToken) return false;
      Object.assign(x, { status: "booked", bookingId: i.bookingId, holdToken: null });
      s.order.push("slot:booked");
      return true;
    }),
    cancelBookingSlot: vi.fn(async (bookingId: number) => {
      for (const x of s.slots) if (x.bookingId === bookingId) x.status = "cancelled";
    }),
    cancelBookingSlotById: vi.fn(async (id: number) => {
      const x = s.slots.find((y: any) => y.id === id);
      if (x) x.status = "cancelled";
    }),
    insertBookingAnswers: vi.fn(async () => undefined),
    appendBookingAudit: vi.fn(async (e: any) => void s.audit.push(e)),
    appendBookingEvent: vi.fn(async (e: any) => {
      s.events.push(e);
      s.order.push(`event:${e.event}`);
    }),
    markBookingEmailSent: vi.fn(async (id: number) => {
      const b = s.bookings.find((x: any) => x.id === id);
      if (b) b.emailSent = 1;
    }),
    markBookingOwnerNotified: vi.fn(async () => undefined),
    rememberTimezonePreference: vi.fn(async () => undefined),
    scheduleBookingReminders: vi.fn(async (bookingId: number) => void s.reminders.push(bookingId)),
    createLead: vi.fn(async (l: any) => {
      s.leads.push(l);
      s.order.push("lead");
      return { id: s.leads.length };
    }),
    listRecentBookings: vi.fn(async () => []),
    listVerifiedMfaFactorsForUser: vi.fn(async () => []),
    appendLoginAudit: vi.fn(async () => undefined),
    getDb: vi.fn(async () => null),
  };
});

vi.mock("./email", () => ({
  sendBookingConfirmation: (a: any) => {
    m.state.order.push("email");
    return m.sendBookingConfirmation(a);
  },
}));
vi.mock("./notificationDispatcher", () => ({
  emitNotification: (a: any) => {
    m.state.order.push(`notify:${a.event}`);
    return m.emitNotification(a);
  },
}));
vi.mock("./_core/notification", () => ({ notifyOwner: m.notifyOwner }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { makeBookingActionToken } from "./_core/booking/tokens";

let ipCounter = 10;
const caller = () => {
  const ip = `192.0.2.${ipCounter++}`; // a fresh address per call keeps the in-memory rate limiters out of the way
  return appRouter.createCaller({
    user: null,
    impersonation: null,
    req: { headers: { "user-agent": "vitest", "x-forwarded-for": ip }, socket: { remoteAddress: ip } } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext);
};

const SLOT = () => Date.now() + 5 * 24 * 3600_000;
const form = (slotStartMs: number, extra: Record<string, unknown> = {}) => ({
  serviceId: "discovery" as const,
  slotStartMs,
  timezone: "Europe/Amsterdam",
  fullName: "Gina Guest",
  email: "gina@example.com",
  phone: "+31 6 12345678",
  locale: "en",
  ...extra,
});
async function hold(slotStartMs: number) {
  const h = await caller().bookings.hold({ consultationType: "discovery", slotStartMs });
  return { slotId: h.slotId, holdToken: h.holdToken };
}
const book = async (slotStartMs: number, h: { slotId: number; holdToken: string }, extra: Record<string, unknown> = {}) =>
  caller().bookings.create({ ...form(slotStartMs, extra), slotId: h.slotId, holdToken: h.holdToken });

beforeEach(() => {
  const s = m.state;
  for (const k of ["bookings", "slots", "events", "audit", "reminders", "leads", "order"] as const) s[k].length = 0;
  s.nextBooking = 1;
  s.nextSlot = 1;
  m.fail.updateStatusToConfirmed = false;
  m.fail.confirmSlot = false;
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("requested versus confirmed", () => {
  it("a booking starts as a pending request and is confirmed only after the slot is committed", async () => {
    const t = SLOT();
    await book(t, await hold(t));
    const order = m.state.order;
    expect(order.indexOf("createBooking:pending")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("event:requested")).toBeLessThan(order.indexOf("slot:booked"));
    expect(order.indexOf("slot:booked")).toBeLessThan(order.indexOf("status:confirmed"));
    expect(order.indexOf("event:confirmed")).toBeGreaterThan(order.indexOf("status:confirmed"));
    expect(m.state.bookings[0].status).toBe("confirmed");
  });

  it("the email, notifications, reminders and CRM lead all come AFTER the confirmation, never before", async () => {
    const t = SLOT();
    await book(t, await hold(t));
    const order = m.state.order;
    const confirmedAt = order.indexOf("status:confirmed");
    for (const after of ["email", "notify:DISCOVERY_CALL_SCHEDULED", "notify:DISCOVERY_CALL_REQUESTED", "lead"]) {
      expect(order.indexOf(after), after).toBeGreaterThan(confirmedAt);
    }
    expect(m.state.reminders).toEqual([1]);
    expect(order.filter((o) => o === "email")).toHaveLength(1);
  });

  it("if the slot is lost, the request is closed as cancelled and NOTHING is sent", async () => {
    const t = SLOT();
    const h = await hold(t);
    m.fail.confirmSlot = true;
    await expect(book(t, h)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.state.bookings).toHaveLength(1);
    expect(m.state.bookings[0].status).toBe("cancelled");
    expect(m.state.events.map((e) => e.event)).toEqual(["requested", "confirmation_failed"]);
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(m.emitNotification).not.toHaveBeenCalled();
    expect(m.notifyOwner).not.toHaveBeenCalled();
    expect(m.state.leads).toHaveLength(0);
    expect(m.state.reminders).toHaveLength(0);
  });

  it("if the confirmation cannot be written, the slot is released and nothing is sent", async () => {
    const t = SLOT();
    const h = await hold(t);
    m.fail.updateStatusToConfirmed = true;
    await expect(book(t, h)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(m.state.slots.find((x) => x.id === h.slotId).status).toBe("cancelled");
    expect(m.state.bookings[0].status).toBe("pending"); // never confirmed
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(m.emitNotification).not.toHaveBeenCalled();
  });
});

describe("duplicate scheduling events (F-20)", () => {
  it("a repeated submission of the same hold creates no second booking, email, notification or lead", async () => {
    const t = SLOT();
    const h = await hold(t);
    await book(t, h);
    await expect(book(t, h)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(book(t, h)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.state.bookings).toHaveLength(1);
    expect(m.state.order.filter((o) => o === "email")).toHaveLength(1);
    expect(m.state.order.filter((o) => o === "notify:DISCOVERY_CALL_SCHEDULED")).toHaveLength(1);
    expect(m.state.leads).toHaveLength(1);
    expect(m.state.slots.filter((x) => x.status === "booked")).toHaveLength(1);
  });

  it("two simultaneous submissions of the same hold: one appointment, one email", async () => {
    const t = SLOT();
    const h = await hold(t);
    const results = await Promise.allSettled([book(t, h), book(t, h)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(m.state.bookings.filter((b) => b.status === "confirmed")).toHaveLength(1);
    expect(m.state.order.filter((o) => o === "email")).toHaveLength(1);
    expect(m.state.slots.filter((x) => x.status === "booked")).toHaveLength(1);
  });

  it("a second guest cannot book a time that is already held or booked", async () => {
    const t = SLOT();
    await book(t, await hold(t));
    await expect(caller().bookings.hold({ consultationType: "discovery", slotStartMs: t })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.state.bookings).toHaveLength(1);
  });

  it("a hold on one time cannot be used to book another time or another service; nothing is persisted", async () => {
    const t = SLOT();
    const h = await hold(t);
    await expect(book(t + 3600_000, h)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().bookings.create({ ...form(t, { serviceId: "growth" }), slotId: h.slotId, holdToken: h.holdToken })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(book(t, { slotId: h.slotId, holdToken: "not-the-token" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(book(t, { slotId: 9999, holdToken: h.holdToken })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.state.bookings).toHaveLength(0);
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    // and the legitimate hold is still usable afterwards
    await book(t, h);
    expect(m.state.bookings).toHaveLength(1);
  });

  it("a repeated guest cancel is a no-op: one owner message, one notification", async () => {
    const t = SLOT();
    await book(t, await hold(t));
    const token = makeBookingActionToken({ bookingId: 1, action: "cancel" });
    const first = await caller().bookings.cancelByToken({ token, reason: "Clash" });
    const second = await caller().bookings.cancelByToken({ token, reason: "Clash" });
    expect(first).toMatchObject({ ok: true, alreadyCancelled: false });
    expect(second).toMatchObject({ ok: true, alreadyCancelled: true });
    // notifyOwner also fires once at booking time; only the cancellation messages are counted here.
    expect(m.notifyOwner.mock.calls.filter((c) => /cancelled/i.test(c[0].title))).toHaveLength(1);
    expect(m.emitNotification.mock.calls.filter((c) => c[0].event === "DISCOVERY_CALL_CANCELLED")).toHaveLength(1);
    expect(m.state.bookings[0].status).toBe("cancelled");
  });

  it("a cancel link for a booking that does not exist is refused", async () => {
    await expect(caller().bookings.cancelByToken({ token: makeBookingActionToken({ bookingId: 77, action: "cancel" }) })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("email delivery is recorded, never fabricated", () => {
  it("a failed confirmation email is audited and the email is not marked sent, while the booking stays confirmed", async () => {
    m.sendBookingConfirmation.mockResolvedValueOnce({ ok: false, transport: "smtp", error: "550 mailbox unavailable" });
    const t = SLOT();
    const r = await book(t, await hold(t));
    expect(r.success).toBe(true);
    expect(m.state.audit.map((a) => a.event)).toContain("email_failed");
    expect(m.state.audit.map((a) => a.event)).not.toContain("email_sent");
    expect(m.state.bookings[0].emailSent).toBe(0);
    expect(m.state.bookings[0].status).toBe("confirmed");
  });
});
