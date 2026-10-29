/*
 * P0-06 / S01 (SRS 14.7): guest Discovery Call rescheduling.
 *
 * The data layer is replaced by a small in-memory model that keeps the real
 * semantics that matter here: a unique (type, start) slot row, a conditional
 * confirm, "cancel by booking id" cancelling EVERY slot of that booking, and
 * reminders that are either unsent or superseded. That is what makes the
 * original defect (confirm the new slot, then cancel all of the booking's
 * slots, including the new one) fail these tests.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
});

type Slot = {
  id: number;
  consultationType: string;
  slotStartMs: number;
  status: "held" | "booked" | "cancelled";
  holdToken: string | null;
  holdExpiresAtMs: number | null;
  bookingId: number | null;
};
type Reminder = { id: number; bookingId: number; kind: string; scheduledForMs: number; sentAt: Date | null; errorDetail: string | null };

const m = vi.hoisted(() => {
  const state = {
    booking: null as null | Record<string, any>,
    slots: [] as Array<any>,
    reminders: [] as Array<any>,
    events: [] as Array<any>,
    audit: [] as Array<any>,
    nextSlot: 1,
    nextReminder: 1,
  };
  return {
    state,
    sendBookingConfirmation: vi.fn(async (_: any) => ({ ok: true, transport: "console" as const, messageId: "m" })),
    emitNotification: vi.fn(async (_: any) => null),
    notifyOwner: vi.fn(async () => true),
    failNext: { updateBookingSlotTime: false, cancelOthers: false, confirm: false },
  };
});

vi.mock("./db", () => {
  const s = m.state;
  const slotsFor = (bookingId: number) => s.slots.filter((x: Slot) => x.bookingId === bookingId);
  return {
    getBookingById: vi.fn(async (id: number) => (s.booking && s.booking.id === id ? { ...s.booking } : null)),
    tryHoldBookingSlot: vi.fn(async (i: { consultationType: string; slotStartMs: number; holdToken: string; holdTtlMs: number }) => {
      const existing = s.slots.find((x: Slot) => x.consultationType === i.consultationType && x.slotStartMs === i.slotStartMs);
      if (!existing) {
        const row = { id: s.nextSlot++, consultationType: i.consultationType, slotStartMs: i.slotStartMs, status: "held", holdToken: i.holdToken, holdExpiresAtMs: Date.now() + i.holdTtlMs, bookingId: null };
        s.slots.push(row);
        return { ok: true as const, id: row.id };
      }
      const expired = existing.status === "held" && existing.holdExpiresAtMs != null && existing.holdExpiresAtMs <= Date.now();
      if (existing.status === "cancelled" || expired) {
        Object.assign(existing, { status: "held", holdToken: i.holdToken, holdExpiresAtMs: Date.now() + i.holdTtlMs, bookingId: null });
        return { ok: true as const, id: existing.id };
      }
      return { ok: false as const, reason: "taken" as const };
    }),
    confirmBookingSlot: vi.fn(async (i: { slotId: number; holdToken: string; bookingId: number }) => {
      if (m.failNext.confirm) return false;
      const slot = s.slots.find((x: Slot) => x.id === i.slotId);
      if (!slot || slot.status !== "held" || slot.holdToken !== i.holdToken) return false;
      Object.assign(slot, { status: "booked", bookingId: i.bookingId, holdToken: null, holdExpiresAtMs: null });
      return true;
    }),
    // Real semantics: cancels EVERY slot row owned by the booking.
    cancelBookingSlot: vi.fn(async (bookingId: number) => {
      for (const x of slotsFor(bookingId)) x.status = "cancelled";
    }),
    cancelBookingSlotById: vi.fn(async (id: number) => {
      const x = s.slots.find((y: Slot) => y.id === id);
      if (x) x.status = "cancelled";
    }),
    cancelOtherBookingSlots: vi.fn(async (bookingId: number, keep: number) => {
      if (m.failNext.cancelOthers) throw new Error("slot release failed");
      for (const x of slotsFor(bookingId)) if (x.id !== keep) x.status = "cancelled";
    }),
    updateBookingSlotTime: vi.fn(async (id: number, p: { slotStartMs: number; timezone: string }) => {
      if (m.failNext.updateBookingSlotTime) return false;
      if (!s.booking || s.booking.id !== id) return false;
      Object.assign(s.booking, p);
      return true;
    }),
    updateBookingStatus: vi.fn(async (id: number, status: string) => {
      if (s.booking && s.booking.id === id) s.booking.status = status;
    }),
    replaceBookingReminders: vi.fn(async (bookingId: number, slotStartMs: number) => {
      for (const r of s.reminders as Reminder[]) if (r.bookingId === bookingId && r.sentAt === null) Object.assign(r, { sentAt: new Date(), errorDetail: "superseded: booking rescheduled" });
      const now = Date.now();
      if (slotStartMs - 24 * 3600_000 > now) s.reminders.push({ id: s.nextReminder++, bookingId, kind: "reminder_24h", scheduledForMs: slotStartMs - 24 * 3600_000, sentAt: null, errorDetail: null });
      if (slotStartMs - 3600_000 > now) s.reminders.push({ id: s.nextReminder++, bookingId, kind: "reminder_1h", scheduledForMs: slotStartMs - 3600_000, sentAt: null, errorDetail: null });
    }),
    appendBookingEvent: vi.fn(async (e: any) => void s.events.push(e)),
    appendBookingAudit: vi.fn(async (e: any) => void s.audit.push(e)),
    // Present for the other procedures on this router; not exercised here.
    createBooking: vi.fn(),
    createLead: vi.fn(),
    getBookingByPublicRef: vi.fn(),
    insertBookingAnswers: vi.fn(),
    listRecentBookings: vi.fn(),
    markBookingEmailSent: vi.fn(),
    markBookingOwnerNotified: vi.fn(),
    rememberTimezonePreference: vi.fn(),
    scheduleBookingReminders: vi.fn(),
    listVerifiedMfaFactorsForUser: vi.fn(async () => []),
    appendLoginAudit: vi.fn(),
    getDb: vi.fn(async () => null),
  };
});

vi.mock("./email", () => ({ sendBookingConfirmation: m.sendBookingConfirmation }));
vi.mock("./notificationDispatcher", () => ({ emitNotification: m.emitNotification }));
vi.mock("./_core/notification", () => ({ notifyOwner: m.notifyOwner }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { makeBookingActionToken } from "./_core/booking/tokens";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const caller = () =>
  appRouter.createCaller({
    user: null,
    impersonation: null,
    req: { headers: { "user-agent": "vitest" }, socket: { remoteAddress: "127.0.0.1" } } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as TrpcContext);

let OLD: number;
let NEW: number;

function seed(overrides: Record<string, unknown> = {}) {
  const s = m.state;
  OLD = Date.now() + 5 * DAY;
  NEW = Date.now() + 7 * DAY;
  s.booking = {
    id: 42, publicRef: "IOSKY-AAAA-BBBB", serviceId: "discovery", slotStartMs: OLD, durationMin: 30, timezone: "Europe/Amsterdam",
    fullName: "Gina Guest", email: "gina@example.com", company: "Acme", status: "confirmed", callType: "phone", meetingUrl: null, locale: "en", ...overrides,
  };
  s.slots.push({ id: s.nextSlot++, consultationType: "discovery", slotStartMs: OLD, status: "booked", holdToken: null, holdExpiresAtMs: null, bookingId: 42 });
  s.reminders.push(
    { id: s.nextReminder++, bookingId: 42, kind: "confirmation", scheduledForMs: Date.now() - DAY, sentAt: new Date(), errorDetail: null },
    { id: s.nextReminder++, bookingId: 42, kind: "reminder_24h", scheduledForMs: OLD - DAY, sentAt: null, errorDetail: null },
    { id: s.nextReminder++, bookingId: 42, kind: "reminder_1h", scheduledForMs: OLD - HOUR, sentAt: null, errorDetail: null },
  );
}

const token = (action: "reschedule" | "cancel" = "reschedule", id = 42) => makeBookingActionToken({ bookingId: id, action });
const move = (to: number, extra: Record<string, unknown> = {}) => caller().bookings.rescheduleByToken({ token: token(), newSlotStartMs: to, timezone: "Europe/Berlin", ...extra });
const live = () => m.state.slots.filter((x: Slot) => x.bookingId === 42 && x.status === "booked");

beforeEach(() => {
  const s = m.state;
  s.booking = null;
  s.slots.length = 0;
  s.reminders.length = 0;
  s.events.length = 0;
  s.audit.length = 0;
  s.nextSlot = 1;
  s.nextReminder = 1;
  m.failNext.updateBookingSlotTime = false;
  m.failNext.cancelOthers = false;
  m.failNext.confirm = false;
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  seed();
});

describe("a successful reschedule", () => {
  it("leaves exactly one booked slot for the booking: the NEW one (regression for confirm-then-cancel-all)", async () => {
    const r = await move(NEW);
    expect(r).toMatchObject({ ok: true, unchanged: false, slotStartMs: NEW });
    expect(live()).toHaveLength(1);
    expect(live()[0].slotStartMs).toBe(NEW);
    const old = m.state.slots.find((x: Slot) => x.slotStartMs === OLD)!;
    expect(old.status).toBe("cancelled");
  });

  it("moves the booking itself, so confirmations and reminders show the new time and timezone", async () => {
    await move(NEW);
    expect(m.state.booking!.slotStartMs).toBe(NEW);
    expect(m.state.booking!.timezone).toBe("Europe/Berlin");
    expect(m.state.booking!.id).toBe(42); // same customer and appointment association
    expect(m.state.booking!.email).toBe("gina@example.com");
  });

  it("supersedes unsent reminders for the old time and plans new ones from the new time; sent ones are untouched", async () => {
    await move(NEW);
    const rs = m.state.reminders as Reminder[];
    const oldUnsent = rs.filter((r) => r.scheduledForMs === OLD - DAY || r.scheduledForMs === OLD - HOUR);
    expect(oldUnsent.every((r) => r.sentAt !== null && /superseded/.test(r.errorDetail ?? ""))).toBe(true);
    const fresh = rs.filter((r) => r.sentAt === null);
    expect(fresh.map((r) => r.kind).sort()).toEqual(["reminder_1h", "reminder_24h"]);
    expect(fresh.find((r) => r.kind === "reminder_24h")!.scheduledForMs).toBe(NEW - DAY);
    expect(fresh.find((r) => r.kind === "reminder_1h")!.scheduledForMs).toBe(NEW - HOUR);
    expect(rs.find((r) => r.kind === "confirmation")!.errorDetail).toBeNull(); // already-sent row not rewritten
  });

  it("sends exactly one updated confirmation (new time, fresh links) and one admin notification", async () => {
    await move(NEW);
    expect(m.sendBookingConfirmation).toHaveBeenCalledTimes(1);
    const mail = m.sendBookingConfirmation.mock.calls[0][0];
    expect(mail).toMatchObject({ email: "gina@example.com", slotStartMs: NEW, timezone: "Europe/Berlin", publicRef: "IOSKY-AAAA-BBBB" });
    expect(mail.cancelToken).toBeTruthy();
    expect(mail.rescheduleToken).toBeTruthy();
    expect(m.emitNotification).toHaveBeenCalledTimes(1);
    expect(m.emitNotification.mock.calls[0][0]).toMatchObject({ event: "DISCOVERY_CALL_RESCHEDULED", dedupeRef: `booking:42:rescheduled:${NEW}` });
  });

  it("records the move with the previous and new time", async () => {
    await move(NEW);
    const ev = m.state.events.find((e: any) => e.event === "rescheduled_by_guest");
    expect(JSON.parse(ev.detail)).toMatchObject({ previousSlotStartMs: OLD, newSlotStartMs: NEW });
  });

  it("returns the freed time to the calendar so another guest can book it", async () => {
    await move(NEW);
    const { getBookingAdapter } = await import("./_core/booking");
    const again = await getBookingAdapter().hold({ consultationType: "discovery", slotStartMs: OLD });
    expect(again.ok).toBe(true);
  });

  it("allows moving there and back (A to B to A)", async () => {
    await move(NEW);
    await move(OLD);
    expect(live()).toHaveLength(1);
    expect(live()[0].slotStartMs).toBe(OLD);
    expect(m.state.booking!.slotStartMs).toBe(OLD);
  });

  it("keeps the video link in the updated confirmation for a video call", async () => {
    m.state.booking!.callType = "video";
    m.state.booking!.meetingUrl = "https://meet.example/abc";
    await move(NEW);
    expect(m.sendBookingConfirmation.mock.calls[0][0].meetingUrl).toBe("https://meet.example/abc");
  });
});

describe("double booking and conflicts", () => {
  it("refuses a time another guest already holds and leaves the original booking untouched", async () => {
    m.state.slots.push({ id: m.state.nextSlot++, consultationType: "discovery", slotStartMs: NEW, status: "booked", holdToken: null, holdExpiresAtMs: null, bookingId: 99 });
    await expect(move(NEW)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(live()[0].slotStartMs).toBe(OLD);
    expect(m.state.booking!.slotStartMs).toBe(OLD);
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(m.emitNotification).not.toHaveBeenCalled();
  });

  it("refuses a time currently held by another guest checking out", async () => {
    m.state.slots.push({ id: m.state.nextSlot++, consultationType: "discovery", slotStartMs: NEW, status: "held", holdToken: "other", holdExpiresAtMs: Date.now() + 5 * 60_000, bookingId: null });
    await expect(move(NEW)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(m.state.booking!.slotStartMs).toBe(OLD);
  });

  it("two concurrent requests for the same free time: exactly one wins", async () => {
    const results = await Promise.allSettled([move(NEW), caller().bookings.rescheduleByToken({ token: token(), newSlotStartMs: NEW, timezone: "UTC" })]);
    // The same booking asking twice resolves to one booked slot, never two.
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(live()).toHaveLength(1);
    expect(live()[0].slotStartMs).toBe(NEW);
  });

  it("releases the hold when the confirmation is lost, so the time is not stranded", async () => {
    m.failNext.confirm = true;
    await expect(move(NEW)).rejects.toMatchObject({ code: "CONFLICT" });
    const held = m.state.slots.find((x: Slot) => x.slotStartMs === NEW)!;
    expect(held.status).toBe("cancelled");
    expect(m.state.booking!.slotStartMs).toBe(OLD);
    expect(live()[0].slotStartMs).toBe(OLD);
  });
});

describe("idempotency and validation", () => {
  it("treats the same time again as a no-op: no hold, email or notification", async () => {
    const r = await move(OLD);
    expect(r).toMatchObject({ ok: true, unchanged: true });
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(m.emitNotification).not.toHaveBeenCalled();
    expect(live()).toHaveLength(1);
  });

  it("a retried identical request does not send a second email or notification", async () => {
    await move(NEW);
    await move(NEW);
    expect(m.sendBookingConfirmation).toHaveBeenCalledTimes(1);
    expect(m.emitNotification).toHaveBeenCalledTimes(1);
  });

  it("refuses a cancelled booking and a completed booking", async () => {
    m.state.booking!.status = "cancelled";
    await expect(move(NEW)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    m.state.booking!.status = "completed";
    await expect(move(NEW)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(live()[0].slotStartMs).toBe(OLD);
  });

  it("refuses a call that has already started", async () => {
    m.state.booking!.slotStartMs = Date.now() - 60_000;
    await expect(move(NEW)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("refuses a new time in the past or under 30 minutes away", async () => {
    await expect(move(Date.now() - HOUR)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(move(Date.now() + 10 * 60_000)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.state.booking!.slotStartMs).toBe(OLD);
  });

  it("rejects a tampered token, a cancel token, and a token for another booking", async () => {
    await expect(caller().bookings.rescheduleByToken({ token: "42.reschedule.9999999999999.bad", newSlotStartMs: NEW, timezone: "UTC" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().bookings.rescheduleByToken({ token: token("cancel"), newSlotStartMs: NEW, timezone: "UTC" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().bookings.rescheduleByToken({ token: token("reschedule", 7), newSlotStartMs: NEW, timezone: "UTC" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(m.state.booking!.slotStartMs).toBe(OLD);
  });
});

describe("failure handling", () => {
  it("if the booking cannot be updated, the new slot is undone and the original time is kept", async () => {
    m.failNext.updateBookingSlotTime = true;
    await expect(move(NEW)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(live()).toHaveLength(1);
    expect(live()[0].slotStartMs).toBe(OLD);
    expect(m.state.slots.find((x: Slot) => x.slotStartMs === NEW)!.status).toBe("cancelled");
    expect(m.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(m.emitNotification).not.toHaveBeenCalled();
  });

  it("if the old slot cannot be released the reschedule still succeeds and the problem is audited", async () => {
    m.failNext.cancelOthers = true;
    const r = await move(NEW);
    expect(r.ok).toBe(true);
    expect(m.state.booking!.slotStartMs).toBe(NEW);
    expect(m.state.audit.some((a: any) => a.event === "old_slot_release_failed")).toBe(true);
  });

  it("a failing email does not undo the reschedule", async () => {
    m.sendBookingConfirmation.mockRejectedValueOnce(new Error("smtp down"));
    const r = await move(NEW);
    expect(r.ok).toBe(true);
    expect(m.state.booking!.slotStartMs).toBe(NEW);
  });
});

describe("cancelling from the guest link", () => {
  it("frees the slot and marks the booking cancelled so reminders stop", async () => {
    await caller().bookings.cancelByToken({ token: token("cancel"), reason: "No longer needed" });
    expect(live()).toHaveLength(0);
    expect(m.state.booking!.status).toBe("cancelled");
  });
});
