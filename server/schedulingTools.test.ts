/*
 * S02 (SRS 14.7, 19.19; 29 Oct Doc 1 Ch7, ACC-18): the AI scheduling tools.
 * The booking engine itself is covered by bookings.*.test.ts; these tests cover
 * what the tools add around it, using the website's real input schema so a
 * payload the tools build is one the engine accepts. No database, no email.
 */
import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { bookingBelongsTo, checkSlotWindow, formatInTimeZone, isValidTimeZone } from "../shared/schedulingRules";
import { IdempotencyStore, schedulingTools, toResult, type SchedulingDeps } from "./schedulingTools";
import { createInputSchema } from "./bookingService";
import { runAgent, ToolRegistry, type AgentDefinition, type AgentModel, type ModelTurn, type RuntimeDeps, type ToolContext } from "./agentRuntime";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe("time zones", () => {
  it("accepts real IANA zones and rejects everything else", () => {
    for (const ok of ["Europe/Amsterdam", "UTC", "America/New_York", "Asia/Karachi"]) expect(isValidTimeZone(ok), ok).toBe(true);
    for (const bad of ["", "x", "Mars/Olympus", "Europe/Amsterdam; DROP", "GMT+99", " ", "a".repeat(70)]) expect(isValidTimeZone(bad), bad).toBe(false);
  });

  it("shows a time in the caller's own zone, across the daylight saving change", () => {
    expect(formatInTimeZone(Date.parse("2026-11-05T13:30:00Z"), "Europe/Amsterdam")).toBe("2026-11-05 14:30"); // winter, UTC+1
    expect(formatInTimeZone(Date.parse("2026-07-01T12:00:00Z"), "Europe/Amsterdam")).toBe("2026-07-01 14:00"); // summer, UTC+2
    expect(formatInTimeZone(Date.parse("2026-11-05T13:30:00Z"), "America/New_York")).toBe("2026-11-05 08:30");
    expect(formatInTimeZone(Date.parse("2026-11-05T13:30:00Z"), "Not/AZone")).toBe("2026-11-05 13:30"); // falls back to UTC, never throws
    expect(formatInTimeZone(Date.parse("2026-11-05T23:30:00Z"), "Asia/Karachi")).toBe("2026-11-06 04:30"); // crosses midnight
  });
});

describe("checkSlotWindow", () => {
  const now = 1_800_000_000_000;
  it("accepts a normal window and raises the start to the minimum lead time", () => {
    const r = checkSlotWindow(now, now + 3 * DAY, now);
    expect(r).toEqual({ ok: true, fromMs: now + 30 * 60_000, toMs: now + 3 * DAY });
  });
  it("rejects reversed, oversized, past and non-finite windows", () => {
    for (const [a, b] of [[now + DAY, now], [now, now + 15 * DAY], [now - 2 * DAY, now - DAY], [NaN, now + DAY], [now, Infinity]]) {
      expect(checkSlotWindow(a, b, now).ok, `${a} ${b}`).toBe(false);
    }
  });
});

describe("bookingBelongsTo", () => {
  it("matches the email case-insensitively and never matches blanks", () => {
    expect(bookingBelongsTo({ email: "Gina@Example.com" }, " gina@example.COM ")).toBe(true);
    expect(bookingBelongsTo({ email: "gina@example.com" }, "mallory@example.com")).toBe(false);
    expect(bookingBelongsTo({ email: "" }, "")).toBe(false);
    expect(bookingBelongsTo(null, "a@b.co")).toBe(false);
  });
});

describe("toResult", () => {
  it("maps engine errors to stable codes and hides unexpected ones", () => {
    expect(toResult(new TRPCError({ code: "CONFLICT", message: "taken" }))).toEqual({ ok: false, code: "conflict", message: "taken" });
    expect(toResult(new TRPCError({ code: "BAD_REQUEST", message: "bad" }))).toMatchObject({ code: "invalid" });
    expect(toResult(new TRPCError({ code: "NOT_FOUND", message: "nf" }))).toMatchObject({ code: "not_found" });
    expect(toResult(new TRPCError({ code: "PRECONDITION_FAILED", message: "past" }))).toMatchObject({ code: "not_allowed", message: "past" });
    const hidden = toResult(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "relation bookings does not exist at 10.0.0.9" }));
    expect(hidden).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(hidden)).not.toContain("10.0.0.9");
    expect(JSON.stringify(toResult(new Error("secret internals")))).not.toContain("secret");
  });
});

