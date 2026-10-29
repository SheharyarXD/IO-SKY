/**
 * Bounded auditing of denied access attempts (task Z14, SRS 8.16 "Unauthorized
 * access attempts are denied and logged").
 *
 * The audit table is append-only and cannot be pruned, so an unbounded log of
 * refusals would be a way to fill it: one anonymous client polling a protected
 * endpoint, or an attacker hammering one, would write a row per request. This
 * keeps the guarantee that an attempt is recorded while bounding the volume:
 *
 *   - one row per (actor, endpoint) per window; the next row after the window
 *     carries how many similar attempts were not written;
 *   - a per-minute budget across all actors of the same kind (anonymous or
 *     signed in), so a distributed flood cannot grow the table without limit;
 *   - a cap on the number of keys held in memory.
 *
 * Pure: the clock is passed in, so it is testable without timers.
 */

export type DenialKind = "anonymous" | "signed_in";

export type DenialDecision = { record: boolean; suppressed: number };

export type DenialThrottleOptions = {
  windowMs: number;
  maxKeys: number;
  /** Rows allowed per minute for each kind. */
  budgetPerMinute: Record<DenialKind, number>;
};

export const DEFAULT_DENIAL_THROTTLE: DenialThrottleOptions = {
  windowMs: 10 * 60_000,
  maxKeys: 5000,
  budgetPerMinute: { anonymous: 10, signed_in: 60 },
};

export class DenialAuditThrottle {
  private readonly seen = new Map<string, { windowStart: number; suppressed: number }>();
  private readonly budget: Record<DenialKind, { bucket: number; used: number }> = {
    anonymous: { bucket: -1, used: 0 },
    signed_in: { bucket: -1, used: 0 },
  };
  /** Denials not written because the per-minute budget was exhausted (diagnostic only). */
  droppedByBudget = 0;

  constructor(private readonly opts: DenialThrottleOptions = DEFAULT_DENIAL_THROTTLE) {}

  decide(kind: DenialKind, key: string, now: number): DenialDecision {
    const fullKey = `${kind}|${key}`;
    const entry = this.seen.get(fullKey);
    if (entry && now - entry.windowStart < this.opts.windowMs) {
      entry.suppressed++;
      return { record: false, suppressed: 0 };
    }
    const minute = Math.floor(now / 60_000);
    const b = this.budget[kind];
    if (b.bucket !== minute) {
      b.bucket = minute;
      b.used = 0;
    }
    if (b.used >= this.opts.budgetPerMinute[kind]) {
      this.droppedByBudget++;
      return { record: false, suppressed: 0 };
    }
    b.used++;
    const carried = entry?.suppressed ?? 0;
    this.seen.delete(fullKey);
    this.seen.set(fullKey, { windowStart: now, suppressed: 0 });
    while (this.seen.size > this.opts.maxKeys) {
      const oldest = this.seen.keys().next().value;
      if (oldest === undefined) break;
      this.seen.delete(oldest);
    }
    return { record: true, suppressed: carried };
  }

  /** Test helper. */
  reset(): void {
    this.seen.clear();
    this.budget.anonymous = { bucket: -1, used: 0 };
    this.budget.signed_in = { bucket: -1, used: 0 };
    this.droppedByBudget = 0;
  }

  get size(): number {
    return this.seen.size;
  }
}
