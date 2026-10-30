/*
 * R21 (SRS 17.11, 19.22; 29 Oct Ch6.3, F-06): the callback task lifecycle. Pure rules,
 * the overdue escalator, the receptionist tool and the staff endpoints, all with fakes.
 * No call is made to anyone. The SQL in server/db/callbacks.ts and migration 0048
 * have not run against PostgreSQL (task M4-03).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyAction, ATTEMPT_RESULTS, CALLBACK_RULES, escalationToAnnounce, initialDueAt, isOverdue, isTerminal, normalizePhone, REFUSAL_TEXT, type Action, type CallbackState } from "../shared/callbackRules";
import { firstName, runCallbackEscalation, type OverdueRow } from "./callbackEscalation";
import { callbackTool, type CallbackToolDeps } from "./callbackTools";
import { RunLeadScope } from "./crmTools";
import { IdempotencyStore } from "./schedulingTools";
import type { ToolContext } from "./agentRuntime";

const MIN = 60_000;
const T0 = new Date("2026-10-30T10:00:00Z");
const at = (m: number) => new Date(T0.getTime() + m * MIN);
const state = (over: Partial<CallbackState> = {}): CallbackState => ({ status: "requested", assignedToUserId: null, attempts: 0, dueAt: at(120), escalationLevel: 0, ...over });
const act = (s: CallbackState, a: Action, now = T0, actor = 9) => applyAction(s, a, actor, now);

describe("due time and phone numbers", () => {
  it("normal is due in 2 hours, urgent in 30 minutes", () => {
    expect(initialDueAt("normal", T0).getTime() - T0.getTime()).toBe(120 * MIN);
    expect(initialDueAt("urgent", T0).getTime() - T0.getTime()).toBe(30 * MIN);
  });
  it("accepts dialable numbers and normalises them", () => {
    expect(normalizePhone("+31 6 1234 5678")).toBe("+31612345678");
    expect(normalizePhone("(020) 555-0142")).toBe("0205550142");
    expect(normalizePhone("0031 6 12345678")).toBe("+31612345678");
    expect(normalizePhone("  +44 20 7946 0958 ")).toBe("+442079460958");
  });
  it("refuses anything that cannot be dialled", () => {
    for (const bad of ["", "   ", "12345", "call me", "abc1234567", "+1234567890123456", null, undefined, "n/a"]) expect(normalizePhone(bad as never), String(bad)).toBeNull();
  });
});

describe("the lifecycle", () => {
  it("assigning moves requested to assigned and records who; unassigning goes back", () => {
    const a = act(state(), { type: "assign", userId: 5 });
    expect(a).toMatchObject({ ok: true, next: { status: "assigned", assignedToUserId: 5 }, event: "callback.assigned" });
    const b = act((a as { next: CallbackState }).next, { type: "assign", userId: null });
    expect(b).toMatchObject({ ok: true, next: { status: "requested", assignedToUserId: null }, event: "callback.unassigned" });
  });
  it("reassigning after an attempt keeps it 'attempted' with its attempt count", () => {
    const r = act(state({ status: "attempted", attempts: 1, assignedToUserId: 5 }), { type: "assign", userId: 6 });
    expect(r).toMatchObject({ ok: true, next: { status: "attempted", attempts: 1, assignedToUserId: 6 } });
  });
  it("a missed attempt counts, schedules the next try four hours on, and clears the escalation", () => {
    const r = act(state({ escalationLevel: 2, dueAt: at(-30) }), { type: "attempt", result: "no_answer" }, T0);
    expect(r).toMatchObject({ ok: true, next: { status: "attempted", attempts: 1, assignedToUserId: 9, escalationLevel: 0 } });
    if (r.ok) expect(r.next.dueAt.getTime()).toBe(T0.getTime() + CALLBACK_RULES.retryAfterMinutes * MIN);
  });
  it("staff may pick the next try time for a missed attempt, but not in the past", () => {
    const r = act(state(), { type: "attempt", result: "busy", newDueAt: at(45) });
    if (r.ok) expect(r.next.dueAt).toEqual(at(45));
    const past = act(state(), { type: "attempt", result: "busy", newDueAt: at(-5) });
    if (past.ok) expect(past.next.dueAt.getTime()).toBe(T0.getTime() + 240 * MIN); // ignored, default used
  });
  it("the third missed attempt ends the task as unreachable instead of leaving it open", () => {
    let s = state();
    for (let n = 1; n <= 2; n++) {
      const r = act(s, { type: "attempt", result: "no_answer" });
      if (!r.ok) throw new Error("expected ok");
      expect(r.next.status).toBe("attempted");
      s = r.next;
    }
    const last = act(s, { type: "attempt", result: "busy" });
    expect(last).toMatchObject({ ok: true, next: { status: "unreachable", attempts: 3 }, event: "callback.unreachable" });
    expect(isTerminal("unreachable")).toBe(true);
  });
  it("'call back later' means the caller was reached: it needs a future time and does not count as missed", () => {
    expect(act(state(), { type: "attempt", result: "call_back_later" })).toEqual({ ok: false, reason: "due_time_required" });
    expect(act(state(), { type: "attempt", result: "call_back_later", newDueAt: at(-1) })).toEqual({ ok: false, reason: "due_time_in_past" });
    let s = state({ attempts: 2 });
    const r = act(s, { type: "attempt", result: "call_back_later", newDueAt: at(300) });
    expect(r).toMatchObject({ ok: true, next: { status: "attempted", attempts: 2, escalationLevel: 0 } });
    if (r.ok) expect(r.next.dueAt).toEqual(at(300));
    // and two further "later" requests never make someone unreachable
    for (let k = 0; k < 5; k++) {
      const n = act(s, { type: "attempt", result: "call_back_later", newDueAt: at(300) });
      if (!n.ok) throw new Error("expected ok");
      s = n.next;
    }
    expect(s.status).toBe("attempted");
  });
  it("completing needs a note, cancelling needs a reason, and both are final", () => {
    expect(act(state(), { type: "complete", note: " " })).toEqual({ ok: false, reason: "note_required" });
    expect(act(state(), { type: "complete", note: "ab" })).toEqual({ ok: false, reason: "note_required" });
    expect(act(state(), { type: "cancel", reason: "" })).toEqual({ ok: false, reason: "reason_required" });
    const done = act(state({ assignedToUserId: 5 }), { type: "complete", note: "Spoke to them, booked a call" });
    expect(done).toMatchObject({ ok: true, next: { status: "completed", assignedToUserId: 5 }, detail: "Spoke to them, booked a call" });
    expect(act(state(), { type: "cancel", reason: "Caller phoned again" })).toMatchObject({ ok: true, next: { status: "cancelled" } });
  });
  it("a closed callback can never be changed again", () => {
    for (const status of ["completed", "unreachable", "cancelled"] as const) {
      for (const a of [{ type: "assign", userId: 5 }, { type: "attempt", result: "no_answer" }, { type: "complete", note: "later" }, { type: "cancel", reason: "later" }] as Action[]) {
        expect(act(state({ status }), a), `${status}/${a.type}`).toEqual({ ok: false, reason: "already_closed" });
      }
    }
  });
  it("every refusal has a plain message and every result type is covered", () => {
    for (const t of Object.values(REFUSAL_TEXT)) expect(t.length).toBeGreaterThan(8);
    expect([...ATTEMPT_RESULTS].sort()).toEqual(["busy", "call_back_later", "no_answer"]);
  });
});

describe("overdue and escalation levels", () => {
  const s = (over: Partial<CallbackState> = {}) => ({ status: "requested" as const, dueAt: at(0), escalationLevel: 0, ...over });
  it("is overdue from the due time, only while open", () => {
    expect(isOverdue(s(), at(-1))).toBe(false);
    expect(isOverdue(s(), at(0))).toBe(true);
    expect(isOverdue(s({ status: "completed" }), at(500))).toBe(false);
    expect(isOverdue(s({ status: "cancelled" }), at(500))).toBe(false);
  });
  it("level 1 when the due time passes, level 2 an hour later, each only once", () => {
    expect(escalationToAnnounce(s(), at(-1))).toBeNull();
    expect(escalationToAnnounce(s(), at(0))).toBe(1);
    expect(escalationToAnnounce(s(), at(59))).toBe(1);
    expect(escalationToAnnounce(s(), at(60))).toBe(2);
    expect(escalationToAnnounce(s({ escalationLevel: 1 }), at(30))).toBeNull();
    expect(escalationToAnnounce(s({ escalationLevel: 1 }), at(60))).toBe(2);
    expect(escalationToAnnounce(s({ escalationLevel: 2 }), at(9999))).toBeNull();
  });
  it("a long-overdue one found for the first time goes straight to level 2 (not a stale level 1)", () => {
    expect(escalationToAnnounce(s(), at(600))).toBe(2);
  });
  it("closed callbacks are never escalated", () => {
    for (const status of ["completed", "unreachable", "cancelled"] as const) expect(escalationToAnnounce(s({ status }), at(600)), status).toBeNull();
  });
});

describe("the escalator", () => {
  type Emit = Parameters<import("./callbackEscalation").EscalationDeps["emit"]>[0];
  function run(rows: OverdueRow[], claim: (id: number, level: 1 | 2) => boolean = () => true, now = at(0)) {
    const emitted: Emit[] = [];
    const recorded: Array<[number, number]> = [];
    const deps = {
      listOverdue: async () => rows,
      record: async (id: number, level: 1 | 2) => (recorded.push([id, level]), claim(id, level)),
      emit: async (e: Emit) => (emitted.push(e), { delivered: true as const, eventId: "x" }),
    };
    return { emitted, recorded, result: runCallbackEscalation(deps, now) };
  }
  const row = (over: Partial<OverdueRow> = {}): OverdueRow => ({ id: 1, callerName: "Priya Nair", status: "requested", dueAt: at(-10), escalationLevel: 0, priority: "normal", ...over });

  it("announces a due callback to the admin feed with the number and first name only", async () => {
    const h = run([row()]);
    expect(await h.result).toEqual({ firstNotices: 1, escalations: 0 });
    expect(h.emitted).toHaveLength(1);
    expect(h.emitted[0]).toMatchObject({ event: "DISCOVERY_CALL_FOLLOW_UP_DUE", audience: { type: "admin" }, title: "Callback due: Priya (CB-1)", dedupeRef: "callback:1:level1" });
    expect(JSON.stringify(h.emitted)).not.toMatch(/Nair|\+\d|\d{7}/);
  });
  it("escalates an hour later with a stronger event", async () => {
    const h = run([row({ dueAt: at(-70), escalationLevel: 1 })]);
    expect(await h.result).toEqual({ firstNotices: 0, escalations: 1 });
    expect(h.emitted[0]).toMatchObject({ event: "DISCOVERY_CALL_ACTION_REQUIRED", title: "Callback overdue by an hour: Priya (CB-1)", dedupeRef: "callback:1:level2" });
  });
  it("says nothing for a callback that is not due, already announced, or already claimed by another pass", async () => {
    const h = run([row({ id: 1, dueAt: at(30) }), row({ id: 2, dueAt: at(-10), escalationLevel: 1 }), row({ id: 3 })], (id) => id !== 3);
    expect(await h.result).toEqual({ firstNotices: 0, escalations: 0 });
    expect(h.emitted).toEqual([]);
    expect(h.recorded).toEqual([[3, 1]]); // only 3 was even tried, and lost the claim
  });
  it("handles several at once and an unknown caller name", async () => {
    const h = run([row({ id: 1 }), row({ id: 2, callerName: null }), row({ id: 3, callerName: "  " })]);
    await h.result;
    expect(h.emitted.map((e) => e.title)).toEqual(["Callback due: Priya (CB-1)", "Callback due: a caller (CB-2)", "Callback due: a caller (CB-3)"]);
    expect(firstName("  Jo  Smith ")).toBe("Jo");
    expect(firstName("x".repeat(100))).toHaveLength(40);
  });
});

describe("the receptionist tool", () => {
  const ctx = (subjectRef = "call:1") => ({ agentKey: "reception", subjectRef, organizationId: null, actorUserId: null }) as ToolContext;
  function setup(over: { duplicate?: boolean; createFails?: "invalid_phone" | "unavailable"; leadExists?: boolean; inScope?: boolean } = {}) {
    const created: Array<Parameters<CallbackToolDeps["create"]>[0]> = [];
    const announced: number[] = [];
    const scope = new RunLeadScope();
    if (over.inScope !== false) scope.add(ctx(), 10);
    const deps: CallbackToolDeps = {
      now: () => Date.now(),
      leadExists: async () => over.leadExists !== false,
      create: async (a) => {
        created.push(a);
        if (over.createFails) return { ok: false, reason: over.createFails };
        return { ok: true, id: 42, duplicate: over.duplicate === true, dueAt: new Date(), priority: a.priority };
      },
      announceCreated: async ({ id }) => void announced.push(id),
      idempotency: new IdempotencyStore(),
      leadScope: scope,
    };
    const tool = callbackTool(deps);
    const call = (input: Record<string, unknown>, c = ctx()) => tool.execute({ callerName: "Priya Nair", callerPhone: "+31 6 1234 5678", reason: "Wants to talk about an AI scan", requestId: `req-${Math.random().toString(36).slice(2, 12)}`, ...input }, c) as Promise<Record<string, unknown>>;
    return { tool, call, created, announced };
  }

  it("creates a callback, announces it, and tells the assistant a rough window only", async () => {
    const s = setup();
    const r = await s.call({});
    expect(r).toMatchObject({ ok: true, callbackId: 42, duplicate: false, windowMinutes: 120 });
    expect(r.instruction).toMatch(/within about 2 hours/);
    expect(r.instruction).toMatch(/Do not promise an exact time/);
    expect(s.announced).toEqual([42]);
  });
  it("urgent is a 30 minute window", async () => {
    const r = await setup().call({ urgent: true });
    expect(r).toMatchObject({ windowMinutes: 30 });
    expect(r.instruction).toMatch(/30 minutes/);
  });
  it("a repeat request joins the open callback and does not announce again", async () => {
    const s = setup({ duplicate: true });
    const r = await s.call({});
    expect(r).toMatchObject({ ok: true, duplicate: true });
    expect(r.instruction).toMatch(/already waiting/);
    expect(s.announced).toEqual([]);
  });
  it("refuses a number that cannot be dialled without creating anything", async () => {
    const s = setup();
    expect(await s.call({ callerPhone: "call me maybe" })).toMatchObject({ ok: false, code: "invalid" });
    expect(s.created).toEqual([]);
  });
  it("only attaches a lead that belongs to this conversation", async () => {
    const s = setup();
    expect(await s.call({ leadId: 10 })).toMatchObject({ ok: true });
    expect(s.created[0].leadId).toBe(10);
    expect(await s.call({ leadId: 77 })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(await s.call({ leadId: 10 }, ctx("call:2"))).toMatchObject({ ok: false, code: "not_allowed" });
    expect(s.created).toHaveLength(1);
    expect(await setup({ leadExists: false }).call({ leadId: 10 })).toMatchObject({ ok: false, code: "not_allowed" });
  });
  it("removes card numbers and credentials from the reason before storing it", async () => {
    const s = setup();
    await s.call({ reason: "Billing, my card 4111 1111 1111 1111 and the password is hunter2" });
    expect(s.created[0].reason).not.toMatch(/4111|hunter2/);
    expect(s.created[0].reason).toContain("[card number removed]");
  });
  it("does not let the assistant promise a callback when it could not be recorded", async () => {
    const r = await setup({ createFails: "unavailable" }).call({});
    expect(r).toMatchObject({ ok: false, code: "unavailable" });
    expect(String(r.message)).toMatch(/Do not promise/);
  });
  it("is idempotent per request id", async () => {
    const s = setup();
    const input = { requestId: "same-request-1" };
    const a = await s.call(input);
    const b = await s.call(input);
    expect(b).toEqual(a);
    expect(s.created).toHaveLength(1);
  });
  it("validates input strictly and declares its authority", () => {
    const t = setup().tool;
    const ok = { callerName: "Priya", callerPhone: "+31612345678", reason: "Call me", requestId: "req-12345678" };
    expect(t.inputSchema.safeParse(ok).success).toBe(true);
    for (const bad of [{ ...ok, extra: 1 }, { ...ok, callerName: "P" }, { ...ok, callerPhone: "123" }, { ...ok, reason: "" }, { ...ok, leadId: -1 }, { ...ok, requestId: "short" }, { ...ok, urgent: "yes" }]) expect(t.inputSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    expect(t).toMatchObject({ name: "request_callback", effect: "draft", requiredPermission: "callback_write", organizationScoped: false });
  });
});

// ---------------------------------------------------------------------------
// staff endpoints
// ---------------------------------------------------------------------------

const d = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  actOnCallback: vi.fn(),
  createCallback: vi.fn(),
  isStaffUser: vi.fn(),
  listCallbacks: vi.fn(async () => []),
  listCallbackEvents: vi.fn(async () => []),
}));
vi.mock("./db/callbacks", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, actOnCallback: d.actOnCallback, createCallback: d.createCallback, isStaffUser: d.isStaffUser, listCallbacks: d.listCallbacks, listCallbackEvents: d.listCallbackEvents };
});
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), appendLoginAudit: d.appendLoginAudit };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function tctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "t", email: "ops@example.com", name: "Ops", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"] = "admin") => appRouter.createCaller(tctx(role)).adminOps;

describe("staff endpoints", () => {
  beforeEach(() => vi.clearAllMocks());

  it("are staff only", async () => {
    for (const role of ["client", "developer", "technical_operator"] as const) {
      await expect(ops(role).callbacks({ openOnly: true, mine: false }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).createCallback({ callerName: "Pat", callerPhone: "+31612345678", reason: "Call back" }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).actOnCallback({ id: 1, action: { type: "complete", note: "done" } }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(d.actOnCallback).not.toHaveBeenCalled();
  });
  it("creates a manual callback and says when one was already open", async () => {
    d.createCallback.mockResolvedValueOnce({ ok: true, task: { id: 5 }, duplicate: false });
    await expect(ops().createCallback({ callerName: "Pat", callerPhone: "+31612345678", reason: "Call back", urgent: true })).resolves.toEqual({ id: 5, duplicate: false });
    expect(d.createCallback).toHaveBeenCalledWith(expect.objectContaining({ source: "manual", priority: "urgent", createdByUserId: 99 }));
    d.createCallback.mockResolvedValueOnce({ ok: true, task: { id: 5 }, duplicate: true });
    await ops().createCallback({ callerName: "Pat", callerPhone: "+31612345678", reason: "Call back" });
    expect(d.appendLoginAudit).toHaveBeenLastCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.callback.create(cb=5:already_open)") }));
    d.createCallback.mockResolvedValueOnce({ ok: false, reason: "invalid_phone" });
    await expect(ops().createCallback({ callerName: "Pat", callerPhone: "+31612345678", reason: "Call back" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("assigns only to staff", async () => {
    d.isStaffUser.mockResolvedValueOnce(false);
    await expect(ops().actOnCallback({ id: 1, action: { type: "assign", userId: 7 } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(d.actOnCallback).not.toHaveBeenCalled();
    d.isStaffUser.mockResolvedValueOnce(true);
    d.actOnCallback.mockResolvedValueOnce({ ok: true, task: { status: "assigned", attempts: 0, dueAt: new Date() } });
    await ops().actOnCallback({ id: 1, action: { type: "assign", userId: 7 } });
    expect(d.actOnCallback).toHaveBeenCalledWith(1, { type: "assign", userId: 7 }, 99);
    d.actOnCallback.mockResolvedValueOnce({ ok: true, task: { status: "requested", attempts: 0, dueAt: new Date() } });
    await ops().actOnCallback({ id: 1, action: { type: "assign", userId: null } }); // unassign needs no lookup
    expect(d.isStaffUser).toHaveBeenCalledTimes(2); // the two assignments looked the person up; the unassignment did not
  });
  it("passes a chosen retry time to the rules and audits the resulting status", async () => {
    d.actOnCallback.mockResolvedValueOnce({ ok: true, task: { status: "attempted", attempts: 1, dueAt: new Date() } });
    await ops().actOnCallback({ id: 3, action: { type: "attempt", result: "no_answer", newDueAtMs: 1_900_000_000_000 } });
    expect(d.actOnCallback).toHaveBeenCalledWith(3, { type: "attempt", result: "no_answer", newDueAt: new Date(1_900_000_000_000) }, 99);
    expect(d.appendLoginAudit).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.callback.attempt(cb=3:status=attempted)") }));
  });
  it("maps refusals and audits nothing on failure", async () => {
    d.actOnCallback.mockResolvedValueOnce({ ok: false, reason: "already_closed" });
    await expect(ops().actOnCallback({ id: 1, action: { type: "complete", note: "x" } })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: REFUSAL_TEXT.already_closed });
    d.actOnCallback.mockResolvedValueOnce({ ok: false, reason: "not_found" });
    await expect(ops().actOnCallback({ id: 1, action: { type: "cancel", reason: "x" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    d.actOnCallback.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    await expect(ops().actOnCallback({ id: 1, action: { type: "cancel", reason: "x" } })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(d.appendLoginAudit).not.toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("admin.callback.") }));
  });
  it("rejects unknown actions and bad ids before the store", async () => {
    for (const bad of [{ id: 1, action: { type: "reopen" } }, { id: 0, action: { type: "complete", note: "x" } }, { id: 1, action: { type: "attempt", result: "hung_up" } }, { id: 1, action: { type: "assign", userId: 0 } }]) await expect(ops().actOnCallback(bad as never), JSON.stringify(bad)).rejects.toThrow();
    expect(d.actOnCallback).not.toHaveBeenCalled();
  });
});