describe("IdempotencyStore", () => {
  it("returns the first success for a repeated key, shares in-flight calls, but does not remember failures", async () => {
    const s = new IdempotencyStore();
    const fn = vi.fn(async () => ({ ok: true as const, n: Math.random() }));
    const [a, b] = await Promise.all([s.run("k", fn), s.run("k", fn)]);
    const c = await s.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(c).toBe(a);

    const bad = vi.fn(async () => ({ ok: false as const }));
    await s.run("f", bad);
    await s.run("f", bad);
    expect(bad).toHaveBeenCalledTimes(2);
  });
  it("forgets after the time limit and caps its size", async () => {
    const s = new IdempotencyStore(1000, 3);
    const fn = vi.fn(async () => ({ ok: true as const }));
    await s.run("a", fn, 0);
    await s.run("a", fn, 500);
    expect(fn).toHaveBeenCalledTimes(1);
    await s.run("a", fn, 2000);
    expect(fn).toHaveBeenCalledTimes(2);
    for (const k of ["b", "c", "d", "e"]) await s.run(k, fn, 3000);
    const before = fn.mock.calls.length;
    await s.run("a", fn, 3001); // evicted by the size cap, so it runs again
    expect(fn.mock.calls.length).toBe(before + 1);
  });
});

// ---------------------------------------------------------------------------
// tools
// ---------------------------------------------------------------------------

type B = { id: number; publicRef: string; email: string; status: string; slotStartMs: number; durationMin: number; timezone: string; serviceId: string; fullName: string; phone: string };
const REF = "IOSKY-AAAA-BBBB";

function fakeEngine(over: Partial<SchedulingDeps> = {}) {
  const bookings = new Map<string, B>([[REF, { id: 1, publicRef: REF, email: "gina@example.com", status: "confirmed", slotStartMs: Date.now() + 5 * DAY, durationMin: 30, timezone: "Europe/Amsterdam", serviceId: "discovery", fullName: "Gina Guest", phone: "+31612345678" }]]);
  const calls = { create: [] as unknown[], reschedule: [] as unknown[], cancel: [] as unknown[] };
  const deps: SchedulingDeps = {
    now: () => Date.now(),
    listSlots: vi.fn(async ({ rangeStartMs }) => Array.from({ length: 30 }, (_, i) => ({ startMs: rangeStartMs + i * HOUR, endMs: rangeStartMs + i * HOUR + 30 * 60_000, available: i % 5 !== 0 }))),
    getBookingByPublicRef: vi.fn(async (ref) => (bookings.get(ref) as never) ?? null),
    createBookingRequest: vi.fn(async (input) => {
      calls.create.push(input);
      const i = input as { slotStartMs: number; email: string; serviceId: string; timezone: string };
      const b: B = { id: 2, publicRef: "IOSKY-NEW1-NEW1", email: i.email, status: "confirmed", slotStartMs: i.slotStartMs, durationMin: 30, timezone: i.timezone, serviceId: i.serviceId, fullName: "x", phone: "y" };
      bookings.set(b.publicRef, b);
      return { success: true as const, publicRef: b.publicRef, emailTransport: "console" };
    }),
    rescheduleBooking: vi.fn(async (_b, newSlotStartMs) => (calls.reschedule.push(newSlotStartMs), { ok: true as const, unchanged: false, slotStartMs: newSlotStartMs })),
    cancelBookingById: vi.fn(async (id, reason) => (calls.cancel.push({ id, reason }), { ok: true as const, alreadyCancelled: calls.cancel.length > 1 })),
    parseCreate: (input) => createInputSchema.parse(input),
    idempotency: new IdempotencyStore(),
    ...over,
  };
  return { deps, calls, bookings };
}

