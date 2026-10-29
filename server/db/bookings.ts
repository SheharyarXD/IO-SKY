/**
 * server/db/bookings.ts
 *
 * Database helpers for the booking system.
 * Covers two layers:
 *   1. Legacy `bookings` table helpers (createBooking, appendBookingAudit, etc.)
 *   2. Native IO SKY Booking System helpers (availability, slots, reminders,
 *      events, timezone preferences).
 */
import { and, desc, eq, isNull, lte, ne, sql } from "drizzle-orm";
import {
  adminAvailability as adminAvailabilityTable,
  availabilityWindows as availabilityWindowsTable,
  bookingAnswers as bookingAnswersTable,
  bookingAudit,
  bookingEvents as bookingEventsTable,
  bookingReminders as bookingRemindersTable,
  bookings,
  bookingSlots as bookingSlotsTable,
  calendarBlocks as calendarBlocksTable,
  timezonePreferences as timezonePreferencesTable,
  type AdminAvailabilityRow,
  type AvailabilityWindow,
  type Booking,
  type BookingEvent,
  type BookingReminder,
  type BookingSlot,
  type CalendarBlock,
  type InsertAdminAvailability,
  type InsertAvailabilityWindow,
  type InsertBooking,
  type InsertBookingAnswer,
  type InsertBookingAudit,
  type InsertBookingEvent,
  type InsertBookingReminder,
  type InsertCalendarBlock,
} from "../../drizzle/schema";
import { getDb } from "./connection";

// ---------------------------------------------------------------------------
// Legacy booking helpers (Discovery Call bookings table)
// ---------------------------------------------------------------------------

export async function createBooking(input: InsertBooking): Promise<Booking | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create booking: database not available");
    return null;
  }
  const rows = await db.insert(bookings).values(input).returning();
  return rows[0] ?? null;
}

export async function appendBookingAudit(
  input: InsertBookingAudit,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(bookingAudit).values(input);
  } catch (error) {
    console.error("[Database] Failed to append booking audit:", error);
  }
}

export async function markBookingEmailSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ emailSent: 1 }).where(eq(bookings.id, id));
}

export async function markBookingOwnerNotified(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({ ownerNotified: 1 })
    .where(eq(bookings.id, id));
}

export async function listRecentBookings(limit = 100): Promise<Booking[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookings)
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
}

export async function getBookingByPublicRef(
  publicRef: string,
): Promise<Booking | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.publicRef, publicRef))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateBookingStatus(
  id: number,
  status: "pending" | "confirmed" | "cancelled" | "completed",
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
}

/**
 * Discovery Call spec §11 — admin-only PHONE/VIDEO toggle. Reverting to
 * PHONE always clears meetingUrl in the same write: "If VIDEO changes back
 * to PHONE, future communications remove the meeting URL and Join Meeting
 * CTA" only holds if the URL cannot outlive the switch on this row.
 */
export async function setBookingCallType(
  id: number,
  callType: "phone" | "video",
  meetingUrl: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookings)
    .set({ callType, meetingUrl: callType === "video" ? meetingUrl : null })
    .where(eq(bookings.id, id));
}

// ---------------------------------------------------------------------------
// Native IO SKY Booking System — availability rules
// ---------------------------------------------------------------------------

export async function listAdminAvailability(
  consultationType?: string,
): Promise<AdminAvailabilityRow[]> {
  const db = await getDb();
  if (!db) return [];
  if (consultationType) {
    return db
      .select()
      .from(adminAvailabilityTable)
      .where(
        and(
          eq(adminAvailabilityTable.consultationType, consultationType),
          eq(adminAvailabilityTable.active, 1),
        ),
      );
  }
  return db
    .select()
    .from(adminAvailabilityTable)
    .where(eq(adminAvailabilityTable.active, 1));
}

export async function insertAdminAvailability(
  row: InsertAdminAvailability,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminAvailabilityTable).values(row);
}

export async function deleteAdminAvailability(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(adminAvailabilityTable)
    .where(eq(adminAvailabilityTable.id, id));
}

export async function listAvailabilityWindows(
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<AvailabilityWindow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(availabilityWindowsTable)
    .where(
      and(
        sql`${availabilityWindowsTable.endMs} > ${rangeStartMs}`,
        sql`${availabilityWindowsTable.startMs} < ${rangeEndMs}`,
      ),
    );
}

