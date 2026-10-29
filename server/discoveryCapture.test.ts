/*
 * R19 (SRS 14.7; 29 Oct Doc 1 Ch6.1): discovery qualification capture, persisted to
 * the CRM record and the appointment. In-memory fakes only; no database, no
 * voice, no provider.
 */
import { describe, expect, it } from "vitest";
import {
  applyQualificationBlock,
  assessQualification,
  BLOCK_END,
  BLOCK_START,
  composeQualificationBlock,
  mergeQualification,
  NOTE_MAX,
  parseQualificationBlock,
  sanitizeQualification,
  sanitizeValue,
  scrubSensitive,
} from "../shared/discoveryQualification";
import { discoveryCaptureTool, type CaptureDeps, type CaptureResult } from "./discoveryCapture";
import { RunLeadScope } from "./crmTools";
import { IdempotencyStore } from "./schedulingTools";
import type { ToolContext } from "./agentRuntime";

describe("scrubbing what a caller must not leave behind", () => {
  it("removes real card numbers in any grouping, and keeps ordinary numbers", () => {
    for (const card of ["4111111111111111", "4111 1111 1111 1111", "4111-1111-1111-1111", "5500 0000 0000 0004", "378282246310005"]) {
      const r = scrubSensitive(`My card is ${card} and it expires soon`);
      expect(r.text, card).not.toMatch(/\d{4}/);
      expect(r.redactions).toContain("card_number");
    }
    // 16 digits that fail the Luhn check are not card numbers; phone numbers and years stay.
    expect(scrubSensitive("Order 1234567890123456 shipped").redactions).toEqual([]);
    expect(scrubSensitive("Call me on +31 6 12345678 in 2026").text).toContain("+31 6 12345678");
    expect(scrubSensitive("We have 250 staff and 12000 customers").redactions).toEqual([]);
  });
  it("removes passwords, PINs and one-time codes said aloud", () => {
    for (const s of ["the password is hunter2", "my PIN: 4821", "cvv 123", "passcode = abc123", "one-time code is 889900"]) {
      const r = scrubSensitive(`Context: ${s} thanks`);
      expect(r.redactions, s).toContain("credential");
      expect(r.text, s).not.toMatch(/hunter2|4821|\b123\b|abc123|889900/);
    }
    expect(scrubSensitive("we use a pin on the map").redactions).toEqual([]);
  });
  it("sanitizeValue strips control characters, collapses space, caps length and drops empty", () => {
    expect(sanitizeValue("businessChallenge", "  slow\u0000  reporting\n\n  process ").value).toBe("slow reporting process");
    expect(sanitizeValue("schedulingPreference", "x".repeat(900)).value).toHaveLength(300);
    expect(sanitizeValue("constraints", "   ").value).toBeUndefined();
    expect(sanitizeValue("constraints", 42 as never).value).toBeUndefined();
    expect(sanitizeValue("constraints", "a").value).toBeUndefined();
  });
  it("sanitizeQualification ignores fields it does not know", () => {
    const r = sanitizeQualification({ businessChallenge: "Manual invoicing", leadStatus: "won", __proto__: { x: 1 } } as never);
    expect(r.qualification).toEqual({ businessChallenge: "Manual invoicing" });
  });
});

describe("completeness", () => {
  it("asks for why they called first, then the rest, and is complete once both required fields exist", () => {
    expect(assessQualification({})).toMatchObject({ complete: false, nextField: "businessChallenge" });
    expect(assessQualification({ businessChallenge: "x1" })).toMatchObject({ complete: false, nextField: "desiredOutcome", captured: ["businessChallenge"] });
    const done = assessQualification({ businessChallenge: "x1", desiredOutcome: "y1" });
    expect(done.complete).toBe(true);
    expect(done.nextField).toBe("organisationContext");
    expect(done.nextQuestion).toMatch(/organisation/);
    expect(assessQualification({ businessChallenge: "a1", desiredOutcome: "b1", organisationContext: "c1", constraints: "d1", schedulingPreference: "e1" })).toMatchObject({ complete: true, missing: [], nextField: null, nextQuestion: null });
  });
  it("merging keeps what was said earlier and replaces what is said again", () => {
    expect(mergeQualification({ businessChallenge: "old", constraints: "budget" }, { businessChallenge: "new" })).toEqual({ businessChallenge: "new", constraints: "budget" });
  });
});

