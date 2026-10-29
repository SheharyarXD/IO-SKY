/*
 * P0-06 data layer: slot takeover, conditional confirm, and reminder planning.
 *
 * The query builder is replaced by a fluent fake, so this proves the LOGIC
 * (what is attempted, and what a lost race returns). It does not prove the SQL
 * against PostgreSQL: that needs the DATABASE_URL gated suite on an isolated
 * database and is recorded as pending in MILESTONE4_TEST_RESULTS.md.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/connection", () => ({ getDb: m.getDb }));

import { confirmBookingSlot, planBookingReminders, tryHoldBookingSlot } from "./db/bookings";

type Plan = {
  insertThrows?: unknown;
  /** Rows returned by every select(). */
  selectRows?: unknown[];
  /** Rows returned by update().returning(), per call in order. */
  updateReturning?: unknown[][];
};

function fakeDb(plan: Plan) {
  const calls = { updates: 0, inserts: 0 };
  const updates = [...(plan.updateReturning ?? [])];
  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    limit: async () => plan.selectRows ?? [],
    then: undefined,
  };
  return {
    calls,
    db: {
      insert: () => ({
        values: async () => {
          calls.inserts++;
          if (plan.insertThrows) throw plan.insertThrows;
        },
      }),
      select: () => selectChain,
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              calls.updates++;
              return updates.shift() ?? [];
            },
          }),
        }),
      }),
    },
  };
}

const unique = { code: "23505" };
const hold = { consultationType: "discovery", slotStartMs: 1_000, slotEndMs: 2_000, holdToken: "tok", holdTtlMs: 600_000 };

beforeEach(() => vi.clearAllMocks());

describe("tryHoldBookingSlot takeover", () => {
  it("takes over a slot that was cancelled or rescheduled away", async () => {
    const f = fakeDb({ insertThrows: unique, selectRows: [{ id: 7, status: "cancelled", holdExpiresAtMs: null }], updateReturning: [[{ id: 7 }]] });
    m.getDb.mockResolvedValue(f.db);
    expect(await tryHoldBookingSlot(hold)).toEqual({ ok: true, id: 7 });
    expect(f.calls.updates).toBe(1);
  });

  it("takes over a hold that has expired", async () => {
    const f = fakeDb({ insertThrows: unique, selectRows: [{ id: 8, status: "held", holdExpiresAtMs: Date.now() - 1000 }], updateReturning: [[{ id: 8 }]] });
    m.getDb.mockResolvedValue(f.db);
    expect(await tryHoldBookingSlot(hold)).toEqual({ ok: true, id: 8 });
  });

  it("loses the race when another caller took the row first (conditional update matches nothing)", async () => {
    const f = fakeDb({ insertThrows: unique, selectRows: [{ id: 7, status: "cancelled", holdExpiresAtMs: null }], updateReturning: [[]] });
    m.getDb.mockResolvedValue(f.db);
    expect(await tryHoldBookingSlot(hold)).toEqual({ ok: false, reason: "taken" });
  });

  it("never takes over a booked slot or a live hold, and does not even try", async () => {
    for (const row of [
      { id: 1, status: "booked", holdExpiresAtMs: null },
      { id: 2, status: "held", holdExpiresAtMs: Date.now() + 300_000 },
    ]) {
      const f = fakeDb({ insertThrows: unique, selectRows: [row], updateReturning: [[{ id: row.id }]] });
      m.getDb.mockResolvedValue(f.db);
      expect(await tryHoldBookingSlot(hold)).toEqual({ ok: false, reason: "taken" });
      expect(f.calls.updates).toBe(0);
    }
  });

  it("reports a database problem as db, not as taken", async () => {
    const f = fakeDb({ insertThrows: new Error("connection reset") });
    m.getDb.mockResolvedValue(f.db);
    expect(await tryHoldBookingSlot(hold)).toEqual({ ok: false, reason: "db" });
    m.getDb.mockResolvedValue(null);
    expect(await tryHoldBookingSlot(hold)).toEqual({ ok: false, reason: "db" });
  });
});

describe("confirmBookingSlot is one conditional update", () => {
  it("succeeds only when the hold still matched", async () => {
    m.getDb.mockResolvedValue(fakeDb({ updateReturning: [[{ id: 3 }]] }).db);
    expect(await confirmBookingSlot({ slotId: 3, holdToken: "tok", bookingId: 9 })).toBe(true);
  });
  it("fails when the slot was already booked, the token differs or the hold was taken over", async () => {
    m.getDb.mockResolvedValue(fakeDb({ updateReturning: [[]] }).db);
    expect(await confirmBookingSlot({ slotId: 3, holdToken: "stale", bookingId: 9 })).toBe(false);
  });
  it("fails without a database", async () => {
    m.getDb.mockResolvedValue(null);
    expect(await confirmBookingSlot({ slotId: 3, holdToken: "tok", bookingId: 9 })).toBe(false);
  });
});

describe("planBookingReminders", () => {
  const now = 1_000_000_000_000;
  const H = 3600_000;
  it("plans a confirmation, 24h and 1h reminder for a booking more than a day away", () => {
    const rows = planBookingReminders(5, now + 3 * 24 * H, now, { withConfirmation: true });
    expect(rows.map((r) => r.kind)).toEqual(["confirmation", "reminder_24h", "reminder_1h"]);
    expect(rows[1].scheduledForMs).toBe(now + 2 * 24 * H);
  });
  it("does not backfill offsets that are already in the past", () => {
    expect(planBookingReminders(5, now + 5 * H, now, { withConfirmation: false }).map((r) => r.kind)).toEqual(["reminder_1h"]);
    expect(planBookingReminders(5, now + 30 * 60_000, now, { withConfirmation: false })).toEqual([]);
  });
  it("omits the confirmation for a reschedule, which sends its own", () => {
    expect(planBookingReminders(5, now + 3 * 24 * H, now, { withConfirmation: false }).map((r) => r.kind)).toEqual(["reminder_24h", "reminder_1h"]);
  });
});