const ctx: ToolContext = { organizationId: null, actorUserId: null, agentKey: "scheduler", subjectRef: "call:1" };
const tool = (deps: SchedulingDeps, name: string) => schedulingTools(deps).find((t) => t.name === name)!;
const exec = (deps: SchedulingDeps, name: string, args: unknown, c: ToolContext = ctx) => {
  const t = tool(deps, name);
  const parsed = t.inputSchema.safeParse(args);
  return parsed.success ? (t.execute(parsed.data, c) as Promise<Record<string, unknown>>) : Promise.resolve({ schemaError: parsed.error.issues.map((i) => i.message).join("; ") });
};
const T = () => Date.now() + 6 * DAY;
const bookArgs = (over: Record<string, unknown> = {}) => ({ consultationType: "discovery", slotStartMs: T(), timezone: "Europe/Amsterdam", fullName: "Gina Guest", email: "gina@example.com", phone: "+31 6 12345678", requestId: "req-00000001", callerConfirmed: true, ...over });

describe("scheduling_find_slots", () => {
  const args = (over: Record<string, unknown> = {}) => ({ consultationType: "discovery", fromMs: Date.now() + DAY, toMs: Date.now() + 3 * DAY, ...over });
  it("returns open times only, sorted, with UTC and the caller's local wall-clock time", async () => {
    const e = fakeEngine();
    const r = (await exec(e.deps, "scheduling_find_slots", args({ timezone: "America/New_York" }))) as { ok: boolean; slots: Array<{ startMs: number; startIso: string; local: string; timezone: string }>; truncated: boolean };
    expect(r.ok).toBe(true);
    expect(r.slots.length).toBe(20);
    expect(r.truncated).toBe(true);
    expect(r.slots.every((s, i) => i === 0 || s.startMs > r.slots[i - 1].startMs)).toBe(true);
    expect(r.slots[0].timezone).toBe("America/New_York");
    expect(r.slots[0].startIso).toBe(new Date(r.slots[0].startMs).toISOString());
    expect(r.slots[0].local).toBe(formatInTimeZone(r.slots[0].startMs, "America/New_York"));
  });
  it("rejects a bad window or time zone before asking the engine", async () => {
    const e = fakeEngine();
    expect(await exec(e.deps, "scheduling_find_slots", args({ toMs: Date.now() + 30 * DAY }))).toMatchObject({ ok: false, code: "invalid" });
    expect(await exec(e.deps, "scheduling_find_slots", args({ fromMs: Date.now() + 2 * DAY, toMs: Date.now() + DAY }))).toMatchObject({ ok: false, code: "invalid" });
    expect(await exec(e.deps, "scheduling_find_slots", args({ timezone: "Mars/Olympus" }))).toHaveProperty("schemaError");
    expect(await exec(e.deps, "scheduling_find_slots", args({ consultationType: "free_money" }))).toHaveProperty("schemaError");
    expect(e.deps.listSlots).not.toHaveBeenCalled();
  });
  it("an engine failure is a generic unavailable result", async () => {
    const e = fakeEngine({ listSlots: async () => { throw new Error("connection refused 10.1.1.1"); } });
    const r = await exec(e.deps, "scheduling_find_slots", args());
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    expect(JSON.stringify(r)).not.toContain("10.1.1.1");
  });
});

