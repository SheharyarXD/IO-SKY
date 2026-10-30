/**
 * The discovery qualification capture tool (task R19; SRS 14.7; 29 Oct Doc 1
 * Ch6.1). One call records what the caller said about why they want a discovery
 * call, in the same structured fields, in two places: a note on their CRM
 * prospect record and a delimited block on their appointment, so the person
 * taking the call has it. Rules are in shared/discoveryQualification.ts.
 *
 * Safety model (same as the CRM tools it sits beside):
 *   - the lead must belong to THIS conversation (RunLeadScope), so a caller cannot
 *     attach text to someone else's record by quoting an id;
 *   - the appointment is reached only with its reference AND the guest's email,
 *     and only when that email is the lead's email: a booking and a prospect that
 *     do not belong together are never joined;
 *   - only live appointments (pending or confirmed) are written to;
 *   - card numbers and credentials are removed before anything is stored, and the
 *     assistant is told so;
 *   - the capture is idempotent per request id and the appointment block is
 *     replaced, not appended, so retries and repeats never grow the note.
 * It does not change the appointment's time, status, name or email.
 */
import { z } from "zod";
import { normalizeEmail, composeNoteBody } from "../shared/crmRules";
import { applyQualificationBlock, assessQualification, mergeQualification, parseQualificationBlock, sanitizeQualification, QUALIFICATION_FIELDS, FIELD_LIMITS } from "../shared/discoveryQualification";
import { bookingBelongsTo } from "../shared/schedulingRules";
import type { Booking, CrmActivity, Lead } from "../drizzle/schema";
import type { AgentTool, ToolContext } from "./agentRuntime";
import type { RunLeadScope } from "./crmTools";
import type { IdempotencyStore } from "./schedulingTools";

export type CaptureResult =
  | {
      ok: true;
      recordedToCrm: boolean;
      recordedToAppointment: boolean;
      complete: boolean;
      captured: string[];
      missing: string[];
      nextQuestion: string | null;
      removedSensitive: string[];
      instruction: string;
    }
  | { ok: false; code: "invalid" | "not_found" | "not_allowed" | "unavailable"; message: string };

export type CaptureDeps = {
  now(): number;
  getLeadById(id: number): Promise<Lead | null>;
  createActivity(a: { kind: "note"; subject: string; body: string | null; leadId: number; opportunityId: null; organizationId: null; dueAt: null; createdByUserId: null }): Promise<CrmActivity | null>;
  getBookingByPublicRef(ref: string): Promise<Booking | null>;
  updateBookingNote(id: number, note: string): Promise<boolean>;
  idempotency: IdempotencyStore;
  leadScope: RunLeadScope;
};

const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_.:-]+$/, "letters, digits and _ . : - only");
const field = (f: (typeof QUALIFICATION_FIELDS)[number]) => z.string().max(FIELD_LIMITS[f] * 2).optional();
const unavailable: CaptureResult = { ok: false, code: "unavailable", message: "That could not be recorded. Ask a person to follow up; do not tell the caller it was saved." };

