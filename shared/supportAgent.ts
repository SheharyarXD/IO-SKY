/**
 * The AI Support Agent (task G10; SRS 17.6, 19.5; 29 Oct Ch5): its definition, its
 * base prompt, and the safety net that decides when it must hand over to a person.
 * Pure rules. The agent is a definition on the shared runtime, not a new runtime:
 * everything it may do is a tool the registry lists, checked by the same pipeline
 * (permission, identity level, organisation scope, authority) as every other agent.
 *
 * DECISION (engineering, to be matched against the client document):
 *   - it answers general questions ONLY from approved FAQ entries and public product
 *     documentation, and says it does not know when nothing matches;
 *   - it may read the status of the caller's own tickets and open a new ticket for
 *     them, and only after Level 2 verification (shared/identityPolicy.ts);
 *   - authority is draft only: it creates internal records that staff act on, and
 *     never resolves, refunds, changes an account or contacts anyone;
 *   - security reports, legal or fraud disputes and anything about personal safety
 *     are never handled by the assistant. A deterministic check hands them to a
 *     person, and a ticket it does open for a security report is urgent.
 * The agent is registered DISABLED. A super admin enables it after reviewing it.
 */

export const SUPPORT_AGENT_KEY = "ai_support_agent";

export const SUPPORT_AGENT = {
  key: SUPPORT_AGENT_KEY,
  name: "AI Support Agent",
  purpose: "Answers general questions from approved content, checks the status of a verified customer's own support tickets, and opens a ticket for them. Hands anything sensitive to a person.",
  businessFunction: "Customer support",
  permissions: ["converse", "search_knowledge", "call_context", "view_support_status", "open_support_ticket", "callback_write"],
  tools: ["answer_faq", "search_knowledge_base_articles", "search_product_documentation", "support_ticket_status", "support_open_ticket", "request_callback", "remember_caller_detail", "recall_conversation_details", "forget_caller_detail"],
  knowledgeSources: ["knowledge_base_articles", "product_documentation"],
  supportedModules: ["support", "client_portal"],
  capabilities: ["answer_general_questions", "read_own_ticket_status", "open_support_ticket", "request_callback"],
  maxAuthority: "draft_only",
  requiresHumanApproval: false,
  escalationRules: "Security reports, legal or fraud disputes, complaints about a person, and anything about someone's safety go to a person at once. If the answer is not in approved content, say so and offer a callback.",
} as const;

export const SUPPORT_BASE_PROMPT = [
  "You are the IO SKY support assistant.",
  "Answer general questions only with answer_faq or approved documentation. If nothing matches, say you do not have that information and offer to arrange a callback. Never guess and never answer from general knowledge.",
  "You can give details of a customer's own tickets, or open a ticket for them, only after they are verified. If they are not verified, explain that they need to sign in to the portal and offer a callback instead.",
  "Never ask for or accept card numbers, passwords or one-time codes. If someone starts to read one out, stop them.",
  "You cannot resolve a ticket, give a refund, change an account or promise a time. You open a record and a person follows up.",
  "If the caller reports a security problem, a legal or fraud dispute, or says anyone may be in danger, stop and hand over to a person immediately.",
].join("\n");

export type HandoverCategory = "security" | "legal" | "safety";

export type Triage = { handOver: boolean; category: HandoverCategory | null; priorityFloor: "urgent" | "high" | null };

const PATTERNS: Array<{ category: HandoverCategory; floor: "urgent" | "high"; re: RegExp }> = [
  { category: "safety", floor: "urgent", re: /\b(suicid\w*|self[- ]?harm|kill (myself|him|her|them)|in danger|emergency|threaten\w*)\b/i },
  { category: "security", floor: "urgent", re: /\b(hack(ed|ers?)?|breach(ed)?|compromis(ed|e)|unauthori[sz]ed (access|login|charge|transaction)|account (was )?(stolen|taken over)|phishing|ransom\w*|data leak(ed)?|leaked)\b/i },
  { category: "legal", floor: "high", re: /\b(lawyer|solicitor|attorney|sue|suing|lawsuit|legal action|court|chargeback|fraud\w*|dispute (the|this) (charge|invoice)|gdpr (request|complaint)|regulator)\b/i },
];

/** Whether the words call for a person. Deterministic, and conservative: a false alarm costs a phone call, a miss costs far more. */
export function triageSupportRequest(text: string): Triage {
  const t = text ?? "";
  for (const p of PATTERNS) if (p.re.test(t)) return { handOver: true, category: p.category, priorityFloor: p.floor };
  return { handOver: false, category: null, priorityFloor: null };
}

const RANK = { low: 0, normal: 1, high: 2, urgent: 3 } as const;
export type TicketPriority = keyof typeof RANK;

/** The higher of the requested priority and the floor the triage sets. Never lowers a priority. */
export function applyPriorityFloor(requested: TicketPriority, floor: "urgent" | "high" | null): TicketPriority {
  if (!floor) return requested;
  return RANK[requested] >= RANK[floor] ? requested : floor;
}

export const TICKET_CATEGORIES = ["general", "billing", "technical", "security"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** A security report is always filed under security, whatever category was asked for. */
export function categoryFor(requested: TicketCategory, triage: Triage): TicketCategory {
  return triage.category === "security" ? "security" : requested;
}

export const TICKET_REF = /^T-?[A-Z0-9]{4,30}$/i;

/** Marks a ticket the assistant opened, so staff know it was not typed by the customer. */
export const AI_TICKET_NOTE = "[Opened by the AI support assistant for a verified caller; the caller's own words follow.]";

export function composeTicketBody(body: string): string {
  return `${AI_TICKET_NOTE}\n\n${body.trim()}`.slice(0, 4000);
}
