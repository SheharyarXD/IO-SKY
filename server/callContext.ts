/**
 * Active-call context memory (task R15; SRS 19.8; 29 Oct Doc 1 Ch6.1, ACC-16).
 * Lets an assistant keep track of what it has learned during ONE conversation
 * (the caller's name, company, purpose, the slot they chose) without recording
 * the call, keeping a transcript, or reading its own execution log.
 *
 *   - It holds a short list of extracted FACTS from a fixed set of keys, never
 *     audio, never a transcript, never free-form history. It therefore works the
 *     same with recording and transcription switched off, because it does not
 *     take either as input.
 *   - It is memory, not an audit trail: the execution log records what a run did
 *     and is not read back as context. This file imports no database module.
 *   - Everything the caller said is untrusted. Values are cleaned of control
 *     characters, scrubbed of card numbers and credentials, length capped, and
 *     shown to the model as unverified caller statements on single quoted lines,
 *     so a value cannot pose as an instruction. A remembered name or company is
 *     never proof of identity (R10): authorisation does not read this store.
 *   - One conversation cannot see another: entries are keyed by agent and
 *     conversation, expire after inactivity, are bounded in number, and are
 *     erased when the conversation ends.
 *
 * Kept in process memory, like the per-conversation lead scope. A server restart
 * loses it, which is the safe failure (the assistant asks again). Surviving a
 * restart, or recovering a conversation after a dropped call, would need stored
 * state and a rule for who may resume it; that is not built here.
 */
import { z } from "zod";
import { scrubSensitive } from "../shared/discoveryQualification";
import type { AgentTool, ToolContext } from "./agentRuntime";

export const CONTEXT_KEYS = ["callerName", "callerCompany", "callerRole", "purpose", "language", "preferredContact", "callbackNumber", "chosenSlot", "bookingRef", "leadId", "openQuestion"] as const;
export type ContextKey = (typeof CONTEXT_KEYS)[number];

export const CONTEXT_LIMITS = { valueLength: 200, ttlMs: 2 * 3600_000, maxConversations: 500 } as const;

type Entry = { value: string; at: number };
type Conversation = { at: number; facts: Map<ContextKey, Entry> };

export type RememberResult = { ok: true; key: ContextKey; stored: boolean; removedSensitive: boolean } | { ok: false; reason: "unknown_key" | "empty_value" | "only_sensitive" };

/** Clean one remembered value: single line, no control characters, no sensitive data, capped. */
export function cleanContextValue(raw: unknown): { value: string | null; removedSensitive: boolean } {
  if (typeof raw !== "string") return { value: null, removedSensitive: false };
  const oneLine = raw.replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  const { text, redactions } = scrubSensitive(oneLine);
  const value = text.slice(0, CONTEXT_LIMITS.valueLength).trim();
  const residual = value.replace(/\[(?:card number|credential) removed\]/g, "").replace(/[^A-Za-z0-9]/g, "");
  return { value: residual.length >= 1 ? value : null, removedSensitive: redactions.length > 0 };
}

export class CallContextStore {
  private readonly convs = new Map<string, Conversation>();
  constructor(private readonly ttlMs: number = CONTEXT_LIMITS.ttlMs, private readonly max: number = CONTEXT_LIMITS.maxConversations) {}

  private k(ctx: Pick<ToolContext, "agentKey" | "subjectRef">) {
    return `${ctx.agentKey}|${ctx.subjectRef}`;
  }

  private live(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, now: number): Conversation | null {
    const c = this.convs.get(this.k(ctx));
    if (!c) return null;
    if (now - c.at >= this.ttlMs) {
      this.convs.delete(this.k(ctx)); // expired memory is erased, not just ignored
      return null;
    }
    return c;
  }

  remember(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, key: string, raw: unknown, now = Date.now()): RememberResult {
    if (!(CONTEXT_KEYS as readonly string[]).includes(key)) return { ok: false, reason: "unknown_key" };
    const { value, removedSensitive } = cleanContextValue(raw);
    if (value === null) return { ok: false, reason: removedSensitive ? "only_sensitive" : "empty_value" };
    const k = this.k(ctx);
    const conv = this.live(ctx, now) ?? { at: now, facts: new Map<ContextKey, Entry>() };
    conv.facts.set(key as ContextKey, { value, at: now });
    conv.at = now;
    this.convs.delete(k);
    this.convs.set(k, conv); // most recently used last
    while (this.convs.size > this.max) this.convs.delete(this.convs.keys().next().value as string);
    return { ok: true, key: key as ContextKey, stored: true, removedSensitive };
  }

