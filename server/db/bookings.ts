/**
 * server/db/bookings.ts
 *
 * Database helpers for the booking system.
 * Covers two layers:
 *   1. Legacy `bookings` table helpers (createBooking, appendBookingAudit, etc.)
 *   2. Native IO SKY Booking System helpers (availability, slots, reminders,
 *      events, timezone preferences).
 */
import { and, desc, eq, sql } from "drizzle-orm";
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
  const result = await db.insert(bookings).values(input);
  // mysql2 driver returns [ResultSetHeader, fields]; insertId on header.
  // drizzle wraps this; cast through unknown for typing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertId =
    (result as unknown as any)[0]?.insertId ??
    (result as unknown as any).insertId;
  if (!insertId) {
    console.warn("[Database] createBooking: insertId missing");
    return null;
  }
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, Number(insertId)))
    .limit(1);
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
    const isDupe =
      (err as any)?.code === "ER_DUP_ENTRY" ||
      (err as any)?.errno === 1062;
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
      if (
        existing &&
        existing.status === "held" &&
        existing.holdExpiresAtMs != null &&
        existing.holdExpiresAtMs <= Date.now()
      ) {
        await db
          .update(bookingSlotsTable)
          .set({
            holdToken: input.holdToken,
            holdExpiresAtMs: Date.now() + input.holdTtlMs,
            bookingId: null,
            status: "held",
          })
          .where(eq(bookingSlotsTable.id, existing.id));
        return { ok: true, id: existing.id };
      }
      return { ok: false, reason: "taken" };
    }
    return { ok: false, reason: "db" };
  }
}

export async function confirmBookingSlot(input: {
  slotId: number;
  holdToken: string;
  bookingId: number;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(bookingSlotsTable)
    .where(eq(bookingSlotsTable.id, input.slotId))
    .limit(1);
  const slot = rows[0];
  if (!slot) return false;
  if (slot.status === "booked") return false;
  if (slot.holdToken !== input.holdToken) return false;
  await db
    .update(bookingSlotsTable)
    .set({
      status: "booked",
      bookingId: input.bookingId,
      holdToken: null,
      holdExpiresAtMs: null,
    })
    .where(eq(bookingSlotsTable.id, input.slotId));
  return true;
}

export async function cancelBookingSlot(bookingId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bookingSlotsTable)
    .set({ status: "cancelled" })
    .where(eq(bookingSlotsTable.bookingId, bookingId));
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

export async function scheduleBookingReminders(
  bookingId: number,
  slotStartMs: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  const rows: InsertBookingReminder[] = [
    { bookingId, kind: "confirmation", scheduledForMs: now },
  ];
  const at24h = slotStartMs - 24 * 3600_000;
  if (at24h > now)
    rows.push({ bookingId, kind: "reminder_24h", scheduledForMs: at24h });
  const at1h = slotStartMs - 1 * 3600_000;
  if (at1h > now)
    rows.push({ bookingId, kind: "reminder_1h", scheduledForMs: at1h });
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
