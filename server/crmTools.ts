/**
 * CRM tools for the AI receptionist on the shared agent runtime (task R18;
 * SRS 14.16; 29 Oct Doc 1 Ch6 and ACC-05): search, deduplicate, create a New
 * Prospect, capture structured notes and qualification, add follow-up tasks.
 * Provider-independent: they work on the CRM tables the platform already has and
 * call no voice, speech or telephony service. They do not make the receptionist
 * operational; they are the tools one would use.
 *
 * Safety model:
 *   - Resource scope. A tool may only touch a lead that belongs to THIS
 *     conversation: one it created, or one surfaced after the caller was verified.
 *     A caller cannot make the assistant attach notes to someone else's record by
 *     quoting its id or email.
 *   - No disclosure. Unverified, a lookup says only whether something matched.
 *     An existing client's records are never described by these tools to anyone;
 *     the model is told to hand over to the verified portal flow.
 *   - Append only. A lead is created or has EMPTY details filled; nothing is
 *     overwritten and status, name and email are never changed here (status is
 *     owned by the operations team). Notes and follow-ups are new activity rows
 *     that say an assistant wrote them and carry no author user.
 *   - Everything changing is a `draft` tool: an internal, reviewable, reversible
 *     record. The runtime therefore needs the agent to have at least draft
 *     authority and the crm_write permission.
 *   - Retried calls are idempotent per request id. Duplicate leads are prevented
 *     by a check immediately before the insert; there is no database uniqueness
 *     on email, so two simultaneous first calls could still both insert.
 */
import { z } from "zod";
import { composeNoteBody, matchedOn, normalizeEmail, phoneKey, type Qualification } from "../shared/crmRules";
import { authorizeOperation } from "../shared/identityPolicy";
import type { AgentTool, ToolContext } from "./agentRuntime";
import { IdempotencyStore } from "./schedulingTools";
import type { CrmActivity, Lead } from "../drizzle/schema";

export type CrmResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: "invalid" | "not_found" | "not_allowed" | "protected" | "unavailable"; message: string };

export type CrmDeps = {
  now(): number;
  findLeadsByContact(a: { email: string | null; phoneKey: string | null }): Promise<Lead[]>;
  isExistingClientEmail(email: string): Promise<boolean>;
  createLead(input: Record<string, unknown>): Promise<Lead | null>;
  getLeadById(id: number): Promise<Lead | null>;
  fillLeadBlanks(id: number, patch: { company?: string; phone?: string; interest?: string }): Promise<string[] | null>;
  createActivity(a: { kind: "note" | "follow_up"; subject: string; body: string | null; leadId: number; opportunityId: null; organizationId: null; dueAt: Date | null; createdByUserId: null }): Promise<CrmActivity | null>;
  idempotency: IdempotencyStore;
  leadScope: RunLeadScope;
};

/** The leads one conversation may work on. In memory, per server instance, bounded. */
export class RunLeadScope {
  private readonly runs = new Map<string, { at: number; ids: Set<number> }>();
  constructor(private readonly ttlMs = 2 * 3600_000, private readonly max = 500) {}
  private k(ctx: Pick<ToolContext, "agentKey" | "subjectRef">) {
    return `${ctx.agentKey}|${ctx.subjectRef}`;
  }
  add(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, leadId: number, now = Date.now()) {
    const key = this.k(ctx);
    const cur = this.runs.get(key);
    const entry = cur && now - cur.at < this.ttlMs ? cur : { at: now, ids: new Set<number>() };
    entry.ids.add(leadId);
    entry.at = now;
    this.runs.delete(key);
    this.runs.set(key, entry);
    while (this.runs.size > this.max) this.runs.delete(this.runs.keys().next().value as string);
  }
  has(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, leadId: number, now = Date.now()): boolean {
    const e = this.runs.get(this.k(ctx));
    return Boolean(e && now - e.at < this.ttlMs && e.ids.has(leadId));
  }
}