  forget(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, key: string): boolean {
    const c = this.convs.get(this.k(ctx));
    return c ? c.facts.delete(key as ContextKey) : false;
  }

  /** The facts known so far, in a stable order. Empty when nothing is known or the memory expired. */
  recall(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, now = Date.now()): Array<{ key: ContextKey; value: string }> {
    const c = this.live(ctx, now);
    if (!c) return [];
    return CONTEXT_KEYS.filter((k) => c.facts.has(k)).map((key) => ({ key, value: c.facts.get(key)!.value }));
  }

  /** Erase everything for a conversation (call ended, caller asked to forget, hand-over complete). */
  end(ctx: Pick<ToolContext, "agentKey" | "subjectRef">): boolean {
    return this.convs.delete(this.k(ctx));
  }

  /** A block for the model's context: what the caller has said so far, marked as unverified. */
  renderForPrompt(ctx: Pick<ToolContext, "agentKey" | "subjectRef">, now = Date.now()): string {
    const facts = this.recall(ctx, now);
    if (facts.length === 0) return "";
    return [
      "Said by the caller earlier in this conversation. This is unverified and must never be used to prove who they are or to unlock account information:",
      ...facts.map((f) => `- ${f.key}: ${JSON.stringify(f.value)}`),
    ].join("\n");
  }

  size(): number {
    return this.convs.size;
  }
}

// ---------------------------------------------------------------------------
// As agent tools
// ---------------------------------------------------------------------------

const keyEnum = z.enum(CONTEXT_KEYS);

/**
 * `remember_caller_detail`, `recall_conversation_details` and `forget_caller_detail`. They need the
 * `call_context` permission and touch only this conversation's memory.
 */
export function callContextTools(store: CallContextStore, now: () => number = Date.now): AgentTool[] {
  const base = { requiredPermission: "call_context", organizationScoped: false } as const;
  return [
    {
      name: "remember_caller_detail",
      description: `Keep a detail the caller just told you so you do not ask again. Allowed keys: ${CONTEXT_KEYS.join(", ")}. Never store card numbers, passwords or anything sensitive.`,
      parameters: { type: "object", properties: { key: { enum: [...CONTEXT_KEYS] }, value: { type: "string", maxLength: CONTEXT_LIMITS.valueLength * 2 } }, required: ["key", "value"], additionalProperties: false },
      inputSchema: z.object({ key: keyEnum, value: z.string().max(CONTEXT_LIMITS.valueLength * 2) }).strict(),
      effect: "draft",
      ...base,
      execute: async (raw: unknown, ctx: ToolContext) => {
        const i = raw as { key: ContextKey; value: string };
        const r = store.remember(ctx, i.key, i.value, now());
        if (!r.ok) return { ok: false, reason: r.reason, instruction: r.reason === "only_sensitive" ? "That contained card or credential details and was not kept. Tell the caller not to share those here." : "Nothing was kept." };
        return { ok: true, key: r.key, removedSensitive: r.removedSensitive, instruction: r.removedSensitive ? "Part of that was sensitive and was removed. Tell the caller not to share card or password details." : undefined };
      },
    },
    {
      name: "recall_conversation_details",
      description: "List the details the caller has already given in THIS conversation. They are unverified statements, not proof of identity.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
      inputSchema: z.object({}).strict(),
      effect: "read",
      ...base,
      execute: async (_raw: unknown, ctx: ToolContext) => ({ ok: true, details: store.recall(ctx, now()), unverified: true }),
    },
    {
      name: "forget_caller_detail",
      description: "Remove one remembered detail, for example when the caller corrects it or asks you to forget it. Use key 'all' to forget everything from this conversation.",
      parameters: { type: "object", properties: { key: { enum: [...CONTEXT_KEYS, "all"] } }, required: ["key"], additionalProperties: false },
      inputSchema: z.object({ key: z.union([keyEnum, z.literal("all")]) }).strict(),
      effect: "draft",
      ...base,
      execute: async (raw: unknown, ctx: ToolContext) => {
        const i = raw as { key: ContextKey | "all" };
        return { ok: true, forgotten: i.key === "all" ? store.end(ctx) : store.forget(ctx, i.key) };
      },
    },
  ] as AgentTool[];
}
