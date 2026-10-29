/**
 * AI scheduling tools for the shared agent runtime (task S02; SRS 14.7, 19.19;
 * 29 Oct Doc 1 Ch7 and ACC-18). They are thin wrappers over the booking engine
 * (server/bookingService.ts, the same code the website uses), so an agent has
 * no looser rules than a person: a booking is a request until its slot commits,
 * a duplicate creates nothing, a reschedule moves the booking and its reminders,
 * a repeated cancel is a no-op, and nothing is emailed before confirmation.
 *
 * What the tools add:
 *   - structured results (never a thrown error) with a stable `code`;
 *   - every time given back as UTC milliseconds, ISO text and wall-clock text in
 *     the caller's own time zone, and a time zone must be a real IANA zone;
 *   - an existing booking is touched only when its reference AND the guest's
 *     email match, and a mismatch looks the same as "not found";
 *   - the three changing tools are `act` tools, so the runtime does not run them
 *     for an agent that needs approval, and each also needs the caller's explicit
 *     confirmation in the arguments (`callerConfirmed: true`);
 *   - a request id makes a retried call return the first result instead of
 *     acting twice.
 * No calendar provider is involved: availability is the platform's own.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { bookingBelongsTo, checkSlotWindow, formatInTimeZone, isValidTimeZone, SLOT_SEARCH } from "../shared/schedulingRules";
import type { AgentTool, ToolContext } from "./agentRuntime";
import type { Booking } from "../drizzle/schema";

export type SchedulingResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: "invalid" | "conflict" | "not_found" | "not_allowed" | "unavailable"; message: string };

export type SchedulingDeps = {
  now(): number;
  listSlots(a: { consultationType: string; rangeStartMs: number; rangeEndMs: number }): Promise<Array<{ startMs: number; endMs: number; available: boolean }>>;
  getBookingByPublicRef(ref: string): Promise<Booking | null>;
  createBookingRequest(input: unknown, meta: { ip: string | null; userAgent: string | null }): Promise<{ success: true; publicRef: string; emailTransport: string }>;
  rescheduleBooking(booking: Booking, newSlotStartMs: number, timezone: string): Promise<{ ok: true; unchanged: boolean; slotStartMs: number }>;
  cancelBookingById(bookingId: number, reason: string | undefined, by: "assistant"): Promise<{ ok: true; alreadyCancelled: boolean }>;
  /** Parse a create request with the website's own schema (slot bounds, phone rules, ...). */
  parseCreate(input: unknown): unknown;
  idempotency: IdempotencyStore;
};