export async function insertAvailabilityWindow(
  row: InsertAvailabilityWindow,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(availabilityWindowsTable).values(row);
}

export async function deleteAvailabilityWindow(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(availabilityWindowsTable)
    .where(eq(availabilityWindowsTable.id, id));
}

export async function listCalendarBlocks(
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<CalendarBlock[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(calendarBlocksTable)
    .where(
      and(
        sql`${calendarBlocksTable.endMs} > ${rangeStartMs}`,
        sql`${calendarBlocksTable.startMs} < ${rangeEndMs}`,
      ),
    );
}

export async function insertCalendarBlock(
  row: InsertCalendarBlock,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(calendarBlocksTable).values(row);
}

export async function deleteCalendarBlock(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(calendarBlocksTable)
    .where(eq(calendarBlocksTable.id, id));
}

// ---------------------------------------------------------------------------
// Native IO SKY Booking System — slot management
// ---------------------------------------------------------------------------

export async function listTakenBookingSlots(
  consultationType: string,
  rangeStartMs: number,
  rangeEndMs: number,
): Promise<BookingSlot[]> {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const rows = await db
    .select()
    .from(bookingSlotsTable)
    .where(
      and(
        eq(bookingSlotsTable.consultationType, consultationType),
        sql`${bookingSlotsTable.slotStartMs} >= ${rangeStartMs}`,
        sql`${bookingSlotsTable.slotStartMs} < ${rangeEndMs}`,
      ),
    );
  return rows.filter((r) => {
    if (r.status === "booked") return true;
    if (r.status === "held") {
      return r.holdExpiresAtMs != null && r.holdExpiresAtMs > now;
    }
    return false;
  });
}

/**
 * Detect a Postgres unique_violation (23505) through any wrapper.
 *
 * Drizzle raises `DrizzleQueryError` and hangs the driver error off `cause`,
 * so a naive `err.code === "23505"` check never matches. Walks the chain with
 * a depth bound so a self-referential cause cannot loop forever.
 *
 * Exported for the RM-113 suite, which asserts the unwrapping directly rather
 * than only observing it through a live race.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (code === "23505") return true;
    // postgres.js also exposes the SQLSTATE on some error shapes.
    if ((current as { constraint_name?: unknown }).constraint_name && code === undefined) {
      // fall through to cause
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export async function tryHoldBookingSlot(input: {
  consultationType: string;
  slotStartMs: number;
  slotEndMs: number;
  holdToken: string;
  holdTtlMs: number;
}): Promise<{ ok: true; id: number } | { ok: false; reason: "taken" | "db" }> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db" };

  try {
    await db.insert(bookingSlotsTable).values({
      consultationType: input.consultationType,
      slotStartMs: input.slotStartMs,
      slotEndMs: input.slotEndMs,
      holdToken: input.holdToken,
      holdExpiresAtMs: Date.now() + input.holdTtlMs,
      status: "held",
    });
    // Fetch the newly inserted row to get its id.
    const rows = await db
      .select()
      .from(bookingSlotsTable)
      .where(
        and(
          eq(bookingSlotsTable.consultationType, input.consultationType),
          eq(bookingSlotsTable.slotStartMs, input.slotStartMs),
          eq(bookingSlotsTable.holdToken, input.holdToken),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: false, reason: "db" };
    return { ok: true, id: row.id };
  } catch (err: unknown) {
    // Duplicate key = slot already held/booked by someone else.
    // Postgres unique_violation code (MySQL's ER_DUP_ENTRY/1062 equivalent).
    //
    // Must walk the `cause` chain, not just read `err.code`. Drizzle wraps
    // driver errors in a DrizzleQueryError, so the postgres.js error carrying
    // `code: "23505"` sits at `err.cause` (or deeper). Reading the top-level
    // code alone returned undefined for every real conflict, which had two
    // consequences once migration 0019 added the constraint:
    //
    //   1. A losing racer got `reason: "db"` instead of `"taken"`, so the UI
    //      showed a generic failure rather than "this slot was just taken,
    //      pick another time".
    //   2. The expired-hold takeover below sits inside this branch, so it
    //      never ran — an abandoned checkout would have blocked its slot
    //      permanently instead of releasing it after the 10-minute TTL.
    //
    // Both were caught by the RM-113 concurrency suite.
    const isDupe = isUniqueViolation(err);
    if (isDupe) {
      // Check if the existing hold has expired and can be taken over.
      const rows = await db
        .select()
        .from(bookingSlotsTable)
        .where(
          and(
            eq(bookingSlotsTable.consultationType, input.consultationType),
            eq(bookingSlotsTable.slotStartMs, input.slotStartMs),
          ),
        )
        .limit(1);
      const existing = rows[0];
      // A slot can be taken over in two cases: its hold lapsed, or the booking
      // that owned it was cancelled or rescheduled away (status "cancelled").
      // The unique index covers (type, start) whatever the status, so without
      // the second case a freed time could never be booked again.
      // Each takeover is a conditional update, so of two racing callers only
      // the one whose update still matches the row wins.
      const expiredHold =
        existing?.status === "held" && existing.holdExpiresAtMs != null && existing.holdExpiresAtMs <= Date.now();
      const released = existing?.status === "cancelled";
      if (existing && (expiredHold || released)) {
        const won = await db
          .update(bookingSlotsTable)
          .set({
            holdToken: input.holdToken,
            holdExpiresAtMs: Date.now() + input.holdTtlMs,
            bookingId: null,
            status: "held",
          })
          .where(
            and(
              eq(bookingSlotsTable.id, existing.id),
              released
                ? eq(bookingSlotsTable.status, "cancelled")
                : and(eq(bookingSlotsTable.status, "held"), lte(bookingSlotsTable.holdExpiresAtMs, Date.now())),
            ),
          )
          .returning({ id: bookingSlotsTable.id });
        if (won.length > 0) return { ok: true, id: existing.id };
      }
      return { ok: false, reason: "taken" };
    }
    return { ok: false, reason: "db" };
  }
}

/**
 * Is this hold still the caller's, and does it match the time and service being
 * booked? Checked BEFORE a booking row is written (S07): a stale, foreign or
 * mismatched hold must not leave a booking behind, and a hold on one time must
 * not be used to book another.
 */
export async function isHeldSlotValid(input: {
  slotId: number;
  holdToken: string;
  consultationType: string;
  slotStartMs: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select().from(bookingSlotsTable).where(eq(bookingSlotsTable.id, input.slotId)).limit(1);
  const slot = rows[0];
  return Boolean(
    slot &&
      slot.status === "held" &&
      slot.holdToken !== null &&
      slot.holdToken === input.holdToken &&
      slot.consultationType === input.consultationType &&
      Number(slot.slotStartMs) === input.slotStartMs,
  );
}

export async function confirmBookingSlot(input: {
  slotId: number;
  holdToken: string;
  bookingId: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // One conditional update instead of read-then-write: the hold must still be
  // held by this token, so two confirmations can never both succeed.
  const won = await db
    .update(bookingSlotsTable)
    .set({
      status: "booked",
      bookingId: input.bookingId,
      holdToken: null,
      holdExpiresAtMs: null,
    })
    .where(
      and(
        eq(bookingSlotsTable.id, input.slotId),
        eq(bookingSlotsTable.status, "held"),
        eq(bookingSlotsTable.holdToken, input.holdToken),
      ),
    )
    .returning({ id: bookingSlotsTable.id });
  return won.length > 0;
}

export async function cancelBookingSlot(bookingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingSlotsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingSlotsTable.bookingId, bookingId));
}

/**
 * Cancel/release a slot by its own id rather than by bookingId. Needed for
 * cleanup paths that must free a *held* (not yet confirmed) slot — a held
 * slot's `bookingId` column is still null, since that FK is only populated
 * by confirmBookingSlot(), so cancelBookingSlot(bookingId) can never match
 * it. Use this whenever the caller has a slotId but no confirmed booking.
 */
export async function cancelBookingSlotById(slotId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingSlotsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingSlotsTable.id, slotId));
}

