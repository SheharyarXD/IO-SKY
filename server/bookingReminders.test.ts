/**
 * dispatchDueBookingReminders (server/_core/bookingReminders.ts).
 *
 * Discovery Call spec §12: 24h/1h reminders, cancellation suppresses future
 * reminders, and the "confirmation" kind must never be re-sent here (it's
 * already sent synchronously at booking time by bookings.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const markSentCalls: Array<{ id: number; errorDetail: string | null }> = [];
let dueReminders: any[] = [];
let bookingsById: Record<number, any> = {};
const sendMock = vi.fn();

vi.mock("./db", () => ({
  listDueBookingReminders: vi.fn(async () => dueReminders),
  getBookingById: vi.fn(async (id: number) => bookingsById[id] ?? null),
  markBookingReminderSent: vi.fn(async (id: number, errorDetail: string | null = null) => {
    markSentCalls.push({ id, errorDetail });
  }),
}));

vi.mock("./email", () => ({
  sendBookingConfirmation: (...args: any[]) => sendMock(...args),
}));

vi.mock("./_core/booking", () => ({
  CONSULTATION_CATALOG: {
    discovery: { label: "Discovery Call", durationMin: 30 },
  },
}));

vi.mock("./_core/booking/tokens", () => ({
  makeBookingActionToken: vi.fn(() => "token"),
}));

import { dispatchDueBookingReminders } from "./_core/bookingReminders";

function makeBooking(overrides: Partial<any> = {}) {
  return {
    id: 1,
    publicRef: "IO-TEST-001",
    fullName: "Jan Jansen",
    email: "jan@example.com",
    company: "Acme",
    serviceId: "discovery",
    slotStartMs: Date.now() + 3600_000,
    durationMin: 30,
    timezone: "Europe/Amsterdam",
    status: "confirmed",
    callType: "phone",
    meetingUrl: null,
    locale: "NL",
    ...overrides,
  };
}

beforeEach(() => {
  markSentCalls.length = 0;
  dueReminders = [];
  bookingsById = {};
  sendMock.mockReset();
  sendMock.mockResolvedValue({ ok: true, transport: "console" });
});

describe("dispatchDueBookingReminders", () => {
  it("sends a due 24h reminder and marks it sent", async () => {
    bookingsById[1] = makeBooking();
    dueReminders = [{ id: 10, bookingId: 1, kind: "reminder_24h" }];

    const summary = await dispatchDueBookingReminders();

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ publicRef: "IO-TEST-001", locale: "NL" });
    expect(markSentCalls).toEqual([{ id: 10, errorDetail: null }]);
    expect(summary).toEqual({ checked: 1, sent: 1, failed: 0, skipped: 0 });
  });

  it("never re-sends a 'confirmation' reminder — only marks it as handled", async () => {
    dueReminders = [{ id: 11, bookingId: 1, kind: "confirmation" }];

    const summary = await dispatchDueBookingReminders();

    expect(sendMock).not.toHaveBeenCalled();
    expect(markSentCalls[0].id).toBe(11);
    expect(summary.skipped).toBe(1);
  });

  it("suppresses a reminder for a cancelled booking without emailing", async () => {
    bookingsById[1] = makeBooking({ status: "cancelled" });
    dueReminders = [{ id: 12, bookingId: 1, kind: "reminder_1h" }];

    const summary = await dispatchDueBookingReminders();

    expect(sendMock).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });

  it("includes the meeting URL only when callType is video", async () => {
    bookingsById[1] = makeBooking({ callType: "video", meetingUrl: "https://meet.example.com/abc" });
    dueReminders = [{ id: 13, bookingId: 1, kind: "reminder_24h" }];

    await dispatchDueBookingReminders();

    expect(sendMock.mock.calls[0][0].meetingUrl).toBe("https://meet.example.com/abc");
  });

  it("omits the meeting URL when callType has reverted to phone, even if one is stored", async () => {
    bookingsById[1] = makeBooking({ callType: "phone", meetingUrl: "https://stale.example.com" });
    dueReminders = [{ id: 14, bookingId: 1, kind: "reminder_24h" }];

    await dispatchDueBookingReminders();

    expect(sendMock.mock.calls[0][0].meetingUrl).toBeNull();
  });

  it("records a failed send without throwing", async () => {
    bookingsById[1] = makeBooking();
    dueReminders = [{ id: 15, bookingId: 1, kind: "reminder_1h" }];
    sendMock.mockResolvedValue({ ok: false, transport: "console", error: "SMTP down" });

    const summary = await dispatchDueBookingReminders();

    expect(markSentCalls).toEqual([{ id: 15, errorDetail: "SMTP down" }]);
    expect(summary.failed).toBe(1);
  });

  it("skips a reminder whose booking no longer exists", async () => {
    dueReminders = [{ id: 16, bookingId: 999, kind: "reminder_24h" }];

    const summary = await dispatchDueBookingReminders();

    expect(sendMock).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });
});