/** Maps an engine error to a result the model can act on, without leaking internals. */
export function toResult(err: unknown): SchedulingResult {
  if (err instanceof TRPCError) {
    const code = err.code === "CONFLICT" ? "conflict" : err.code === "BAD_REQUEST" ? "invalid" : err.code === "NOT_FOUND" ? "not_found" : err.code === "PRECONDITION_FAILED" ? "not_allowed" : "unavailable";
    return { ok: false, code, message: code === "unavailable" ? "The scheduling system could not complete that. Nothing was changed that you can rely on; ask a person." : err.message };
  }
  if (err instanceof z.ZodError) return { ok: false, code: "invalid", message: err.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
  return { ok: false, code: "unavailable", message: "The scheduling system could not complete that. Ask a person." };
}

/**
 * Remembers the first successful result of a request id so a retried tool call
 * (a model that repeats itself, a timeout and retry) does not act twice. Calls
 * that are in flight share one result. Failures are not remembered, so they can
 * be retried. In memory and per server instance: a persistent key would need a
 * database column.
 */
export class IdempotencyStore {
  private readonly done = new Map<string, { at: number; value: unknown }>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  constructor(private readonly ttlMs = 10 * 60_000, private readonly max = 500) {}
  async run<T extends { ok: boolean }>(key: string, fn: () => Promise<T>, now = Date.now()): Promise<T> {
    const hit = this.done.get(key);
    if (hit && now - hit.at < this.ttlMs) return hit.value as T;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;
    const p = fn()
      .then((v) => {
        if (v.ok) {
          this.done.set(key, { at: now, value: v });
          while (this.done.size > this.max) this.done.delete(this.done.keys().next().value as string);
        }
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}

const tz = z.string().refine(isValidTimeZone, "must be a valid IANA time zone such as Europe/Amsterdam");
const consultation = z.enum(["discovery", "growth", "elite"]);
const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_.:-]+$/, "letters, digits and _ . : - only");
const confirmed = z.literal(true, { message: "the caller must explicitly confirm first; ask them, then set callerConfirmed to true" });
const publicRef = z.string().trim().min(8).max(32);
const email = z.string().trim().email().max(320);

function slotView(startMs: number, endMs: number, zone: string) {
  return { startMs, endMs, startIso: new Date(startMs).toISOString(), local: formatInTimeZone(startMs, zone), timezone: isValidTimeZone(zone) ? zone : "UTC" };
}

export function schedulingTools(deps: SchedulingDeps): AgentTool[] {
  const key = (ctx: ToolContext, tool: string, id: string) => `${ctx.agentKey}|${ctx.subjectRef}|${tool}|${id}`;
  /** Booking the caller is entitled to touch, or a result that looks like "not found". */
  const owned = async (ref: string, mail: string): Promise<Booking | SchedulingResult> => {
    const b = await deps.getBookingByPublicRef(ref);
    return bookingBelongsTo(b, mail) ? (b as Booking) : { ok: false, code: "not_found", message: "No booking matches that reference and email." };
  };
  const isResult = (x: Booking | SchedulingResult): x is SchedulingResult => "ok" in x;

  const tools: AgentTool[] = [
    {
      name: "scheduling_find_slots",
      description: "List open appointment times for a consultation type within a window of up to 14 days. Times are UTC plus the wall-clock time in the requested time zone.",
      parameters: { type: "object", properties: { consultationType: { enum: ["discovery", "growth", "elite"] }, fromMs: { type: "integer" }, toMs: { type: "integer" }, timezone: { type: "string" } }, required: ["consultationType", "fromMs", "toMs"], additionalProperties: false },
      inputSchema: z.object({ consultationType: consultation, fromMs: z.number().int(), toMs: z.number().int(), timezone: tz.optional() }).strict(),
      effect: "read",
      requiredPermission: "scheduling_read",
      organizationScoped: false,
      execute: async (raw): Promise<SchedulingResult> => {
        const i = raw as { consultationType: string; fromMs: number; toMs: number; timezone?: string };
        const w = checkSlotWindow(i.fromMs, i.toMs, deps.now());
        if (!w.ok) return { ok: false, code: "invalid", message: w.message };
        try {
          const all = await deps.listSlots({ consultationType: i.consultationType, rangeStartMs: w.fromMs, rangeEndMs: w.toMs });
          const open = all.filter((s) => s.available && s.startMs >= w.fromMs).sort((a, b) => a.startMs - b.startMs);
          return { ok: true, slots: open.slice(0, SLOT_SEARCH.maxResults).map((s) => slotView(s.startMs, s.endMs, i.timezone ?? "UTC")), truncated: open.length > SLOT_SEARCH.maxResults } as SchedulingResult<{ slots: unknown[]; truncated: boolean }>;
        } catch (err) {
          return toResult(err);
        }
      },
    },
    {
      name: "scheduling_get_booking",
      description: "Look up the state of a booking by its reference AND the guest's email. 'requested' means the slot is not yet committed; only 'confirmed' is a real appointment.",
      parameters: { type: "object", properties: { publicRef: { type: "string" }, email: { type: "string" }, timezone: { type: "string" } }, required: ["publicRef", "email"], additionalProperties: false },
      inputSchema: z.object({ publicRef, email, timezone: tz.optional() }).strict(),
      effect: "read",
      requiredPermission: "scheduling_read",
      organizationScoped: false,
      execute: async (raw): Promise<SchedulingResult> => {
        const i = raw as { publicRef: string; email: string; timezone?: string };
        try {
          const b = await owned(i.publicRef, i.email);
          if (isResult(b)) return b;
          return { ok: true, state: b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "requested" : b.status, publicRef: b.publicRef, serviceId: b.serviceId, durationMin: b.durationMin, ...slotView(b.slotStartMs, b.slotStartMs + b.durationMin * 60_000, i.timezone ?? b.timezone) } as SchedulingResult<object>;
        } catch (err) {
          return toResult(err);
        }
      },
    },
    {
      name: "scheduling_book",
      description: "Book an appointment. Only after the caller has chosen a listed time and explicitly confirmed the details. The result says whether it is confirmed; never tell the caller it is booked unless state is 'confirmed'.",
      parameters: {
        type: "object",
        properties: { consultationType: { enum: ["discovery", "growth", "elite"] }, slotStartMs: { type: "integer" }, timezone: { type: "string" }, fullName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" }, note: { type: "string" }, locale: { type: "string" }, requestId: { type: "string" }, callerConfirmed: { const: true } },
        required: ["consultationType", "slotStartMs", "timezone", "fullName", "email", "phone", "requestId", "callerConfirmed"],
        additionalProperties: false,
      },
      inputSchema: z.object({ consultationType: consultation, slotStartMs: z.number().int(), timezone: tz, fullName: z.string().trim().min(2).max(200), email, phone: z.string().trim().max(64), company: z.string().trim().max(200).optional(), note: z.string().trim().max(1000).optional(), locale: z.string().max(16).optional(), requestId, callerConfirmed: confirmed }).strict(),
      effect: "act",
      requiredPermission: "scheduling_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<SchedulingResult> => {
        const i = raw as { consultationType: string; slotStartMs: number; timezone: string; fullName: string; email: string; phone: string; company?: string; note?: string; locale?: string; requestId: string };
        return deps.idempotency.run(key(ctx, "book", i.requestId), async () => {
          try {
            const parsed = deps.parseCreate({ serviceId: i.consultationType, slotStartMs: i.slotStartMs, timezone: i.timezone, fullName: i.fullName, email: i.email, phone: i.phone, company: i.company ?? null, note: i.note ?? null, locale: i.locale ?? null });
            const r = await deps.createBookingRequest(parsed, { ip: null, userAgent: "ai-scheduling-agent" });
            const b = await deps.getBookingByPublicRef(r.publicRef);
            return { ok: true, publicRef: r.publicRef, state: b?.status === "confirmed" ? "confirmed" : b?.status === "pending" ? "requested" : "unknown", ...slotView(i.slotStartMs, i.slotStartMs + (b?.durationMin ?? 30) * 60_000, i.timezone) } as SchedulingResult<object>;
          } catch (err) {
            return toResult(err);
          }
        });
      },
    },
    {
      name: "scheduling_reschedule",
      description: "Move an existing booking to another listed time. Needs the booking reference and the guest's email, and the caller's explicit confirmation.",
      parameters: { type: "object", properties: { publicRef: { type: "string" }, email: { type: "string" }, newSlotStartMs: { type: "integer" }, timezone: { type: "string" }, requestId: { type: "string" }, callerConfirmed: { const: true } }, required: ["publicRef", "email", "newSlotStartMs", "timezone", "requestId", "callerConfirmed"], additionalProperties: false },
      inputSchema: z.object({ publicRef, email, newSlotStartMs: z.number().int(), timezone: tz, requestId, callerConfirmed: confirmed }).strict(),
      effect: "act",
      requiredPermission: "scheduling_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<SchedulingResult> => {
        const i = raw as { publicRef: string; email: string; newSlotStartMs: number; timezone: string; requestId: string };
        return deps.idempotency.run(key(ctx, "reschedule", i.requestId), async () => {
          try {
            const b = await owned(i.publicRef, i.email);
            if (isResult(b)) return b;
            const r = await deps.rescheduleBooking(b, i.newSlotStartMs, i.timezone);
            return { ok: true, unchanged: r.unchanged, ...slotView(r.slotStartMs, r.slotStartMs + b.durationMin * 60_000, i.timezone) } as SchedulingResult<object>;
          } catch (err) {
            return toResult(err);
          }
        });
      },
    },
    {
      name: "scheduling_cancel",
      description: "Cancel an existing booking. Needs the booking reference and the guest's email, and the caller's explicit confirmation. Cancelling twice changes nothing.",
      parameters: { type: "object", properties: { publicRef: { type: "string" }, email: { type: "string" }, reason: { type: "string" }, requestId: { type: "string" }, callerConfirmed: { const: true } }, required: ["publicRef", "email", "requestId", "callerConfirmed"], additionalProperties: false },
      inputSchema: z.object({ publicRef, email, reason: z.string().trim().max(500).optional(), requestId, callerConfirmed: confirmed }).strict(),
      effect: "act",
      requiredPermission: "scheduling_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<SchedulingResult> => {
        const i = raw as { publicRef: string; email: string; reason?: string; requestId: string };
        return deps.idempotency.run(key(ctx, "cancel", i.requestId), async () => {
          try {
            const b = await owned(i.publicRef, i.email);
            if (isResult(b)) return b;
            const r = await deps.cancelBookingById(b.id, i.reason, "assistant");
            return { ok: true, state: "cancelled", alreadyCancelled: r.alreadyCancelled, publicRef: b.publicRef } as SchedulingResult<object>;
          } catch (err) {
            return toResult(err);
          }
        });
      },
    },
  ];
  return tools;
}

/** The tools wired to the real booking engine. Import lazily so tests need no database. */
export async function realSchedulingTools(): Promise<AgentTool[]> {
  const [svc, booking, db] = await Promise.all([import("./bookingService"), import("./_core/booking"), import("./db")]);
  return schedulingTools({
    now: () => Date.now(),
    listSlots: (a) => booking.getBookingAdapter().listAvailableSlots(a),
    getBookingByPublicRef: db.getBookingByPublicRef,
    createBookingRequest: (input, meta) => svc.createBookingRequest(input as never, meta),
    rescheduleBooking: svc.rescheduleBooking,
    cancelBookingById: svc.cancelBookingById,
    parseCreate: (input) => svc.createInputSchema.parse(input),
    idempotency: new IdempotencyStore(),
  });
}