/**
 * Release every slot a booking holds EXCEPT the one it is moving to. A
 * reschedule confirms the new slot against the booking first, so cancelling by
 * bookingId alone (cancelBookingSlot) would cancel the new slot too and free
 * the time the guest just chose.
 */
export async function cancelOtherBookingSlots(bookingId: number, keepSlotId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingSlotsTable)
    .set({ status: "cancelled" })
    .where(and(eq(bookingSlotsTable.bookingId, bookingId), ne(bookingSlotsTable.id, keepSlotId)));
}

/** Move a booking to its new time. Returns false when nothing was updated. */
export async function updateBookingSlotTime(
  id: number,
  patch: { slotStartMs: number; timezone: string },
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .update(bookings)
    .set({ slotStartMs: patch.slotStartMs, timezone: patch.timezone })
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id });
  return rows.length > 0;
}

/**
 * Look up a single booking by its internal numeric id. Used instead of
 * scanning listRecentBookings(N) for a target id — that pattern silently
 * "loses" bookings once the table exceeds N rows.
 */
export async function getBookingById(id: number): Promise<Booking | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertBookingAnswers(
  rows: InsertBookingAnswer[],
): Promise<void> {
  if (!rows.length) return;
  const db = await getDb();
  if (!db) return;
  await db.insert(bookingAnswersTable).values(rows);
}

