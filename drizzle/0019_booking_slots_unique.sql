-- Milestone 3 §3.5 (RM-113) — enforce one row per bookable slot.
--
-- CRITICAL. `server/db/bookings.ts::tryHoldBookingSlot` implements double-
-- booking protection by inserting the slot row and catching Postgres error
-- 23505 (unique_violation), treating that as "someone else got there first":
--
--     const isDupe = (err as any)?.code === "23505";
--     if (isDupe) { ...return { ok: false, reason: "taken" } }
--
-- That constraint never existed. `booking_slots` carried only its primary key
-- on `id`, so the INSERT always succeeded, 23505 was never raised, and the
-- entire branch was unreachable. Two customers picking the same discovery-call
-- slot both received a confirmation.
--
-- Found by the RM-113 concurrency suite (server/concurrency.test.ts): ten
-- simultaneous holds on one slot produced ten winners where exactly one was
-- expected. Not theoretical — the table already contained three duplicated
-- slot groups at the time this migration was written.
--
-- Two steps, in order: existing duplicates must be resolved before a unique
-- index can be built, or the CREATE fails.

-- ---------------------------------------------------------------------------
-- 1. Resolve existing duplicates.
--
-- Keep one row per (consultationType, slotStartMs), preferring:
--   a) a row that is actually 'booked' over one merely 'held' — a confirmed
--      booking outranks an abandoned hold;
--   b) otherwise the earliest row (lowest id), i.e. whoever genuinely got
--      there first.
--
-- This deletes only losing duplicates. It cannot touch a slot that already had
-- exactly one row.
-- ---------------------------------------------------------------------------
DELETE FROM "booking_slots" bs
USING (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "consultationType", "slotStartMs"
           ORDER BY
             CASE "status" WHEN 'booked' THEN 0 WHEN 'held' THEN 1 ELSE 2 END,
             "id"
         ) AS rn
  FROM "booking_slots"
) ranked
WHERE bs."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. The constraint the application has been assuming since it was written.
--
-- (consultationType, slotStartMs) is the natural key: one slot of a given
-- consultation type at a given start time. `slotEndMs` is derived from the
-- service duration and deliberately excluded — including it would let two rows
-- share a start time with different lengths, which is the same double-booking
-- by another route.
--
-- Note this makes the takeover path (an expired hold being reclaimed) an
-- UPDATE against a uniquely-indexed row rather than a second INSERT, which is
-- what that code already does.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "booking_slots_slot_unique"
  ON "booking_slots" ("consultationType", "slotStartMs");
