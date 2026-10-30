/**
 * The receptionist's callback tool (task R21; 29 Oct Ch6.3, F-06). When a transfer
 * fails or a caller asks to be phoned back, this creates the callback task so the
 * promise is tracked, assigned and escalated if it is missed. Provider-independent:
 * it makes no call and sends no message to the caller.
 *
 * Safety model, like the CRM tools beside it:
 *   - a lead id is accepted only for a lead that belongs to THIS conversation;
 *   - the phone number must be dialable, and a repeat request for the same number
 *     joins the callback already open instead of creating a second promise;
 *   - card numbers and credentials are removed from the reason before it is stored;
 *   - the assistant is told only a rough window ("within about 2 hours"), never an
 *     exact time it cannot guarantee;
 *   - idempotent per request id.
 */
import { z } from "zod";
import { CALLBACK_RULES, normalizePhone, type Priority } from "../shared/callbackRules";
import { scrubSensitive } from "../shared/discoveryQualification";
import type { AgentTool, ToolContext } from "./agentRuntime";
import type { RunLeadScope } from "./crmTools";
import type { IdempotencyStore } from "./schedulingTools";

export type CallbackToolResult =
  | { ok: true; callbackId: number; duplicate: boolean; windowMinutes: number; instruction: string }
  | { ok: false; code: "invalid" | "not_allowed" | "unavailable"; message: string };

export type CallbackToolDeps = {
  now(): number;
  leadExists(id: number): Promise<boolean>;
  create(a: { leadId: number | null; callerName: string; callerPhone: string; reason: string; priority: Priority }): Promise<{ ok: true; id: number; duplicate: boolean; dueAt: Date; priority: Priority } | { ok: false; reason: "invalid_phone" | "unavailable" }>;
  announceCreated(a: { id: number; callerName: string }): Promise<void>;
  idempotency: IdempotencyStore;
  leadScope: RunLeadScope;
};

const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_.:-]+$/, "letters, digits and _ . : - only");
const unavailable: CallbackToolResult = { ok: false, code: "unavailable", message: "The callback could not be recorded. Do not promise the caller a callback; offer to take another message." };

function windowText(minutes: number): string {
  return minutes < 60 ? `${minutes} minutes` : minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}` : `${minutes} minutes`;
}

export function callbackTool(deps: CallbackToolDeps): AgentTool {
  return {
    name: "request_callback",
    description: "Record that the caller needs to be phoned back by a person, for example when no one could take their call. Needs their name and a phone number. Say only that someone will call back within the stated window, never an exact time.",
    parameters: {
      type: "object",
      properties: { callerName: { type: "string" }, callerPhone: { type: "string" }, reason: { type: "string" }, urgent: { type: "boolean" }, leadId: { type: "integer" }, requestId: { type: "string" } },
      required: ["callerName", "callerPhone", "reason", "requestId"],
      additionalProperties: false,
    },
    inputSchema: z
      .object({ callerName: z.string().trim().min(2).max(200), callerPhone: z.string().trim().min(7).max(40), reason: z.string().trim().min(3).max(CALLBACK_RULES.maxReasonLength * 2), urgent: z.boolean().optional(), leadId: z.number().int().positive().optional(), requestId })
      .strict(),
    effect: "draft",
    requiredPermission: "callback_write",
    organizationScoped: false,
    execute: async (raw, ctx: ToolContext): Promise<CallbackToolResult> => {
      const i = raw as { callerName: string; callerPhone: string; reason: string; urgent?: boolean; leadId?: number; requestId: string };
      return deps.idempotency.run(`${ctx.agentKey}|${ctx.subjectRef}|callback|${i.requestId}`, async (): Promise<CallbackToolResult> => {
        try {
          if (!normalizePhone(i.callerPhone)) return { ok: false, code: "invalid", message: "That phone number cannot be dialled. Ask the caller to repeat it, with the country code if it is not local." };
          if (i.leadId !== undefined) {
            if (!deps.leadScope.has(ctx, i.leadId, deps.now())) return { ok: false, code: "not_allowed", message: "That record is not part of this conversation." };
            if (!(await deps.leadExists(i.leadId))) return { ok: false, code: "not_allowed", message: "That record no longer exists." };
          }
          const reason = scrubSensitive(i.reason.replace(/\s+/g, " ").trim()).text.slice(0, CALLBACK_RULES.maxReasonLength);
          const priority: Priority = i.urgent ? "urgent" : "normal";
          const r = await deps.create({ leadId: i.leadId ?? null, callerName: i.callerName, callerPhone: i.callerPhone, reason, priority });
          if (!r.ok) return r.reason === "invalid_phone" ? { ok: false, code: "invalid", message: "That phone number cannot be dialled." } : unavailable;
          if (!r.duplicate) await deps.announceCreated({ id: r.id, callerName: i.callerName }).catch(() => undefined);
          const windowMinutes = CALLBACK_RULES.dueMinutes[r.priority];
          return {
            ok: true,
            callbackId: r.id,
            duplicate: r.duplicate,
            windowMinutes,
            instruction: r.duplicate
              ? `A callback for this number is already waiting. Tell the caller someone will phone them back, expected within about ${windowText(windowMinutes)} of their first request, and do not promise an exact time.`
              : `Tell the caller someone will phone them back within about ${windowText(windowMinutes)}. Do not promise an exact time.`,
          };
        } catch {
          return unavailable;
        }
      });
    },
  } as AgentTool;
}

export async function realCallbackTool(shared: { idempotency: IdempotencyStore; leadScope: RunLeadScope }): Promise<AgentTool> {
  const [calls, crm, dispatcher] = await Promise.all([import("./db/callbacks"), import("./db/crm"), import("./notificationDispatcher")]);
  return callbackTool({
    now: () => Date.now(),
    leadExists: async (id) => Boolean(await crm.getLeadById(id)),
    create: async (a) => {
      const r = await calls.createCallback({ ...a, organizationId: null, source: "ai_receptionist", createdByUserId: null });
      return r.ok ? { ok: true, id: r.task.id, duplicate: r.duplicate, dueAt: r.task.dueAt, priority: r.task.priority as Priority } : r;
    },
    announceCreated: async ({ id, callerName }) => {
      await dispatcher.emitNotification({ event: "DISCOVERY_CALL_ACTION_REQUIRED", audience: { type: "admin" }, dedupeRef: `callback:${id}:created`, title: `Callback requested: ${callerName.trim().split(/\s+/)[0]} (CB-${id})`, href: "/admin/crm" });
    },
    ...shared,
  });
}
