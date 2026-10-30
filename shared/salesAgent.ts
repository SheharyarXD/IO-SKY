/**
 * The AI Sales Agent (task G11; SRS 14.16, 19.5; 29 Oct Ch5, Ch9): its definition,
 * base prompt and the safety net that keeps it from making commitments. Pure rules.
 * Like the Support Agent it is a definition on the shared runtime: everything it may
 * do is a tool the registry lists, checked by the same pipeline as every other agent.
 * (The existing lead qualifier, server/leadEvaluation.ts, is a separate one-shot
 * evaluation and is not changed by this.)
 *
 * DECISION (engineering, to be matched against the client document):
 *   - it talks to PROSPECTS, so every tool it has is Level 1 (public). It has no
 *     access to any existing client's account, records or invoices;
 *   - it may find or create a prospect record, add notes and the discovery
 *     qualification, create a follow-up, offer and book discovery-call times, and
 *     arrange a callback; it may answer general questions from approved content;
 *   - it NEVER quotes a price, offers a discount, agrees terms, promises results or
 *     speaks about a contract. Those questions are deflected to a discovery call or
 *     a person. Security, legal and safety matters go to a person at once;
 *   - authority is ACT WITH APPROVAL: reading and creating internal records run at once, but booking,
 *     moving or cancelling a discovery call (an action that emails the guest) is held for a person to
 *     approve before it takes effect. Draft-only authority would refuse booking altogether, and full
 *     autonomy would send customer emails unreviewed. The owner can raise it in the agent registry;
 *   - it is registered DISABLED and enabled by a super admin after review.
 */
import { triageSupportRequest, type Triage } from "./supportAgent";

export const SALES_AGENT_KEY = "ai_sales_agent";

export const SALES_AGENT = {
  key: SALES_AGENT_KEY,
  name: "AI Sales Agent",
  purpose: "Welcomes prospects, answers general questions from approved content, captures why they are interested, and books a discovery call or arranges a callback. Never quotes prices or makes commitments.",
  businessFunction: "Sales and lead qualification",
  permissions: ["converse", "search_knowledge", "call_context", "crm_read", "crm_write", "scheduling_read", "scheduling_write", "callback_write"],
  tools: [
    "answer_faq",
    "search_knowledge_base_articles",
    "search_product_documentation",
    "crm_find_contact",
    "crm_create_prospect",
    "crm_add_note",
    "crm_create_follow_up",
    "crm_fill_lead_details",
    "capture_discovery_qualification",
    "scheduling_find_slots",
    "scheduling_get_booking",
    "scheduling_book",
    "scheduling_reschedule",
    "scheduling_cancel",
    "request_callback",
    "remember_caller_detail",
    "recall_conversation_details",
    "forget_caller_detail",
  ],
  knowledgeSources: ["knowledge_base_articles", "product_documentation"],
  supportedModules: ["crm", "scheduling", "sales"],
  capabilities: ["answer_general_questions", "create_prospect", "capture_qualification", "book_discovery_call", "request_callback"],
  maxAuthority: "act_with_approval",
  requiresHumanApproval: false,
  escalationRules: "Pricing, discounts, contract terms, guarantees, existing clients' accounts, security, legal or fraud matters, and anyone distressed go to a person. Offer a discovery call or a callback instead of answering.",
} as const;

export const SALES_BASE_PROMPT = [
  "You are the IO SKY sales assistant, speaking with people who are interested in IO SKY's services.",
  "Be warm and brief. Find out why they are interested: the problem they want help with and what a good outcome would look like. Record what they tell you.",
  "Answer general questions only with approved content. If you do not have the information, say so and offer a discovery call or a callback. Never guess.",
  "Never state a price, a discount, a timeline guarantee, a result, or contract terms, and never agree to any. Say a person will discuss that on a discovery call, and offer to book one.",
  "Before booking, confirm the details with the caller. A booking you request is held for a person to approve, so say the team will confirm it, and only say it is booked when the result says it is confirmed.",
  "You cannot see anyone's existing account, invoices or records. If someone says they are an existing client, say they can sign in to the portal or you can arrange a callback.",
  "Never ask for or accept card numbers, passwords or one-time codes.",
  "If the caller raises a security problem, a legal or fraud dispute, or seems distressed or in danger, stop and hand over to a person immediately.",
].join("\n");

export type SalesTriage =
  | { action: "proceed" }
  | { action: "defer_to_human"; topic: "pricing" | "contract" | "guarantee" }
  | { action: "hand_over"; category: NonNullable<Triage["category"]> };

const DEFER: Array<{ topic: "pricing" | "contract" | "guarantee"; re: RegExp }> = [
  { topic: "pricing", re: /\b(price|prices|pricing|how much|cost|costs|quote|quotation|discount|cheaper|rates?|budget of|fees?|per hour|per month|free trial)\b/i },
  { topic: "contract", re: /\b(contract|terms|sla|service level|agreement|notice period|liability|nda|exclusivity|payment terms)\b/i },
  { topic: "guarantee", re: /\b(guarantee|guaranteed|promise|will you commit|money[- ]back|refund|roi|return on investment)\b/i },
];

/**
 * What to do with what the prospect just said. Safety matters come first and go to a person; commercial
 * commitments are deflected to a human conversation. Deterministic, English only, deliberately cautious.
 */
export function triageSalesRequest(text: string): SalesTriage {
  const safety = triageSupportRequest(text);
  if (safety.handOver && safety.category) return { action: "hand_over", category: safety.category };
  for (const d of DEFER) if (d.re.test(text ?? "")) return { action: "defer_to_human", topic: d.topic };
  return { action: "proceed" };
}

export const DEFER_INSTRUCTION: Record<"pricing" | "contract" | "guarantee", string> = {
  pricing: "Do not give any figure or range. Say pricing depends on their situation and that a person will go through it on a discovery call, then offer to book one.",
  contract: "Do not discuss contract terms. Say a person will cover that on a discovery call, then offer to book one.",
  guarantee: "Do not promise or guarantee any result, saving or timeline. Say a person can talk through what is realistic on a discovery call, then offer to book one.",
};
