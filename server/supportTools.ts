/**
 * Support tools for the AI Support Agent (task G10). Two tools on the shared runtime,
 * both Level 2 and organisation scoped, so the runtime refuses them for an
 * unverified caller and for another organisation's verification before they run:
 *   - support_ticket_status: the state of one of the caller's OWN tickets;
 *   - support_open_ticket: a new ticket for the caller's organisation.
 * They never show a ticket's text, never resolve or change a ticket, and never
 * contact anyone. Provider-independent.
 */
import { z } from "zod";
import { applyPriorityFloor, categoryFor, composeTicketBody, TICKET_CATEGORIES, TICKET_REF, triageSupportRequest } from "../shared/supportAgent";
import { scrubSensitive } from "../shared/discoveryQualification";
import type { AgentTool, ToolContext } from "./agentRuntime";
import type { IdempotencyStore } from "./schedulingTools";

export type TicketView = { publicRef: string; subject: string; status: string; priority: string; category: string; createdAt: Date };

export type SupportResult =
  | { ok: true; [k: string]: unknown }
  | { ok: false; code: "invalid" | "not_found" | "handover" | "unavailable"; message: string };

export type SupportDeps = {
  findTicket(organizationId: number, publicRef: string): Promise<TicketView | null>;
  createTicket(a: { organizationId: number; subject: string; body: string; category: string; priority: "low" | "normal" | "high" | "urgent" }): Promise<{ publicRef: string } | null>;
  announce(a: { publicRef: string; priority: string; category: string }): Promise<void>;
  idempotency: IdempotencyStore;
};

const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_.:-]+$/, "letters, digits and _ . : - only");
const unavailable: SupportResult = { ok: false, code: "unavailable", message: "The support system could not complete that. Do not tell the caller it was done; offer a callback." };
const notFound: SupportResult = { ok: false, code: "not_found", message: "There is no ticket with that reference on this account." };

export function supportTools(deps: SupportDeps): AgentTool[] {
  return [
    {
      name: "support_ticket_status",
      description: "Look up the status of one of the verified caller's own support tickets by its reference. Returns the status, priority and category, never the ticket text.",
      parameters: { type: "object", properties: { publicRef: { type: "string" } }, required: ["publicRef"], additionalProperties: false },
      inputSchema: z.object({ publicRef: z.string().trim().regex(TICKET_REF, "not a ticket reference") }).strict(),
      effect: "read",
      requiredPermission: "view_support_status",
      organizationScoped: true,
      identityRequirement: { level: 2, permission: "view_own_support_tickets" },
      execute: async (raw, ctx: ToolContext): Promise<SupportResult> => {
        if (ctx.organizationId === null) return notFound;
        try {
          const t = await deps.findTicket(ctx.organizationId, (raw as { publicRef: string }).publicRef.toUpperCase());
          if (!t) return notFound; // another organisation's ticket looks exactly the same as one that does not exist
          return { ok: true, publicRef: t.publicRef, status: t.status.replace(/_/g, " "), priority: t.priority, category: t.category, openedOn: t.createdAt.toISOString().slice(0, 10) };
        } catch {
          return unavailable;
        }
      },
    },
    {
      name: "support_open_ticket",
      description: "Open a support ticket for the verified caller's organisation, after they have confirmed what it should say. A person follows up; you cannot resolve it. Security reports are not for you: hand those over.",
      parameters: {
        type: "object",
        properties: { subject: { type: "string" }, body: { type: "string" }, category: { enum: [...TICKET_CATEGORIES] }, priority: { enum: ["low", "normal", "high", "urgent"] }, requestId: { type: "string" }, callerConfirmed: { const: true } },
        required: ["subject", "body", "requestId", "callerConfirmed"],
        additionalProperties: false,
      },
      inputSchema: z
        .object({
          subject: z.string().trim().min(3).max(200),
          body: z.string().trim().min(8).max(3500),
          category: z.enum(TICKET_CATEGORIES).default("general"),
          priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
          requestId,
          callerConfirmed: z.literal(true, { message: "the caller must confirm what the ticket says" }),
        })
        .strict(),
      effect: "draft",
      requiredPermission: "open_support_ticket",
      organizationScoped: true,
      identityRequirement: { level: 2, permission: "open_support_ticket" },
      execute: async (raw, ctx: ToolContext): Promise<SupportResult> => {
        const i = raw as { subject: string; body: string; category: (typeof TICKET_CATEGORIES)[number]; priority: "low" | "normal" | "high" | "urgent"; requestId: string };
        if (ctx.organizationId === null) return { ok: false, code: "invalid", message: "There is no account to open a ticket on." };
        const organizationId = ctx.organizationId;
        return deps.idempotency.run(`${ctx.agentKey}|${ctx.subjectRef}|ticket|${i.requestId}`, async (): Promise<SupportResult> => {
          const triage = triageSupportRequest(`${i.subject}\n${i.body}`);
          // Personal safety is never a ticket: a person must speak to the caller now.
          if (triage.category === "safety") return { ok: false, code: "handover", message: "Do not open a ticket. Tell the caller you are connecting them with a person now, and hand over." };
          try {
            const subject = scrubSensitive(i.subject).text.slice(0, 200);
            const body = scrubSensitive(i.body).text;
            // Defaults are applied here as well as in the schema, so the tool is safe if it is ever called without the runtime's validation.
            const priority = applyPriorityFloor(i.priority ?? "normal", triage.priorityFloor);
            const category = categoryFor(i.category ?? "general", triage);
            const t = await deps.createTicket({ organizationId, subject, body: composeTicketBody(body), category, priority });
            if (!t) return unavailable;
            await deps.announce({ publicRef: t.publicRef, priority, category }).catch(() => undefined);
            return {
              ok: true,
              publicRef: t.publicRef,
              priority,
              category,
              handOverToo: triage.handOver,
              instruction: triage.handOver
                ? `Ticket ${t.publicRef} is open and marked ${priority}. This is a ${triage.category} matter: also tell the caller a person will contact them, and do not discuss it further yourself.`
                : `Ticket ${t.publicRef} is open. Tell the caller a person will follow up. Do not promise a time or an outcome.`,
            };
          } catch {
            return unavailable;
          }
        });
      },
    },
  ] as AgentTool[];
}