describe("the appointment note block", () => {
  const q = { businessChallenge: "Slow reporting", desiredOutcome: "Weekly dashboards" };
  it("round-trips", () => {
    expect(parseQualificationBlock(composeQualificationBlock(q))).toEqual(q);
    expect(parseQualificationBlock(null)).toEqual({});
    expect(parseQualificationBlock("just a guest note")).toEqual({});
    expect(parseQualificationBlock(`${BLOCK_START}\nBusiness challenge: no end marker`)).toEqual({});
  });
  it("is appended after the guest's own note, and replaced, not duplicated, on the next capture", () => {
    const first = applyQualificationBlock("Please call after 3pm", q);
    expect(first.startsWith("Please call after 3pm\n\n" + BLOCK_START)).toBe(true);
    const second = applyQualificationBlock(first, { ...q, constraints: "Budget" });
    expect(second.split(BLOCK_START).length).toBe(2);
    expect(second.startsWith("Please call after 3pm")).toBe(true);
    expect(second).toContain("Constraints: Budget");
    // text the guest wrote after the block survives too
    const withTail = first + "\nP.S. bring the invoice";
    expect(applyQualificationBlock(withTail, q)).toContain("P.S. bring the invoice");
  });
  it("labels itself as unreviewed AI output and never exceeds the note limit", () => {
    expect(BLOCK_START).toMatch(/AI assistant.*not yet reviewed/);
    const huge = applyQualificationBlock("g".repeat(9000), q);
    expect(huge.length).toBeLessThanOrEqual(NOTE_MAX);
    expect(huge.endsWith(BLOCK_END)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// the tool
// ---------------------------------------------------------------------------

type B = { id: number; publicRef: string; email: string; status: string; note: string | null };
function setup(over: { booking?: Partial<B> | null; leadEmail?: string; activityFails?: boolean; updateFails?: boolean; inScope?: boolean } = {}) {
  const scope = new RunLeadScope();
  const ctx = { agentKey: "reception", subjectRef: "call:1", organizationId: null, actorUserId: null } as ToolContext;
  if (over.inScope !== false) scope.add(ctx, 10);
  const lead = { id: 10, email: over.leadEmail ?? "pat@example.com", fullName: "Pat" };
  const booking: B | null = over.booking === null ? null : { id: 55, publicRef: "BK12345", email: "pat@example.com", status: "confirmed", note: "Please call after 3pm", ...over.booking };
  const activities: Array<{ subject: string; body: string | null; leadId: number }> = [];
  const writes: Array<{ id: number; note: string }> = [];
  const deps: CaptureDeps = {
    now: () => Date.now(),
    getLeadById: async (id) => (id === 10 ? (lead as never) : null),
    createActivity: async (a) => {
      if (over.activityFails) return null;
      activities.push(a);
      return { id: activities.length } as never;
    },
    getBookingByPublicRef: async (ref) => (booking && ref === booking.publicRef ? (booking as never) : null),
    updateBookingNote: async (id, note) => {
      if (over.updateFails) return false;
      writes.push({ id, note });
      if (booking) booking.note = note;
      return true;
    },
    idempotency: new IdempotencyStore(),
    leadScope: scope,
  };
  const tool = discoveryCaptureTool(deps);
  const call = (input: Record<string, unknown>, c = ctx) => tool.execute({ requestId: `req-${Math.random().toString(36).slice(2, 12)}`, ...input }, c) as Promise<CaptureResult>;
  return { tool, call, activities, writes, booking, ctx };
}
const ref = { bookingRef: "BK12345", bookingEmail: "pat@example.com" };

describe("capture_discovery_qualification", () => {
  it("writes the structured answers to the CRM record and the appointment, and says what to ask next", async () => {
    const s = setup();
    const r = await s.call({ leadId: 10, businessChallenge: "Manual reporting takes days", ...ref });
    expect(r).toMatchObject({ ok: true, recordedToCrm: true, recordedToAppointment: true, complete: false, captured: ["businessChallenge"], removedSensitive: [] });
    expect(r.ok && r.nextQuestion).toMatch(/good outcome/);
    expect(s.activities).toHaveLength(1);
    expect(s.activities[0].body).toContain("Business challenge: Manual reporting takes days");
    expect(s.activities[0].body).toMatch(/AI assistant/);
    expect(s.writes[0].note).toContain("Please call after 3pm");
    expect(s.writes[0].note).toContain("Business challenge: Manual reporting takes days");
  });

  it("accumulates across calls without growing the note, and becomes complete", async () => {
    const s = setup();
    await s.call({ leadId: 10, businessChallenge: "Manual reporting takes days", ...ref });
    const r = await s.call({ leadId: 10, desiredOutcome: "Weekly dashboards", ...ref });
    expect(r).toMatchObject({ ok: true, complete: true, captured: ["businessChallenge", "desiredOutcome"] });
    const note = s.booking!.note!;
    expect(note.split(BLOCK_START).length).toBe(2);
    expect(note).toContain("Business challenge: Manual reporting takes days");
    expect(note).toContain("Desired outcome: Weekly dashboards");
    expect(note.startsWith("Please call after 3pm")).toBe(true);
  });

  it("works without an appointment, recording to the CRM only", async () => {
    const s = setup();
    const r = await s.call({ leadId: 10, desiredOutcome: "More leads" });
    expect(r).toMatchObject({ ok: true, recordedToCrm: true, recordedToAppointment: false });
    expect(s.writes).toHaveLength(0);
  });

  it("a retried request id records once", async () => {
    const s = setup();
    const input = { leadId: 10, businessChallenge: "Manual reporting", requestId: "same-request-1" };
    const a = await s.call(input);
    const b = await s.call(input);
    expect(b).toEqual(a);
    expect(s.activities).toHaveLength(1);
  });

  it("removes card numbers and credentials before anything is stored, and tells the assistant", async () => {
    const s = setup();
    const r = await s.call({ leadId: 10, businessChallenge: "Billing issue, my card 4111 1111 1111 1111 and the password is hunter2", ...ref });
    expect(r).toMatchObject({ ok: true, removedSensitive: expect.arrayContaining(["card_number", "credential"]) });
    expect(r.ok && r.instruction).toMatch(/never to share/);
    const stored = JSON.stringify([s.activities, s.writes]);
    expect(stored).not.toMatch(/4111|hunter2/);
    // only sensitive text: nothing to record at all
    const only = await s.call({ leadId: 10, constraints: "4111111111111111", ...ref });
    expect(only).toMatchObject({ ok: false, code: "invalid" });
  });

  it("refuses a lead that is not part of this conversation, and writes nothing", async () => {
    const s = setup({ inScope: false });
    expect(await s.call({ leadId: 10, businessChallenge: "Manual reporting" })).toMatchObject({ ok: false, code: "not_allowed" });
    const other = setup();
    expect(await other.call({ leadId: 10, businessChallenge: "Manual reporting" }, { ...other.ctx, subjectRef: "call:2" })).toMatchObject({ ok: false, code: "not_allowed" });
    expect(s.activities.length + other.activities.length).toBe(0);
  });

  it("refuses an appointment that is not this caller's, with one answer for every kind of mismatch", async () => {
    const wrongEmail = setup();
    const unknown = setup();
    const otherGuest = setup({ booking: { email: "someone.else@example.com" }, leadEmail: "pat@example.com" });
    const msgs = [
      await wrongEmail.call({ leadId: 10, businessChallenge: "Manual reporting", bookingRef: "BK12345", bookingEmail: "wrong@example.com" }),
      await unknown.call({ leadId: 10, businessChallenge: "Manual reporting", bookingRef: "BK99999", bookingEmail: "pat@example.com" }),
      await otherGuest.call({ leadId: 10, businessChallenge: "Manual reporting", bookingRef: "BK12345", bookingEmail: "someone.else@example.com" }),
    ];
    for (const m of msgs) expect(m).toMatchObject({ ok: false, code: "not_found" });
    expect(new Set(msgs.map((m) => (m.ok ? "" : m.message))).size).toBe(1);
    // nothing was written anywhere, not even the CRM note
    for (const s of [wrongEmail, unknown, otherGuest]) expect(s.activities.length + s.writes.length).toBe(0);
  });

  it("the booking and the prospect must be the same person: a matching booking email is not enough", async () => {
    const s = setup({ leadEmail: "lead@example.com", booking: { email: "pat@example.com" } });
    expect(await s.call({ leadId: 10, businessChallenge: "Manual reporting", ...ref })).toMatchObject({ ok: false, code: "not_found" });
    expect(s.writes).toHaveLength(0);
  });

  it("never writes to a cancelled or completed appointment", async () => {
    for (const status of ["cancelled", "completed"]) {
      const s = setup({ booking: { status } });
      expect(await s.call({ leadId: 10, businessChallenge: "Manual reporting", ...ref }), status).toMatchObject({ ok: false, code: "not_allowed" });
      expect(s.activities.length + s.writes.length).toBe(0);
    }
    for (const status of ["pending", "confirmed"]) expect((await setup({ booking: { status } }).call({ leadId: 10, businessChallenge: "Manual reporting", ...ref })).ok).toBe(true);
  });

  it("is honest when a store fails: no claim of success, and the assistant is told what to say", async () => {
    expect(await setup({ activityFails: true }).call({ leadId: 10, businessChallenge: "Manual reporting" })).toMatchObject({ ok: false, code: "unavailable" });
    const partial = await setup({ updateFails: true }).call({ leadId: 10, businessChallenge: "Manual reporting", ...ref });
    expect(partial).toMatchObject({ ok: true, recordedToCrm: true, recordedToAppointment: false });
    expect(partial.ok && partial.instruction).toMatch(/person will pass/);
  });

  it("does not change the appointment other than its note", async () => {
    const s = setup();
    await s.call({ leadId: 10, businessChallenge: "Manual reporting", ...ref });
    expect(Object.keys(s.writes[0]).sort()).toEqual(["id", "note"]);
    expect(s.booking).toMatchObject({ status: "confirmed", email: "pat@example.com", publicRef: "BK12345" });
  });

  it("validates input strictly", () => {
    const t = setup().tool;
    const ok = { leadId: 10, requestId: "req-12345678", businessChallenge: "x1" };
    expect(t.inputSchema.safeParse(ok).success).toBe(true);
    expect(t.inputSchema.safeParse({ ...ok, status: "won" }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, bookingRef: "BK12345" }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, bookingEmail: "a@b.co" }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, bookingRef: "BK12345", bookingEmail: "not-an-email" }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, leadId: -1 }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, requestId: "short" }).success).toBe(false);
    expect(t.inputSchema.safeParse({ ...ok, businessChallenge: "x".repeat(2000) }).success).toBe(false);
  });

  it("is a draft-level CRM write tool at identity Level 1", () => {
    const t = setup().tool;
    expect(t).toMatchObject({ name: "capture_discovery_qualification", effect: "draft", requiredPermission: "crm_write", organizationScoped: false });
    expect(t.identityRequirement).toBeUndefined();
  });
});