export async function listBookingAnswers(bookingId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookingAnswersTable)
    .where(eq(bookingAnswersTable.bookingId, bookingId));
}

/**
 * The reminder rows a booking needs for a given start time. Offsets already in
 * the past are not backfilled (Discovery Call spec 12). The confirmation row is
 * only planned for a new booking; a reschedule sends its own confirmation.
 */
export function planBookingReminders(
  bookingId: number,
  slotStartMs: number,
  now: number,
  opts: { withConfirmation: boolean },
): InsertBookingReminder[] {
  const rows: InsertBookingReminder[] = [];
  if (opts.withConfirmation) rows.push({ bookingId, kind: "confirmation", scheduledForMs: now });
  const at24h = slotStartMs - 24 * 3600_000;
  if (at24h > now) rows.push({ bookingId, kind: "reminder_24h", scheduledForMs: at24h });
  const at1h = slotStartMs - 1 * 3600_000;
  if (at1h > now) rows.push({ bookingId, kind: "reminder_1h", scheduledForMs: at1h });
  return rows;
}

/**
 * Re-plan a booking's reminders after a reschedule. Unsent rows computed from
 * the old time are marked superseded (the worker's own convention, so they
 * stop showing as due without being sent), and rows for the new time are
 * added. Reminders already sent are left alone.
 */
export async function replaceBookingReminders(bookingId: number, slotStartMs: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingRemindersTable)
    .set({ sentAt: new Date(), errorDetail: "superseded: booking rescheduled" })
    .where(and(eq(bookingRemindersTable.bookingId, bookingId), isNull(bookingRemindersTable.sentAt)));
  const rows = planBookingReminders(bookingId, slotStartMs, Date.now(), { withConfirmation: false });
  if (rows.length > 0) await db.insert(bookingRemindersTable).values(rows);
}

export async function scheduleBookingReminders(
  bookingId: number,
  slotStartMs: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const rows = planBookingReminders(bookingId, slotStartMs, Date.now(), { withConfirmation: true });
  await db.insert(bookingRemindersTable).values(rows);
}

export async function listDueBookingReminders(
  nowMs: number,
  limit = 50,
): Promise<BookingReminder[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookingRemindersTable)
    .where(
      and(
        sql`${bookingRemindersTable.sentAt} IS NULL`,
        sql`${bookingRemindersTable.scheduledForMs} <= ${nowMs}`,
      ),
    )
    .limit(limit);
}

export async function markBookingReminderSent(
  id: number,
  errorDetail: string | null = null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingRemindersTable)
    .set({ sentAt: new Date(), errorDetail })
    .where(eq(bookingRemindersTable.id, id));
}

export async function appendBookingEvent(row: InsertBookingEvent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(bookingEventsTable).values(row);
  } catch (error) {
    console.warn("[Database] appendBookingEvent failed:", error);
  }
}

export async function listBookingEvents(
  bookingId: number,
): Promise<BookingEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookingEventsTable)
    .where(eq(bookingEventsTable.bookingId, bookingId))
    .orderBy(desc(bookingEventsTable.createdAt));
}

export async function rememberTimezonePreference(
  email: string,
  timezone: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(timezonePreferencesTable).values({ email, timezone });
  } catch (error) {
    console.warn("[Database] rememberTimezonePreference failed:", error);
  }
}

export async function listAllBookingSlotsForBookingId(
  bookingId: number,
): Promise<BookingSlot[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookingSlotsTable)
    .where(eq(bookingSlotsTable.bookingId, bookingId));
}
