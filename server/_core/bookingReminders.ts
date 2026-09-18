/**
 * Discovery Call spec §12 (Customer Communications & Reminders):
 * "Customer reminders: 24 hours and 1 hour before; state-aware; expired
 * offsets are not backfilled... Cancellation suppresses future reminders."
 *
 * `scheduleBookingReminders` (server/db/bookings.ts) already inserts the
 * confirmation/24h/1h rows at booking time — that part was built. What was
 * missing is anything that actually sends the 24h/1h rows once they come
 * due: `listDueBookingReminders` existed but nothing ever called it, and no
 * cron/heartbeat process exists anywhere in this codebase to call it on a
 * schedule. This module is that missing dispatcher; server/_core/index.ts
 * wires it to an in-process interval, and bookingAdmin.remindersTick exposes
 * a manual trigger for the same logic (matching this router's own doc
 * comment, "reminders.tick — manual reminder dispatch").
 *
 * The "confirmation" kind is deliberately never dispatched here: bookings.ts
 * already sends that email synchronously at creation and marks it via
 * markBookingEmailSent, so processing it again here would double-send.
 */
import {
  getBookingById,
  listDueBookingReminders,
  markBookingReminderSent,
} from "../db";
import type { BookingReminder } from "../../drizzle/schema";
import { CONSULTATION_CATALOG } from "./booking";
import { makeBookingActionToken } from "./booking/tokens";
import { sendBookingConfirmation } from "../email";

const DISPATCHABLE_KINDS: ReadonlySet<BookingReminder["kind"]> = new Set([
  "reminder_24h",
  "reminder_1h",
]);

export interface ReminderDispatchSummary {
  checked: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Sends every due, unsent 24h/1h reminder. Re-reads the booking fresh for
 * each row (not a snapshot from when the reminder was scheduled) so a
 * cancellation or a later PHONE→VIDEO switch is reflected in what actually
 * goes out — the whole point of the callType/meetingUrl columns living on
 * the booking rather than being frozen into the reminder row.
 */
export async function dispatchDueBookingReminders(
  nowMs: number = Date.now(),
): Promise<ReminderDispatchSummary> {
  const due = await listDueBookingReminders(nowMs);
  const summary: ReminderDispatchSummary = { checked: due.length, sent: 0, failed: 0, skipped: 0 };

  for (const reminder of due) {
    if (!DISPATCHABLE_KINDS.has(reminder.kind)) {
      // "confirmation" rows land here too (scheduleBookingReminders inserts
      // one for every booking) — mark them sent-as-skipped so they stop
      // showing up as due forever, without ever emailing from this path.
      await markBookingReminderSent(reminder.id, "skipped: handled synchronously at booking time");
      summary.skipped++;
      continue;
    }

    const booking = await getBookingById(reminder.bookingId);
    if (!booking) {
      await markBookingReminderSent(reminder.id, "booking no longer exists");
      summary.skipped++;
      continue;
    }
    if (booking.status === "cancelled") {
      // Spec: "Cancellation suppresses future reminders."
      await markBookingReminderSent(reminder.id, "skipped: booking cancelled");
      summary.skipped++;
      continue;
    }

    const service = CONSULTATION_CATALOG[booking.serviceId as keyof typeof CONSULTATION_CATALOG];
    const cancelToken = makeBookingActionToken({ bookingId: booking.id, action: "cancel" });
    const rescheduleToken = makeBookingActionToken({ bookingId: booking.id, action: "reschedule" });

    const result = await sendBookingConfirmation({
      publicRef: booking.publicRef,
      fullName: booking.fullName,
      email: booking.email,
      company: booking.company,
      serviceId: booking.serviceId,
      serviceLabel: service?.label ?? booking.serviceId,
      slotStartMs: booking.slotStartMs,
      durationMin: booking.durationMin,
      timezone: booking.timezone,
      meetingUrl: booking.callType === "video" ? booking.meetingUrl : null,
      cancelToken,
      rescheduleToken,
      locale: booking.locale,
    });

    await markBookingReminderSent(reminder.id, result.ok ? null : result.error ?? "send failed");
    if (result.ok) summary.sent++;
    else summary.failed++;
  }

  return summary;
}