describe("scheduling_get_booking", () => {
  it("shows the state and time for the right reference and email, and no personal data", async () => {
    const e = fakeEngine();
    const r = await exec(e.deps, "scheduling_get_booking", { publicRef: REF, email: "GINA@example.com", timezone: "Asia/Karachi" });
    expect(r).toMatchObject({ ok: true, state: "confirmed", publicRef: REF, timezone: "Asia/Karachi" });
    expect(JSON.stringify(r)).not.toMatch(/gina|\+31|Guest/i);
  });
  it("maps a pending booking to 'requested', which is not a confirmed appointment", async () => {
    const e = fakeEngine();
    e.bookings.get(REF)!.status = "pending";
    expect(await exec(e.deps, "scheduling_get_booking", { publicRef: REF, email: "gina@example.com" })).toMatchObject({ ok: true, state: "requested" });
  });
  it("a wrong email and an unknown reference look exactly the same", async () => {
    const e = fakeEngine();
    const wrong = await exec(e.deps, "scheduling_get_booking", { publicRef: REF, email: "mallory@example.com" });
    const missing = await exec(e.deps, "scheduling_get_booking", { publicRef: "IOSKY-ZZZZ-ZZZZ", email: "gina@example.com" });
    expect(wrong).toEqual(missing);
    expect(wrong).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("scheduling_book", () => {
  it("needs the caller's explicit confirmation, a real time zone, a request id and no unknown fields", async () => {
    const e = fakeEngine();
    for (const bad of [bookArgs({ callerConfirmed: false }), (({ callerConfirmed: _c, ...rest }) => rest)(bookArgs()), bookArgs({ timezone: "Nowhere/Land" }), bookArgs({ requestId: "short" }), bookArgs({ extra: 1 }), bookArgs({ email: "not-an-email" })]) {
      expect(await exec(e.deps, "scheduling_book", bad)).toHaveProperty("schemaError");
    }
    expect(e.deps.createBookingRequest).not.toHaveBeenCalled();
  });

  it("books through the engine with a payload the website's own schema accepts, and reports the real state", async () => {
    const e = fakeEngine();
    const r = await exec(e.deps, "scheduling_book", bookArgs());
    expect(r).toMatchObject({ ok: true, publicRef: "IOSKY-NEW1-NEW1", state: "confirmed", timezone: "Europe/Amsterdam" });
    expect(e.calls.create[0]).toMatchObject({ serviceId: "discovery", email: "gina@example.com", timezone: "Europe/Amsterdam" });
    expect(e.deps.createBookingRequest).toHaveBeenCalledWith(expect.anything(), { ip: null, userAgent: "ai-scheduling-agent" });
  });

  it("never reports a booking as confirmed when the engine says it is only requested", async () => {
    const e = fakeEngine();
    (e.deps.createBookingRequest as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      e.bookings.set("IOSKY-PEND-PEND", { ...e.bookings.get(REF)!, publicRef: "IOSKY-PEND-PEND", status: "pending" });
      return { success: true, publicRef: "IOSKY-PEND-PEND", emailTransport: "console" };
    });
    expect(await exec(e.deps, "scheduling_book", bookArgs())).toMatchObject({ ok: true, state: "requested" });
  });

  it("a taken slot, an invalid phone and an engine failure come back as structured results", async () => {
    const conflict = fakeEngine({ createBookingRequest: async () => { throw new TRPCError({ code: "CONFLICT", message: "This slot was just taken. Please pick another time." }); } });
    expect(await exec(conflict.deps, "scheduling_book", bookArgs())).toMatchObject({ ok: false, code: "conflict" });
    const e = fakeEngine();
    expect(await exec(e.deps, "scheduling_book", bookArgs({ phone: "n/a" }))).toMatchObject({ ok: false, code: "invalid" });
    expect(e.deps.createBookingRequest).not.toHaveBeenCalled();
    const down = fakeEngine({ createBookingRequest: async () => { throw new Error("pool exhausted"); } });
    expect(await exec(down.deps, "scheduling_book", bookArgs())).toMatchObject({ ok: false, code: "unavailable" });
  });

  it("a repeated or simultaneous call with the same request id books once; a new id books again; a failure can be retried", async () => {
    const e = fakeEngine();
    const args = bookArgs();
    const [a, b] = await Promise.all([exec(e.deps, "scheduling_book", args), exec(e.deps, "scheduling_book", args)]);
    const c = await exec(e.deps, "scheduling_book", args);
    expect(e.calls.create).toHaveLength(1);
    expect(a).toEqual(b);
    expect(c).toEqual(a);
    await exec(e.deps, "scheduling_book", bookArgs({ requestId: "req-00000002" }));
    expect(e.calls.create).toHaveLength(2);

    let n = 0;
    const flaky = fakeEngine({ createBookingRequest: vi.fn(async (input) => { if (n++ === 0) throw new TRPCError({ code: "CONFLICT", message: "taken" }); return { success: true as const, publicRef: "IOSKY-NEW1-NEW1", emailTransport: "console" }; }) });
    flaky.bookings.set("IOSKY-NEW1-NEW1", { ...flaky.bookings.get(REF)!, publicRef: "IOSKY-NEW1-NEW1" });
    expect(await exec(flaky.deps, "scheduling_book", bookArgs({ requestId: "req-retry-001" }))).toMatchObject({ ok: false, code: "conflict" });
    expect(await exec(flaky.deps, "scheduling_book", bookArgs({ requestId: "req-retry-001" }))).toMatchObject({ ok: true });
  });

  it("the same request id from a different conversation is a different request", async () => {
    const e = fakeEngine();
    await exec(e.deps, "scheduling_book", bookArgs(), { ...ctx, subjectRef: "call:1" });
    await exec(e.deps, "scheduling_book", bookArgs(), { ...ctx, subjectRef: "call:2" });
    expect(e.calls.create).toHaveLength(2);
  });
});

describe("scheduling_reschedule and scheduling_cancel", () => {
  const resArgs = (over: Record<string, unknown> = {}) => ({ publicRef: REF, email: "gina@example.com", newSlotStartMs: T(), timezone: "Europe/Amsterdam", requestId: "req-00000010", callerConfirmed: true, ...over });
  const canArgs = (over: Record<string, unknown> = {}) => ({ publicRef: REF, email: "gina@example.com", reason: "clash", requestId: "req-00000020", callerConfirmed: true, ...over });

  it("act only on the booking the caller owns; otherwise the engine is never touched and the answer is 'not found'", async () => {
    const e = fakeEngine();
    expect(await exec(e.deps, "scheduling_reschedule", resArgs({ email: "mallory@example.com" }))).toMatchObject({ ok: false, code: "not_found" });
    expect(await exec(e.deps, "scheduling_cancel", canArgs({ email: "mallory@example.com", requestId: "req-00000021" }))).toMatchObject({ ok: false, code: "not_found" });
    expect(await exec(e.deps, "scheduling_cancel", canArgs({ publicRef: "IOSKY-ZZZZ-ZZZZ", requestId: "req-00000022" }))).toMatchObject({ ok: false, code: "not_found" });
    expect(e.deps.rescheduleBooking).not.toHaveBeenCalled();
    expect(e.deps.cancelBookingById).not.toHaveBeenCalled();
  });

  it("reschedule moves the booking and answers in the caller's time zone", async () => {
    const e = fakeEngine();
    const when = T();
    const r = await exec(e.deps, "scheduling_reschedule", resArgs({ newSlotStartMs: when, timezone: "Asia/Karachi" }));
    expect(r).toMatchObject({ ok: true, unchanged: false, startMs: when, timezone: "Asia/Karachi", local: formatInTimeZone(when, "Asia/Karachi") });
    expect(e.calls.reschedule).toEqual([when]);
  });

  it("an engine refusal (a cancelled or past booking) is reported as not_allowed, and a taken slot as conflict", async () => {
    const past = fakeEngine({ rescheduleBooking: async () => { throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This booking can no longer be rescheduled." }); } });
    expect(await exec(past.deps, "scheduling_reschedule", resArgs())).toMatchObject({ ok: false, code: "not_allowed" });
    const taken = fakeEngine({ rescheduleBooking: async () => { throw new TRPCError({ code: "CONFLICT", message: "This slot was just taken. Please pick another." }); } });
    expect(await exec(taken.deps, "scheduling_reschedule", resArgs())).toMatchObject({ ok: false, code: "conflict" });
  });

  it("cancel goes through the engine as the assistant; a repeat with the same id does nothing more; a second request reports it was already cancelled", async () => {
    const e = fakeEngine();
    expect(await exec(e.deps, "scheduling_cancel", canArgs())).toMatchObject({ ok: true, state: "cancelled", alreadyCancelled: false });
    await exec(e.deps, "scheduling_cancel", canArgs());
    expect(e.calls.cancel).toHaveLength(1);
    expect(e.deps.cancelBookingById).toHaveBeenCalledWith(1, "clash", "assistant");
    expect(await exec(e.deps, "scheduling_cancel", canArgs({ requestId: "req-00000023" }))).toMatchObject({ ok: true, alreadyCancelled: true });
  });

  it("both need the caller's explicit confirmation", async () => {
    const e = fakeEngine();
    expect(await exec(e.deps, "scheduling_reschedule", resArgs({ callerConfirmed: false }))).toHaveProperty("schemaError");
    expect(await exec(e.deps, "scheduling_cancel", canArgs({ callerConfirmed: undefined }))).toHaveProperty("schemaError");
  });
});

// ---------------------------------------------------------------------------
// in the shared runtime
// ---------------------------------------------------------------------------

describe("scheduling tools in the shared runtime", () => {
  function runTool(agent: Partial<AgentDefinition>, name: string, args: unknown) {
    const e = fakeEngine();
    const reg = new ToolRegistry();
    for (const t of schedulingTools(e.deps)) reg.register(t);
    const turns: ModelTurn[] = [{ kind: "tool_calls", calls: [{ id: "c1", name, arguments: JSON.stringify(args) }] }, { kind: "final", content: "done" }];
    let i = 0;
    const model: AgentModel = { complete: async () => turns[Math.min(i++, 1)] };
    const def: AgentDefinition = { key: "scheduler", status: "active", permissions: ["scheduling_read", "scheduling_write", "converse"], requiresHumanApproval: true, tools: reg.names(), knowledgeSources: [], maxAuthority: "act_with_approval", escalationRules: "Hand over to the sales lead", ...agent };
    const escalations: string[] = [];
    const deps: RuntimeDeps = { loadAgent: async () => def, authorise: async (a) => (def.permissions.includes(a.action) ? { outcome: "completed" } : { outcome: "blocked_by_permission", reason: "action_not_permitted" }), record: async () => 1, escalate: async (x) => void escalations.push(x.kind), actorGrants: async () => [], model, tools: reg };
    return { e, escalations, run: () => runAgent({ agentKey: "scheduler", subjectRef: "call:1", runPermission: "converse", system: "s", userMessage: "u", ctx: { organizationId: null, actorUserId: null } }, deps) };
  }

  it("an agent that needs approval does NOT book: the run ends awaiting a human decision", async () => {
    const h = runTool({}, "scheduling_book", bookArgs());
    const r = await h.run();
    expect(r).toMatchObject({ status: "awaiting_approval", pending: { tool: "scheduling_book" } });
    expect(h.e.deps.createBookingRequest).not.toHaveBeenCalled();
    expect(h.escalations).toEqual(["approval_needed"]);
  });

  it("an autonomous agent without an approval requirement books, and the booking is a real engine call", async () => {
    const h = runTool({ maxAuthority: "act_autonomously", requiresHumanApproval: false }, "scheduling_book", bookArgs());
    expect((await h.run()).status).toBe("completed");
    expect(h.e.calls.create).toHaveLength(1);
  });

  it("an agent without the scheduling_write permission, or with only draft authority, cannot change a booking", async () => {
    for (const agent of [{ permissions: ["scheduling_read", "converse"], maxAuthority: "act_autonomously", requiresHumanApproval: false }, { maxAuthority: "draft_only" }]) {
      const h = runTool(agent, "scheduling_cancel", { publicRef: REF, email: "gina@example.com", requestId: "req-00000030", callerConfirmed: true });
      const r = await h.run();
      expect(r.status === "completed" && r.toolCalls[0].outcome).toBe("refused");
      expect(h.e.deps.cancelBookingById).not.toHaveBeenCalled();
    }
  });

  it("a read-only agent can still look up availability and bookings", async () => {
    const h = runTool({ maxAuthority: "read_only", permissions: ["scheduling_read", "converse"] }, "scheduling_get_booking", { publicRef: REF, email: "gina@example.com" });
    const r = await h.run();
    expect(r.status === "completed" && r.toolCalls[0].outcome).toBe("executed");
  });

  it("the model cannot skip the confirmation: unconfirmed arguments are refused by the schema", async () => {
    const h = runTool({ maxAuthority: "act_autonomously", requiresHumanApproval: false }, "scheduling_book", bookArgs({ callerConfirmed: false }));
    const r = await h.run();
    expect(r.status === "completed" && r.toolCalls[0]).toMatchObject({ outcome: "refused", reason: expect.stringContaining("explicitly confirm") });
    expect(h.e.deps.createBookingRequest).not.toHaveBeenCalled();
  });
});
