/**
 * IO SKY — Native booking admin router.
 *
 * Surface area inside Admin Portal:
 *   adminAvailability.list/upsert/delete   — weekday/start/end rules per consultation
 *   availabilityWindow.list/add/delete     — ad-hoc one-off open/close windows
 *   calendarBlock.list/add/delete          — vacation / holiday rows
 *   bookings.list                          — recent native bookings (joins answers)
 *   bookings.events                        — audit trail for a single booking
 *   bookings.cancel/reschedule/noShow      — admin-driven lifecycle changes
 *   reminders.tick                         — manual reminder dispatch (Heartbeat does this too)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import {
  appendBookingEvent,
  cancelBookingSlot,
  deleteAdminAvailability,
  deleteAvailabilityWindow,
  deleteCalendarBlock,
  getBookingByPublicRef,
  insertAdminAvailability,
  insertAvailabilityWindow,
  insertCalendarBlock,
  listAdminAvailability,
  listAvailabilityWindows,
  listBookingAnswers,
  listBookingEvents,
  listCalendarBlocks,
  listRecentBookings,
} from "../db";
import { notifyOwner } from "../_core/notification";

const weekdaySchema = z.number().int().min(0).max(6);

export const bookingAdminRouter = router({
  // -------------------------------------------------------------------
  // Recurring availability rules
  // -------------------------------------------------------------------
  listAvailabilityRules: adminProcedure.query(async () => {
    return listAdminAvailability();
  }),

  upsertAvailabilityRule: adminProcedure
    .input(
      z.object({
        consultationType: z.enum(["discovery", "growth", "elite"]),
        weekday: weekdaySchema,
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(0).max(1440),
        timezone: z.string().min(2).max(64),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.endMinute <= input.startMinute) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End minute must be after start minute." });
      }
      await insertAdminAvailability({
        consultationType: input.consultationType,
        weekday: input.weekday,
        startMinute: input.startMinute,
        endMinute: input.endMinute,
        timezone: input.timezone,
        active: 1,
      });
      return { ok: true as const };
    }),

  deleteAvailabilityRule: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteAdminAvailability(input.id);
      return { ok: true as const };
    }),

  // -------------------------------------------------------------------
  // Ad-hoc open/close windows
  // -------------------------------------------------------------------
  listAvailabilityWindows: adminProcedure
    .input(z.object({ rangeStartMs: z.number(), rangeEndMs: z.number() }))
    .query(async ({ input }) => {
      return listAvailabilityWindows(input.rangeStartMs, input.rangeEndMs);
    }),

  addAvailabilityWindow: adminProcedure
    .input(
      z.object({
        consultationType: z.enum(["discovery", "growth", "elite"]).nullable().optional(),
        kind: z.enum(["open", "close"]),
        startMs: z.number(),
        endMs: z.number(),
        reason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.endMs <= input.startMs) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start." });
      }
      await insertAvailabilityWindow({
        consultationType: input.consultationType ?? null,
        kind: input.kind,
        startMs: input.startMs,
        endMs: input.endMs,
        reason: input.reason ?? null,
      });
      return { ok: true as const };
    }),

  deleteAvailabilityWindow: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteAvailabilityWindow(input.id);
      return { ok: true as const };
    }),

  // -------------------------------------------------------------------
  // Calendar blocks (vacation / holiday)
  // -------------------------------------------------------------------
  listCalendarBlocks: adminProcedure
    .input(z.object({ rangeStartMs: z.number(), rangeEndMs: z.number() }))
    .query(async ({ input }) => {
      return listCalendarBlocks(input.rangeStartMs, input.rangeEndMs);
    }),

  addCalendarBlock: adminProcedure
    .input(
      z.object({
        startMs: z.number(),
        endMs: z.number(),
        label: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.endMs <= input.startMs) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start." });
      }
      await insertCalendarBlock(input);
      return { ok: true as const };
    }),

  deleteCalendarBlock: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteCalendarBlock(input.id);
      return { ok: true as const };
    }),

  // -------------------------------------------------------------------
  // Booking lifecycle
  // -------------------------------------------------------------------
  listRecent: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional())
    .query(async ({ input }) => {
      return listRecentBookings(input?.limit ?? 100);
    }),

  bookingDetail: adminProcedure
    .input(z.object({ publicRef: z.string().min(8).max(32) }))
    .query(async ({ input }) => {
      const booking = await getBookingByPublicRef(input.publicRef);
      if (!booking) return null;
      const [answers, events] = await Promise.all([
        listBookingAnswers(booking.id),
        listBookingEvents(booking.id),
      ]);
      return { booking, answers, events };
    }),

  cancel: adminProcedure
    .input(
      z.object({
        publicRef: z.string().min(8).max(32),
        reason: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingByPublicRef(input.publicRef);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      await cancelBookingSlot(booking.id);
      await appendBookingEvent({
        bookingId: booking.id,
        event: "admin_cancelled",
        actorOpenId: ctx.user?.openId ?? null,
        detail: input.reason ?? null,
      });
      await notifyOwner({
        title: `IO SKY · Booking ${booking.publicRef} cancelled by admin`,
        content: [
          `Ref: ${booking.publicRef}`,
          `Guest: ${booking.fullName} <${booking.email}>`,
          `Reason: ${input.reason ?? "(not provided)"}`,
        ].join("\n"),
      }).catch(() => null);
      return { ok: true as const };
    }),

  markNoShow: adminProcedure
    .input(z.object({ publicRef: z.string().min(8).max(32) }))
    .mutation(async ({ ctx, input }) => {
      const booking = await getBookingByPublicRef(input.publicRef);
      if (!booking) throw new TRPCError({ code: "NOT_FOUND" });
      await appendBookingEvent({
        bookingId: booking.id,
        event: "no_show",
        actorOpenId: ctx.user?.openId ?? null,
      });
      return { ok: true as const };
    }),
});

export type BookingAdminRouter = typeof bookingAdminRouter;