/** The account permission a verified caller must hold to be shown details of the contact records the assistant surfaces. */
export const CRM_DETAIL_PERMISSION = "view_own_contact_record";

/** Verified in the R10 sense: a live verification, in this organisation context, holding the permission. */
function isVerified(ctx: ToolContext, now: number): boolean {
  return authorizeOperation({ level: 2, permission: CRM_DETAIL_PERMISSION, organizationScoped: false }, ctx.identity, { organizationId: ctx.organizationId }, now).allowed;
}

const unavailable: CrmResult = { ok: false, code: "unavailable", message: "The CRM could not complete that. Nothing you can rely on was recorded; ask a person to follow up." };
const outOfScope: CrmResult = { ok: false, code: "not_allowed", message: "That record is not part of this conversation." };

const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_.:-]+$/, "letters, digits and _ . : - only");
const leadId = z.number().int().positive();
const text = (max: number) => z.string().trim().min(1).max(max);
const qualification = z
  .object({ businessChallenge: text(500).optional(), desiredOutcome: text(500).optional(), organisationContext: text(500).optional(), constraints: text(500).optional(), schedulingPreference: text(300).optional() })
  .strict();

export function crmTools(deps: CrmDeps): AgentTool[] {
  const key = (ctx: ToolContext, tool: string, id: string) => `${ctx.agentKey}|${ctx.subjectRef}|${tool}|${id}`;
  const guardLead = async (ctx: ToolContext, id: number): Promise<CrmResult | null> => {
    if (!deps.leadScope.has(ctx, id, deps.now())) return outOfScope;
    return (await deps.getLeadById(id)) ? null : { ok: false, code: "not_found", message: "That record no longer exists." };
  };

  return [
    {
      name: "crm_find_contact",
      description:
        "Check whether a person is already known, by email or phone. Without verification you only learn yes or no. Never say that someone is or is not a client; if the result says existingClient, do not discuss their account and route them to the verified portal flow.",
      parameters: { type: "object", properties: { email: { type: "string" }, phone: { type: "string" } }, additionalProperties: false },
      inputSchema: z.object({ email: z.string().trim().max(320).optional(), phone: z.string().trim().max(64).optional() }).strict(),
      effect: "read",
      requiredPermission: "crm_read",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<CrmResult> => {
        const i = raw as { email?: string; phone?: string };
        const email = normalizeEmail(i.email);
        const pk = phoneKey(i.phone);
        if (!email && !pk) return { ok: false, code: "invalid", message: "Give a valid email address or a phone number." };
        try {
          const [leads, client] = await Promise.all([deps.findLeadsByContact({ email, phoneKey: pk }), email ? deps.isExistingClientEmail(email) : Promise.resolve(false)]);
          const matched = leads.length > 0 || client;
          if (!isVerified(ctx, deps.now())) return { ok: true, matched } as CrmResult<object>;
          if (client) return { ok: true, matched: true, existingClient: true, matches: [] } as CrmResult<object>;
          for (const l of leads) deps.leadScope.add(ctx, l.id, deps.now());
          return {
            ok: true,
            matched,
            existingClient: false,
            matches: leads.map((l) => ({ leadId: l.id, fullName: l.fullName, company: l.company, status: l.status, newProspect: l.status === "new", matchedOn: matchedOn(l, { email, phone: i.phone }) })),
          } as CrmResult<object>;
        } catch {
          return unavailable;
        }
      },
    },
    {
      name: "crm_create_prospect",
      description: "Record a new prospect after checking they are not already known. If a record already exists nothing is created and you are told it was deduplicated; hand over to a person rather than guessing.",
      parameters: { type: "object", properties: { fullName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, company: { type: "string" }, reason: { type: "string" }, interest: { type: "string" }, requestId: { type: "string" } }, required: ["fullName", "email", "reason", "requestId"], additionalProperties: false },
      inputSchema: z.object({ fullName: z.string().trim().min(2).max(200), email: z.string().trim().email().max(320), phone: z.string().trim().max(64).optional(), company: z.string().trim().max(200).optional(), reason: text(500), interest: z.string().trim().max(64).optional(), requestId }).strict(),
      effect: "draft",
      requiredPermission: "crm_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<CrmResult> => {
        const i = raw as { fullName: string; email: string; phone?: string; company?: string; reason: string; interest?: string; requestId: string };
        return deps.idempotency.run(key(ctx, "create", i.requestId), async () => {
          const email = normalizeEmail(i.email);
          if (!email) return { ok: false, code: "invalid", message: "That email address is not valid." } as CrmResult;
          try {
            if (await deps.isExistingClientEmail(email)) return { ok: false, code: "protected", message: "This contact needs identity verification before anything else is recorded. Route them to the verified portal flow." } as CrmResult;
            const dupes = await deps.findLeadsByContact({ email, phoneKey: phoneKey(i.phone) });
            if (dupes.length > 0) {
              // Only a verified caller learns which record; an unverified one cannot be given access to it.
              if (isVerified(ctx, deps.now())) deps.leadScope.add(ctx, dupes[0].id, deps.now());
              return { ok: true, created: false, deduplicated: true, ...(isVerified(ctx, deps.now()) ? { leadId: dupes[0].id } : {}) } as CrmResult<object>;
            }
            const lead = await deps.createLead({
              source: "ai-receptionist", sourceId: null, fullName: i.fullName, email, company: i.company ?? null, phone: i.phone ?? null, interest: i.interest ?? null,
              note: composeNoteBody({ reason: i.reason }).slice(0, 2000), status: "new", utmSource: null, utmCampaign: null, ip: null, userAgent: "ai-receptionist",
            });
            if (!lead) return unavailable;
            deps.leadScope.add(ctx, lead.id, deps.now());
            // The timeline entry is the audit trail for how this record came to exist.
            await deps.createActivity({ kind: "note", subject: "New prospect created by the AI assistant", body: composeNoteBody({ reason: i.reason, text: `Conversation: ${ctx.subjectRef}` }), leadId: lead.id, opportunityId: null, organizationId: null, dueAt: null, createdByUserId: null }).catch(() => null);
            return { ok: true, created: true, deduplicated: false, leadId: lead.id, newProspect: true } as CrmResult<object>;
          } catch {
            return unavailable;
          }
        });
      },
    },
    {
      name: "crm_add_note",
      description: "Add a note, and/or structured qualification (business challenge, desired outcome, organisational context, constraints, scheduling preference), to a prospect from this conversation.",
      parameters: { type: "object", properties: { leadId: { type: "integer" }, subject: { type: "string" }, text: { type: "string" }, reason: { type: "string" }, qualification: { type: "object" }, requestId: { type: "string" } }, required: ["leadId", "requestId"], additionalProperties: false },
      inputSchema: z
        .object({ leadId, subject: z.string().trim().min(2).max(200).optional(), text: text(3000).optional(), reason: text(500).optional(), qualification: qualification.optional(), requestId })
        .strict()
        .refine((v) => v.text || v.reason || v.qualification, { message: "give some text, a reason or qualification" }),
      effect: "draft",
      requiredPermission: "crm_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<CrmResult> => {
        const i = raw as { leadId: number; subject?: string; text?: string; reason?: string; qualification?: Qualification; requestId: string };
        return deps.idempotency.run(key(ctx, "note", i.requestId), async () => {
          try {
            const refused = await guardLead(ctx, i.leadId);
            if (refused) return refused;
            const a = await deps.createActivity({ kind: "note", subject: i.subject ?? "Conversation note", body: composeNoteBody(i), leadId: i.leadId, opportunityId: null, organizationId: null, dueAt: null, createdByUserId: null });
            return a ? ({ ok: true, activityId: a.id } as CrmResult<object>) : unavailable;
          } catch {
            return unavailable;
          }
        });
      },
    },
    {
      name: "crm_create_follow_up",
      description: "Create a follow-up task for the team on a prospect from this conversation, due between 5 minutes and 90 days from now.",
      parameters: { type: "object", properties: { leadId: { type: "integer" }, subject: { type: "string" }, dueAtMs: { type: "integer" }, requestId: { type: "string" } }, required: ["leadId", "subject", "dueAtMs", "requestId"], additionalProperties: false },
      inputSchema: z.object({ leadId, subject: z.string().trim().min(2).max(200), dueAtMs: z.number().int(), requestId }).strict(),
      effect: "draft",
      requiredPermission: "crm_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<CrmResult> => {
        const i = raw as { leadId: number; subject: string; dueAtMs: number; requestId: string };
        return deps.idempotency.run(key(ctx, "follow", i.requestId), async () => {
          const now = deps.now();
          if (i.dueAtMs < now + 5 * 60_000 || i.dueAtMs > now + 90 * 86_400_000) return { ok: false, code: "invalid", message: "The due time must be between 5 minutes and 90 days from now." } as CrmResult;
          try {
            const refused = await guardLead(ctx, i.leadId);
            if (refused) return refused;
            const a = await deps.createActivity({ kind: "follow_up", subject: i.subject, body: composeNoteBody({ text: `Conversation: ${ctx.subjectRef}` }), leadId: i.leadId, opportunityId: null, organizationId: null, dueAt: new Date(i.dueAtMs), createdByUserId: null });
            return a ? ({ ok: true, activityId: a.id, dueIso: new Date(i.dueAtMs).toISOString() } as CrmResult<object>) : unavailable;
          } catch {
            return unavailable;
          }
        });
      },
    },
    {
      name: "crm_fill_lead_details",
      description: "Fill in company, phone or interest on a prospect from this conversation, only where they are currently empty. Existing values are never changed.",
      parameters: { type: "object", properties: { leadId: { type: "integer" }, company: { type: "string" }, phone: { type: "string" }, interest: { type: "string" }, requestId: { type: "string" } }, required: ["leadId", "requestId"], additionalProperties: false },
      inputSchema: z
        .object({ leadId, company: z.string().trim().min(1).max(200).optional(), phone: z.string().trim().min(7).max(64).optional(), interest: z.string().trim().min(1).max(64).optional(), requestId })
        .strict()
        .refine((v) => v.company || v.phone || v.interest, { message: "give at least one detail to fill in" }),
      effect: "draft",
      requiredPermission: "crm_write",
      organizationScoped: false,
      execute: async (raw, ctx): Promise<CrmResult> => {
        const i = raw as { leadId: number; company?: string; phone?: string; interest?: string; requestId: string };
        return deps.idempotency.run(key(ctx, "fill", i.requestId), async () => {
          try {
            const refused = await guardLead(ctx, i.leadId);
            if (refused) return refused;
            const filled = await deps.fillLeadBlanks(i.leadId, { company: i.company, phone: i.phone, interest: i.interest });
            return filled ? ({ ok: true, filled, unchanged: filled.length === 0 } as CrmResult<object>) : unavailable;
          } catch {
            return unavailable;
          }
        });
      },
    },
  ];
}

/** The tools wired to the real CRM. Imported lazily so tests need no database. */
export async function realCrmTools(shared: { idempotency: IdempotencyStore; leadScope: RunLeadScope } = { idempotency: new IdempotencyStore(), leadScope: new RunLeadScope() }): Promise<AgentTool[]> {
  const [crm, sales] = await Promise.all([import("./db/crm"), import("./db/srsSales")]);
  return crmTools({
    now: () => Date.now(),
    findLeadsByContact: crm.findLeadsByContact,
    isExistingClientEmail: crm.isExistingClientEmail,
    createLead: (input) => crm.createLead(input as never),
    getLeadById: crm.getLeadById,
    fillLeadBlanks: crm.fillLeadBlanks,
    createActivity: sales.createActivity,
    ...shared,
  });
}