export async function realSupportTools(shared: { idempotency: IdempotencyStore }): Promise<AgentTool[]> {
  const [{ getDb }, schema, { and, eq }, { generatePublicRef }, clientPortal, dispatcher] = await Promise.all([
    import("./db/connection"),
    import("../drizzle/schema"),
    import("drizzle-orm"),
    import("./_core/publicRef"),
    import("./db/clientPortal"),
    import("./notificationDispatcher"),
  ]);
  return supportTools({
    findTicket: async (organizationId, publicRef) => {
      const db = await getDb();
      if (!db) throw new Error("database unavailable");
      const t = (await db.select().from(schema.clientSupportTickets).where(and(eq(schema.clientSupportTickets.organizationId, organizationId), eq(schema.clientSupportTickets.publicRef, publicRef))).limit(1))[0];
      return t ? { publicRef: t.publicRef, subject: t.subject, status: t.status, priority: t.priority, category: t.category, createdAt: t.createdAt } : null;
    },
    createTicket: async (a) => clientPortal.createClientSupportTicket({ organizationId: a.organizationId, openedByUserId: null, publicRef: generatePublicRef("T"), subject: a.subject, body: a.body, category: a.category, priority: a.priority }),
    announce: async ({ publicRef, priority, category }) => {
      await dispatcher.emitNotification({ event: category === "security" ? "SECURITY_ACTION_REQUIRED" : "CLIENT_ACCOUNT_ACTION_REQUIRED", audience: { type: "admin" }, dedupeRef: `ticket:${publicRef}:ai-opened`, title: `Support ticket ${publicRef} opened by the AI assistant (${priority})`, href: "/admin/support" });
    },
    ...shared,
  });
}

// ---------------------------------------------------------------------------
// The whole toolset for the Support Agent
// ---------------------------------------------------------------------------

import { callContextTools, type CallContextStore } from "./callContext";
import { callbackTool, type CallbackToolDeps } from "./callbackTools";
import { faqTools, type FaqDeps } from "./faqStore";
import { knowledgeTools, type KnowledgeDeps } from "./knowledgeStore";

/**
 * Every tool the agent definition lists, built from injected dependencies so the definition and the real tools
 * can be checked against each other without a database. Nothing is registered anywhere by calling this.
 */
export function supportAgentToolset(d: { faq: FaqDeps; knowledge: KnowledgeDeps; support: SupportDeps; callback: CallbackToolDeps; context: CallContextStore }): AgentTool[] {
  const knowledge = knowledgeTools(d.knowledge).filter((t) => t.name === "search_knowledge_base_articles" || t.name === "search_product_documentation");
  return [...faqTools(d.faq), ...knowledge, ...supportTools(d.support), callbackTool(d.callback), ...callContextTools(d.context)];
}
