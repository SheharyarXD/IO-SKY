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
import { getBookingById, getBookingByPublicRef, listRecentBookings } from "../db";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { createRateLimiter } from "../_core/rateLimiter";
import { getRequestIp, getRequestMeta } from "../_core/requestMeta";
import { CONSULTATION_CATALOG, getBookingAdapter } from "../_core/booking";
import { verifyBookingActionToken } from "../_core/booking/tokens";
import { cancelBookingById, createBookingRequest, rescheduleBooking } from "../bookingService";
import { consultationEnum, createInputSchema } from "./bookingSchemas";

// ---------------------------------------------------------------------------
// Rate limiting & spam protection
// ---------------------------------------------------------------------------

const SUBMISSION_LIMIT_PER_MIN = 4;
const HOLD_LIMIT_PER_MIN = 12;

const isSubmissionRateLimited = createRateLimiter(SUBMISSION_LIMIT_PER_MIN);
const isHoldRateLimited = createRateLimiter(HOLD_LIMIT_PER_MIN);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------


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
      const ip = getRequestIp(ctx.req);
      if (await isHoldRateLimited(ip)) {
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

      const { ip, userAgent } = getRequestMeta(ctx.req);

      if (await isSubmissionRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many booking attempts. Please try again shortly.",
        });
      }

      return createBookingRequest(input, { ip, userAgent });
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
      return cancelBookingById(verified.bookingId, input.reason, "guest");
    }),

  /**
   * Guest reschedule from the emailed link (SRS 14.7).
   *
   * Order matters: the new time is held and confirmed to this booking first,
   * the booking row and its reminders move next, and only then are the OTHER
   * slot rows of the booking released. Cancelling by bookingId after the new
   * slot was confirmed (the previous code) cancelled the new slot as well, so
   * the guest believed they were booked while the time was open to anyone, and
   * the booking row and reminders still pointed at the old time.
   */
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
      const booking = await getBookingById(verified.bookingId);
      if (!booking) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      }
      return rescheduleBooking(booking, input.newSlotStartMs, input.timezone);
    }),

  listRecent: adminProcedure.query(async () => {
    return listRecentBookings(100);
  }),
});