export function discoveryCaptureTool(deps: CaptureDeps): AgentTool {
  return {
    name: "capture_discovery_qualification",
    description:
      "Record what the caller has said about why they want a discovery call, on their prospect record and, when given, on their appointment. Call it as you learn each answer; fields you do not pass are kept. The result lists what is still missing and the next question to ask. Never ask for or accept card numbers or passwords.",
    parameters: {
      type: "object",
      properties: {
        leadId: { type: "integer" },
        businessChallenge: { type: "string" },
        desiredOutcome: { type: "string" },
        organisationContext: { type: "string" },
        constraints: { type: "string" },
        schedulingPreference: { type: "string" },
        bookingRef: { type: "string" },
        bookingEmail: { type: "string" },
        requestId: { type: "string" },
      },
      required: ["leadId", "requestId"],
      additionalProperties: false,
    },
    inputSchema: z
      .object({
        leadId: z.number().int().positive(),
        businessChallenge: field("businessChallenge"),
        desiredOutcome: field("desiredOutcome"),
        organisationContext: field("organisationContext"),
        constraints: field("constraints"),
        schedulingPreference: field("schedulingPreference"),
        bookingRef: z.string().trim().min(4).max(32).optional(),
        bookingEmail: z.string().trim().email().max(320).optional(),
        requestId,
      })
      .strict()
      .refine((v) => Boolean(v.bookingRef) === Boolean(v.bookingEmail), { message: "give the booking reference and the guest's email together" }),
    effect: "draft",
    requiredPermission: "crm_write",
    organizationScoped: false,
    execute: async (raw, ctx: ToolContext): Promise<CaptureResult> => {
      const i = raw as Record<string, string | number | undefined>;
      return deps.idempotency.run(`${ctx.agentKey}|${ctx.subjectRef}|qualify|${i.requestId}`, async (): Promise<CaptureResult> => {
        try {
          if (!deps.leadScope.has(ctx, i.leadId as number, deps.now())) return { ok: false, code: "not_allowed", message: "That record is not part of this conversation." };
          const lead = await deps.getLeadById(i.leadId as number);
          if (!lead) return { ok: false, code: "not_found", message: "That record no longer exists." };

          const { qualification: incoming, redactions } = sanitizeQualification(i as Partial<Record<(typeof QUALIFICATION_FIELDS)[number], unknown>>);
          if (Object.keys(incoming).length === 0) {
            return redactions.length
              ? { ok: false, code: "invalid", message: "Nothing could be recorded because it contained card or credential details, which are never stored. Ask the caller to describe it without them." }
              : { ok: false, code: "invalid", message: "Give at least one answer to record." };
          }

          // The appointment first: if it is wrong nothing at all is written, so the two records never disagree.
          let booking: Booking | null = null;
          if (i.bookingRef && i.bookingEmail) {
            const b = await deps.getBookingByPublicRef(String(i.bookingRef));
            const sameGuest = bookingBelongsTo(b, String(i.bookingEmail));
            const sameLead = Boolean(b) && normalizeEmail(b!.email) !== null && normalizeEmail(b!.email) === normalizeEmail(lead.email);
            if (!b || !sameGuest || !sameLead) return { ok: false, code: "not_found", message: "No booking matches that reference and email for this caller." };
            if (b.status !== "pending" && b.status !== "confirmed") return { ok: false, code: "not_allowed", message: "That appointment is no longer active, so nothing was added to it." };
            booking = b;
          }

          const merged = booking ? mergeQualification(parseQualificationBlock(booking.note), incoming) : incoming;

          const activity = await deps.createActivity({
            kind: "note",
            subject: "Discovery qualification",
            body: composeNoteBody({ qualification: incoming, reason: booking ? `Captured for appointment ${booking.publicRef}` : undefined }),
            leadId: lead.id,
            opportunityId: null,
            organizationId: null,
            dueAt: null,
            createdByUserId: null,
          });
          if (!activity) return unavailable;

          let onAppointment = false;
          if (booking) onAppointment = await deps.updateBookingNote(booking.id, applyQualificationBlock(booking.note, merged));

          const a = assessQualification(merged);
          return {
            ok: true,
            recordedToCrm: true,
            recordedToAppointment: onAppointment,
            complete: a.complete,
            captured: a.captured,
            missing: a.missing,
            nextQuestion: a.nextQuestion,
            removedSensitive: redactions,
            instruction: redactions.length
              ? "Part of what was said contained card or credential details and was removed, not stored. Tell the caller never to share those here."
              : booking && !onAppointment
                ? "The prospect record was updated but the appointment could not be. Say a person will pass the details on."
                : a.complete
                  ? "The essentials are recorded. Ask any remaining question only if it is natural."
                  : "Ask the next question, then record the answer.",
          };
        } catch {
          return unavailable;
        }
      });
    },
  } as AgentTool;
}

export async function realDiscoveryCaptureTool(shared: { idempotency: IdempotencyStore; leadScope: RunLeadScope }): Promise<AgentTool> {
  const [crm, sales, bookings] = await Promise.all([import("./db/crm"), import("./db/srsSales"), import("./db/bookings")]);
  return discoveryCaptureTool({
    now: () => Date.now(),
    getLeadById: crm.getLeadById,
    createActivity: sales.createActivity as CaptureDeps["createActivity"],
    getBookingByPublicRef: bookings.getBookingByPublicRef,
    updateBookingNote: bookings.updateBookingNote,
    ...shared,
  });
}

/** The receptionist's CRM tools plus the qualification capture tool, sharing ONE per-conversation lead scope. */
export async function realReceptionistRecordTools(): Promise<AgentTool[]> {
  const { realCrmTools, RunLeadScope } = await import("./crmTools");
  const { IdempotencyStore } = await import("./schedulingTools");
  const shared = { idempotency: new IdempotencyStore(), leadScope: new RunLeadScope() };
  const { realCallbackTool } = await import("./callbackTools");
  return [...(await realCrmTools(shared)), await realDiscoveryCaptureTool(shared), await realCallbackTool(shared)];
}
