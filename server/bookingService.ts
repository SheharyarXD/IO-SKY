/**
 * Booking operations shared by the public booking router and the AI scheduling
 * tools (task S02). The code is the code that was in the router procedures,
 * moved here unchanged so that an agent can never book, move or cancel through
 * a path with weaker rules than the website: requested then confirmed (S07),
 * hold validation, conflict handling, idempotent cancel, reminders re-planned on
 * a reschedule (P0-06).
 *
 * Callers do their own caller-specific work first: the router verifies a signed
 * link token and applies per-IP rate limits; the agent tools verify the booking
 * reference against the guest's email and rely on the runtime's limits.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appendBookingAudit,
  appendBookingEvent,
  cancelBookingSlot,
  cancelBookingSlotById,
  cancelOtherBookingSlots,
  createBooking,
  createLead,
  getBookingById,
  isHeldSlotValid,
  insertBookingAnswers,
  markBookingEmailSent,
  markBookingOwnerNotified,
  rememberTimezonePreference,
  replaceBookingReminders,
  scheduleBookingReminders,
  confirmBookingSlot,
  updateBookingSlotTime,
  updateBookingStatus,
} from "./db";
import type { Booking } from "../drizzle/schema";
import { sendBookingConfirmation } from "./email";
import { notifyOwner } from "./_core/notification";
import { generatePublicRef } from "./_core/publicRef";
import { emitNotification } from "./notificationDispatcher";
import { CONSULTATION_CATALOG, getBookingAdapter } from "./_core/booking";
import { makeBookingActionToken } from "./_core/booking/tokens";

import { createInputSchema, consultationEnum } from "./routers/bookingSchemas";
export { createInputSchema, consultationEnum };

export type CreateBookingInput = z.infer<typeof createInputSchema>;

/** Create a booking request, commit its slot, and only then confirm (S07). Throws TRPCError. */
export async function createBookingRequest(
  input: CreateBookingInput,
  { ip, userAgent }: { ip: string | null; userAgent: string | null },
) {
  const service = CONSULTATION_CATALOG[input.serviceId];
  if (!service) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown service tier." });
  }

  // Ensure we own the slot. If the client didn't pre-hold we try to hold
  // now; this keeps the legacy create-only flow working while preventing
  // races.
  let slotId = input.slotId ?? 0;
  let holdToken = input.holdToken ?? "";
  if (!slotId || !holdToken) {
    const adapter = getBookingAdapter();
    const held = await adapter.hold({
      consultationType: input.serviceId,
      slotStartMs: input.slotStartMs,
    });
    if (!held.ok) {
      throw new TRPCError({
        code: held.reason === "taken" ? "CONFLICT" : "BAD_REQUEST",
        message:
          held.reason === "taken"
            ? "This slot was just taken. Please pick another time."
            : "Slot is unavailable.",
      });
    }
    slotId = held.slotId;
    holdToken = held.holdToken;
  } else if (!(await isHeldSlotValid({ slotId, holdToken, consultationType: input.serviceId, slotStartMs: input.slotStartMs }))) {
    // S07 / F-20: a stale, foreign or mismatched hold (including the second
    // submission of a double click, whose hold the first one consumed) is
    // refused before any booking row exists, so nothing is duplicated.
    throw new TRPCError({
      code: "CONFLICT",
      message: "This time is no longer held for you. Please pick a time again.",
    });
  }

  const publicRef = generatePublicRef();
  const booking = await createBooking({
    publicRef,
    serviceId: input.serviceId,
    slotStartMs: input.slotStartMs,
    durationMin: service.durationMin,
    timezone: input.timezone,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company?.trim() || null,
    role: input.role?.trim() || null,
    phone: input.phone.trim(),
    preparation: input.preparation ? JSON.stringify(input.preparation) : null,
    note: input.note?.trim() || null,
    utmSource: input.utmSource?.trim() || null,
    utmCampaign: input.utmCampaign?.trim() || null,
    // S07: this is a REQUEST until the slot is committed. It becomes
    // "confirmed" only after the scheduling system holds the slot for it,
    // and no email or notification goes out before that.
    status: "pending",
    locale: input.locale ?? null,
    ip,
    userAgent,
  });
  if (!booking) {
    // Free the held slot so the next caller can use it. The slot is
    // still only "held" at this point (confirmBookingSlot hasn't run),
    // so its bookingId column is null — cancelBookingSlot(bookingId)
    // could never match it. Cancel by the slot's own id instead.
    await cancelBookingSlotById(slotId).catch(() => null);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Booking could not be persisted. Please try again.",
    });
  }

  await appendBookingEvent({
    bookingId: booking.id,
    event: "requested",
    detail: JSON.stringify({ serviceId: input.serviceId, slotStartMs: input.slotStartMs }),
  });

  // Lock the slot to this booking. If confirmation fails the user lost
  // the race — surface a clean error. The request is closed out as
  // cancelled so a requested-but-never-confirmed booking cannot linger as
  // a real appointment, and nothing has been sent.
  const adapter = getBookingAdapter();
  const confirmed = await adapter.confirm({
    slotId,
    holdToken,
    bookingId: booking.id,
    slotStartMs: input.slotStartMs,
    consultationType: input.serviceId,
  });
  if (!confirmed.ok) {
    await updateBookingStatus(booking.id, "cancelled").catch(() => null);
    await appendBookingEvent({ bookingId: booking.id, event: "confirmation_failed", detail: "slot not committed" });
    throw new TRPCError({
      code: "CONFLICT",
      message: "Slot was reassigned. Please pick another time.",
    });
  }
  // The authoritative state change. Only after it succeeds is the booking
  // confirmed, and only then do the confirmation email, reminders,
  // notifications and CRM lead follow.
  try {
    await updateBookingStatus(booking.id, "confirmed");
  } catch (err) {
    console.error("[bookings.create] could not mark the booking confirmed:", err);
    await cancelBookingSlot(booking.id).catch(() => null);
    await appendBookingEvent({ bookingId: booking.id, event: "confirmation_failed", detail: "status update failed" });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Booking could not be confirmed. Please try again." });
  }
  await appendBookingEvent({ bookingId: booking.id, event: "confirmed", detail: JSON.stringify({ slotId }) });

  // Persist preparation answers as structured rows for the admin view.
  if (input.preparation) {
    const rows = Object.entries(input.preparation).map(([question, answer]) => ({
      bookingId: booking.id,
      question: question.slice(0, 200),
      answer: String(answer).slice(0, 2000),
    }));
    await insertBookingAnswers(rows).catch(() => null);
  }

  await appendBookingAudit({
    bookingId: booking.id,
    event: "created",
    detail: JSON.stringify({
      serviceId: input.serviceId,
      slotStartMs: input.slotStartMs,
      tz: input.timezone,
    }),
  });
  await appendBookingEvent({
    bookingId: booking.id,
    event: "created",
    detail: JSON.stringify({ serviceId: input.serviceId, slotStartMs: input.slotStartMs }),
  });

  await emitNotification({ event: "DISCOVERY_CALL_SCHEDULED", audience: { type: "admin" }, dedupeRef: `booking:${booking.id}:scheduled`, title: `Discovery Call scheduled: ${booking.fullName}`, href: "/admin/strategy-calls" }).catch(() => null);

  // Persist the timezone so reminders can render in the guest's tz.
  await rememberTimezonePreference(booking.email, input.timezone).catch(() => null);

  // Schedule the standard reminder cascade.
  await scheduleBookingReminders(booking.id, input.slotStartMs).catch(() => null);

  // CRM lead — keep the unified funnel populated.
  try {
    await createLead({
      source: "booking",
      sourceId: booking.id,
      fullName: booking.fullName,
      email: booking.email,
      company: booking.company ?? null,
      phone: booking.phone ?? null,
      interest: booking.serviceId,
      note: booking.note ?? null,
      status: "new",
      utmSource: booking.utmSource ?? null,
      utmCampaign: booking.utmCampaign ?? null,
      ip,
      userAgent,
    });
    await appendBookingAudit({ bookingId: booking.id, event: "crm_lead_created" });
  } catch (error) {
    console.warn("[bookings.create] createLead threw:", error);
    await appendBookingAudit({
      bookingId: booking.id,
      event: "crm_lead_failed",
      detail: (error as Error).message,
    });
  }

  // Confirmation email — fire-and-await so we can surface transport status.
  const cancelToken = makeBookingActionToken({ bookingId: booking.id, action: "cancel" });
  const rescheduleToken = makeBookingActionToken({ bookingId: booking.id, action: "reschedule" });
  const emailResult = await sendBookingConfirmation({
    publicRef,
    fullName: booking.fullName,
    email: booking.email,
    company: booking.company,
    serviceId: booking.serviceId,
    serviceLabel: service.label,
    slotStartMs: booking.slotStartMs,
    durationMin: booking.durationMin,
    timezone: booking.timezone,
    cancelToken,
    rescheduleToken,
    locale: input.locale ?? null,
  });
  await appendBookingAudit({
    bookingId: booking.id,
    event: emailResult.ok ? "email_sent" : "email_failed",
    detail: JSON.stringify({
      transport: emailResult.transport,
      messageId: emailResult.messageId,
      error: emailResult.error,
    }),
  });
  if (emailResult.ok) await markBookingEmailSent(booking.id);

  await emitNotification({ event: "DISCOVERY_CALL_REQUESTED", audience: { type: "admin" }, dedupeRef: `booking:${booking.id}`, title: `Discovery Call requested: ${booking.fullName}`, href: "/admin/strategy-calls", skipAdminFeed: true });

  // Owner notification — non-blocking.
  try {
    const when = new Date(booking.slotStartMs).toISOString();
    const sent = await notifyOwner({
      title: `New IO SKY Discovery Call · ${service.label}`,
      content: [
        `Ref: ${publicRef}`,
        `Name: ${booking.fullName}`,
        `Email: ${booking.email}`,
        booking.company ? `Company: ${booking.company}` : null,
        booking.role ? `Role: ${booking.role}` : null,
        `When (UTC): ${when}`,
        `Timezone: ${booking.timezone}`,
        `Duration: ${booking.durationMin} min`,
        booking.note ? `\nNote: ${booking.note}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    if (sent) await markBookingOwnerNotified(booking.id);
    await appendBookingAudit({
      bookingId: booking.id,
      event: sent ? "owner_notified" : "owner_notify_failed",
    });
  } catch (error) {
    console.warn("[bookings.create] notifyOwner threw:", error);
    await appendBookingAudit({
      bookingId: booking.id,
      event: "owner_notify_failed",
      detail: (error as Error).message,
    });
  }

  return {
    success: true as const,
    publicRef,
    emailTransport: emailResult.transport,
  };
}

/** Cancel a booking. Idempotent: cancelling a cancelled booking changes and sends nothing. Throws TRPCError. */
export async function cancelBookingById(bookingId: number, reason: string | undefined, by: "guest" | "assistant" = "guest") {
  // S07 / F-20: a repeated cancel (a second click, a re-opened email link) is
  // a no-op, not a second owner email or notification.
  const existing = await getBookingById(bookingId);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
  if (existing.status === "cancelled") return { ok: true as const, alreadyCancelled: true as const };
  await cancelBookingSlot(bookingId);
  // The reminder worker suppresses reminders for a cancelled booking only
  // when the booking itself says so; freeing the slot alone left them firing.
  await updateBookingStatus(bookingId, "cancelled");
  await appendBookingEvent({
    bookingId: bookingId,
    event: by === "guest" ? "cancelled_by_guest" : "cancelled_by_assistant",
    detail: reason ?? null,
  });
  await emitNotification({ event: "DISCOVERY_CALL_CANCELLED", audience: { type: "admin" }, dedupeRef: `booking:${bookingId}:cancelled`, title: `Discovery Call ${bookingId} cancelled ${by === "guest" ? "by the guest" : "at the guest's request through the AI assistant"}`, href: "/admin/strategy-calls", skipAdminFeed: true });
  await notifyOwner({
    title: `IO SKY · Booking ${bookingId} cancelled ${by === "guest" ? "by guest" : "through the AI assistant"}`,
    content: reason ?? "(no reason provided)",
  }).catch(() => null);
  return { ok: true as const, alreadyCancelled: false as const };
}

/**
 * Move a booking to a new time. The caller has already established that this
 * person may do so (a signed link, or a verified reference). Throws TRPCError.
 */
export async function rescheduleBooking(booking: Booking, newSlotStartMs: number, timezone: string) {
  if (booking.status === "cancelled" || booking.status === "completed") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This booking can no longer be rescheduled." });
  }
  const now = Date.now();
  if (booking.slotStartMs <= now) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This call has already started or taken place." });
  }
  // The same time again (a double click, a retried request) changes nothing,
  // so it succeeds without a second hold, email or notification.
  if (newSlotStartMs === booking.slotStartMs) {
    return { ok: true as const, unchanged: true as const, slotStartMs: booking.slotStartMs };
  }
  // The scheduler never offers a time under 30 minutes away; hold the same line here.
  if (newSlotStartMs < now + 30 * 60_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Please choose a time at least 30 minutes from now." });
  }

  const adapter = getBookingAdapter();
  const held = await adapter.hold({
    consultationType: booking.serviceId,
    slotStartMs: newSlotStartMs,
  });
  if (!held.ok) {
    throw new TRPCError({
      code: held.reason === "taken" ? "CONFLICT" : "BAD_REQUEST",
      message:
        held.reason === "taken"
          ? "This slot was just taken. Please pick another."
          : "Slot is unavailable.",
    });
  }
  const confirmed = await confirmBookingSlot({
    slotId: held.slotId,
    holdToken: held.holdToken,
    bookingId: booking.id,
  });
  if (!confirmed) {
    // Give the held row back so the time is not stranded for the hold TTL.
    await cancelBookingSlotById(held.slotId).catch(() => null);
    throw new TRPCError({ code: "CONFLICT", message: "Slot was reassigned. Try again." });
  }

  // Move the booking itself. If that fails the guest is still booked on the
  // old slot, which has not been touched: undo the new slot and report it.
  let moved = false;
  try {
    moved = await updateBookingSlotTime(booking.id, { slotStartMs: newSlotStartMs, timezone: timezone });
  } catch (err) {
    console.error("[bookings.rescheduleByToken] could not update the booking:", err);
  }
  if (!moved) {
    await cancelBookingSlotById(held.slotId).catch(() => null);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The booking could not be rescheduled. Your original time is unchanged." });
  }

  // Release the old slot row(s), keeping the new one. A failure here leaves a
  // stale blocked time, not a double booking, so it is recorded and not fatal.
  try {
    await cancelOtherBookingSlots(booking.id, held.slotId);
  } catch (err) {
    console.warn("[bookings.rescheduleByToken] old slot not released:", err);
    await appendBookingAudit({ bookingId: booking.id, event: "old_slot_release_failed", detail: (err as Error).message }).catch(() => null);
  }
  // Reminders computed from the old time are superseded; new ones follow the new time.
  await replaceBookingReminders(booking.id, newSlotStartMs).catch((err) => {
    console.warn("[bookings.rescheduleByToken] reminders not re-planned:", err);
  });

  await appendBookingEvent({
    bookingId: booking.id,
    event: "rescheduled_by_guest",
    detail: JSON.stringify({ previousSlotStartMs: booking.slotStartMs, newSlotStartMs: newSlotStartMs, tz: timezone }),
  });
  await appendBookingAudit({
    bookingId: booking.id,
    event: "rescheduled",
    detail: JSON.stringify({ from: booking.slotStartMs, to: newSlotStartMs }),
  }).catch(() => null);

  // One updated confirmation to the guest with the new time and fresh links.
  try {
    const service = CONSULTATION_CATALOG[booking.serviceId as keyof typeof CONSULTATION_CATALOG];
    await sendBookingConfirmation({
      publicRef: booking.publicRef,
      fullName: booking.fullName,
      email: booking.email,
      company: booking.company,
      serviceId: booking.serviceId,
      serviceLabel: service?.label ?? booking.serviceId,
      slotStartMs: newSlotStartMs,
      durationMin: booking.durationMin,
      timezone: timezone,
      meetingUrl: booking.callType === "video" ? booking.meetingUrl : null,
      cancelToken: makeBookingActionToken({ bookingId: booking.id, action: "cancel" }),
      rescheduleToken: makeBookingActionToken({ bookingId: booking.id, action: "reschedule" }),
      locale: booking.locale,
    });
  } catch (err) {
    console.warn("[bookings.rescheduleByToken] updated confirmation not sent:", err);
  }

  await emitNotification({ event: "DISCOVERY_CALL_RESCHEDULED", audience: { type: "admin" }, dedupeRef: `booking:${booking.id}:rescheduled:${newSlotStartMs}`, title: `Discovery Call rescheduled by the guest: ${booking.fullName}`, href: "/admin/strategy-calls" }).catch(() => null);
  return { ok: true as const, unchanged: false as const, slotStartMs: newSlotStartMs };
}
