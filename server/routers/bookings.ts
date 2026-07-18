/**
 * IO SKY — Discovery Call bookings router (native adapter).
 *
 * Public procedures:
 *   bookings.listSlots          List available slot starts in a UTC range.
 *   bookings.hold               Lock a slot for ~10 minutes while the user
 *                               fills out preparation answers.
 *   bookings.create             Confirm the held slot, create the booking,
 *                               schedule reminders, write CRM lead and
 *                               notify the owner.
 *   bookings.getByRef           Look up confirmation details for a publicRef
 *                               (rate-limited, no PII leak).
 *   bookings.cancelByToken      Cancel a booking from the email link
 *                               (HMAC-signed token).
 *   bookings.rescheduleByToken  Reschedule a booking from the email link.
 *
 * Admin surface lives in routers/bookingAdmin.ts and is mounted under
 * `bookingAdmin.*` in routers.ts.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  appendBookingAudit,
  appendBookingEvent,
  cancelBookingSlot,
  createBooking,
  createLead,
  getBookingByPublicRef,
  insertBookingAnswers,
  listRecentBookings,
  markBookingEmailSent,
  markBookingOwnerNotified,
  rememberTimezonePreference,
  scheduleBookingReminders,
  tryHoldBookingSlot,
  confirmBookingSlot,
} from "../db";
import { sendBookingConfirmation } from "../email";
import { notifyOwner } from "../_core/notification";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import {
  CONSULTATION_CATALOG,
  getBookingAdapter,
} from "../_core/booking";
import {
  makeBookingActionToken,
  verifyBookingActionToken,
} from "../_core/booking/tokens";

// ---------------------------------------------------------------------------
// Rate limiting & spam protection
// ---------------------------------------------------------------------------

const submissionsByIp = new Map<string, number[]>();
const SUBMISSION_WINDOW_MS = 60_000;
const SUBMISSION_LIMIT_PER_MIN = 4;
const HOLD_LIMIT_PER_MIN = 12;
const holdsByIp = new Map<string, number[]>();

function isRateLimited(map: Map<string, number[]>, ip: string | null, limit: number): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (map.get(ip) || []).filter((t) => now - t < SUBMISSION_WINDOW_MS);
  recent.push(now);
  map.set(ip, recent);
  return recent.length > limit;
}

function generatePublicRef(): string {
  const block = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[0OIL1]/g, "X");
  return `IOSKY-${block()}-${block()}`;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const consultationEnum = z.enum(["discovery", "growth", "elite"]);

const listSlotsSchema = z.object({
  consultationType: consultationEnum,
  rangeStartMs: z.number(),
  rangeEndMs: z.number(),
  timezone: z.string().min(2).max(64).optional(),
});

const holdSchema = z.object({
  consultationType: consultationEnum,
  slotStartMs: z.number(),
  timezone: z.string().min(2).max(64).optional(),
});

const createInputSchema = z.object({
  serviceId: consultationEnum,
  slotStartMs: z
    .number()
    .int()
    .min(Date.now() - 24 * 3600_000, "Slot must not be in the past.")
    .max(Date.now() + 365 * 24 * 3600_000, "Slot must be within one year."),
  timezone: z.string().min(2).max(64),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  company: z.string().max(200).optional().nullable(),
  role: z.string().max(120).optional().nullable(),
  phone: z.string().max(64).optional().nullable(),
  preparation: z.record(z.string(), z.string().max(2000)).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  /** Optional hold token returned by bookings.hold. If present we treat the
   *  existing held slot as authoritative; if absent we attempt to hold then
   *  immediately confirm (legacy create path). */
  holdToken: z.string().max(128).optional().nullable(),
  slotId: z.number().int().positive().optional().nullable(),
  /** Honeypot — must be empty. */
  website: z.string().max(0).optional().nullable(),
  /** Recipient UI locale for the localised confirmation email (e.g. "NL"). */
  locale: z.string().max(16).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bookingsRouter = router({
  // ---- Discovery ---------------------------------------------------------
  listSlots: publicProcedure
    .input(listSlotsSchema)
    .query(async ({ input }) => {
      const adapter = getBookingAdapter();
      const slots = await adapter.listAvailableSlots({
        consultationType: input.consultationType,
        rangeStartMs: input.rangeStartMs,
        rangeEndMs: input.rangeEndMs,
      });
      // Only return available slots to the public — taken slots simply
      // disappear ("unavailable slots direct verbergen").
      return slots.filter((s) => s.available);
    }),

  hold: publicProcedure
    .input(holdSchema)
    .mutation(async ({ ctx, input }) => {
      const ip =
        (ctx.req?.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ||
        ctx.req?.socket?.remoteAddress ||
        null;
      if (isRateLimited(holdsByIp, ip, HOLD_LIMIT_PER_MIN)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please try again shortly.",
        });
      }
      const tier = CONSULTATION_CATALOG[input.consultationType];
      if (!tier) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown service tier." });
      }
      const adapter = getBookingAdapter();
      const result = await adapter.hold({
        consultationType: input.consultationType,
        slotStartMs: input.slotStartMs,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "taken" ? "CONFLICT" : "BAD_REQUEST",
          message:
            result.reason === "taken"
              ? "This slot was just taken. Please pick another time."
              : "Slot is unavailable.",
        });
      }
      return {
        slotId: result.slotId,
        holdToken: result.holdToken,
        holdExpiresAtMs: result.holdExpiresAtMs,
      };
    }),

  // ---- Confirmation ------------------------------------------------------
  create: publicProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Honeypot — silently return success-shape so bots can't probe.
      if (input.website && input.website.length > 0) {
        return {
          success: true as const,
          publicRef: "IOSKY-XXXX-XXXX",
          emailTransport: "console" as const,
        };
      }

      const ip =
        (ctx.req?.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() ||
        ctx.req?.socket?.remoteAddress ||
        null;
      const userAgent = (ctx.req?.headers["user-agent"] as string) || null;

      if (isRateLimited(submissionsByIp, ip, SUBMISSION_LIMIT_PER_MIN)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many booking attempts. Please try again shortly.",
        });
      }

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
        phone: input.phone?.trim() || null,
        preparation: input.preparation ? JSON.stringify(input.preparation) : null,
        note: input.note?.trim() || null,
        utmSource: input.utmSource?.trim() || null,
        utmCampaign: input.utmCampaign?.trim() || null,
        status: "confirmed",
        ip,
        userAgent,
      });
      if (!booking) {
        // Free the held slot so the next caller can use it.
        await cancelBookingSlot(0).catch(() => null);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Booking could not be persisted. Please try again.",
        });
      }

      // Lock the slot to this booking. If confirmation fails the user lost
      // the race — surface a clean error.
      const adapter = getBookingAdapter();
      const confirmed = await adapter.confirm({
        slotId,
        holdToken,
        bookingId: booking.id,
        slotStartMs: input.slotStartMs,
        consultationType: input.serviceId,
      });
      if (!confirmed.ok) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Slot was reassigned. Please pick another time.",
        });
      }

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
    }),

  getByRef: publicProcedure
    .input(z.object({ publicRef: z.string().min(8).max(32) }))
    .query(async ({ input }) => {
      const booking = await getBookingByPublicRef(input.publicRef);
      if (!booking) return null;
      // Never leak PII from a public ref — only what a confirmation screen needs.
      return {
        publicRef: booking.publicRef,
        serviceId: booking.serviceId,
        slotStartMs: booking.slotStartMs,
        durationMin: booking.durationMin,
        timezone: booking.timezone,
        status: booking.status,
        createdAt: booking.createdAt,
      };
    }),

  cancelByToken: publicProcedure
    .input(z.object({ token: z.string().min(10).max(512), reason: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      const verified = verifyBookingActionToken(input.token, "cancel");
      if (!verified.ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: `Invalid token (${verified.reason}).` });
      }
      await cancelBookingSlot(verified.bookingId);
      await appendBookingEvent({
        bookingId: verified.bookingId,
        event: "cancelled_by_guest",
        detail: input.reason ?? null,
      });
      await notifyOwner({
        title: `IO SKY · Booking ${verified.bookingId} cancelled by guest`,
        content: input.reason ?? "(no reason provided)",
      }).catch(() => null);
      return { ok: true as const };
    }),

  rescheduleByToken: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(512),
        newSlotStartMs: z.number().int(),
        timezone: z.string().min(2).max(64),
      }),
    )
    .mutation(async ({ input }) => {
      const verified = verifyBookingActionToken(input.token, "reschedule");
      if (!verified.ok) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: `Invalid token (${verified.reason}).` });
      }
      const booking = await (async () => {
        // Load by id via list helper; we don't expose a getById publicly.
        const all = await listRecentBookings(5000);
        return all.find((b) => b.id === verified.bookingId) ?? null;
      })();
      if (!booking) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      }
      const adapter = getBookingAdapter();
      const held = await adapter.hold({
        consultationType: booking.serviceId,
        slotStartMs: input.newSlotStartMs,
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
        throw new TRPCError({ code: "CONFLICT", message: "Slot was reassigned. Try again." });
      }
      // Release the old slot row.
      await cancelBookingSlot(booking.id).catch(() => null);
      await appendBookingEvent({
        bookingId: booking.id,
        event: "rescheduled_by_guest",
        detail: JSON.stringify({ newSlotStartMs: input.newSlotStartMs, tz: input.timezone }),
      });
      return { ok: true as const };
    }),

  listRecent: adminProcedure.query(async () => {
    return listRecentBookings(100);
  }),
});
