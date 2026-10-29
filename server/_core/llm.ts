import { routeModel, type TaskComplexity } from "../../shared/modelRouting";
import { recordLlmUsage } from "./llmUsage";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  /** How demanding the task is; picks the model through shared/modelRouting. Defaults to complex. */
  complexity?: TaskComplexity;
  /** Short label for usage reporting, e.g. "ai_scan.scoring". */
  purpose?: string;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

/**
 * Milestone 2 §2.2 — direct provider integration, replacing the Forge/Manus
 * LLM proxy. Deliberately reads process.env fresh at call time rather than
 * a frozen ENV snapshot (same reasoning as server/_core/env.ts's
 * getOwnerNotifyConfig()/getCookieSecretBytes()).
 *
 * Provider-neutral by design rather than hardcoded to one vendor: the
 * request/response shape this module speaks (messages[], response_format
 * json_schema, choices[].message.content) is OpenAI's Chat Completions
 * wire protocol, which is also what AiScanScoring.ts already expects back
 * — and is also what OpenAI itself, Azure OpenAI, and Google's Gemini
 * OpenAI-compatibility endpoint (among others) all accept directly, with
 * no translation layer. Configuring LLM_API_URL/LLM_API_KEY/LLM_MODEL for
 * whichever of those the client selects is the entire integration step;
 * no code change should be needed to switch providers within that set.
 *
 * Activation requires one credential and nothing else. Either set the
 * neutral trio (LLM_API_URL + LLM_API_KEY + LLM_MODEL) for any
 * OpenAI-compatible endpoint, or set OPENAI_API_KEY on its own and the
 * URL defaults to OpenAI's public Chat Completions endpoint. The second
 * form exists because the deployment environment already carries an
 * OPENAI_API_KEY slot; without this shortcut that variable would sit
 * populated and unread, which is a confusing way for a platform to be
 * broken.
 */
import { CircuitBreaker, hasBudget, parseBudget, parseProviders } from "../../shared/providerRouting";
import { invokeRouted, type RouterEvent } from "../llmRouter";

const DEFAULT_TIMEOUT_MS = 60_000;
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";

const readEnv = (name: string): string | null => {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveApiUrl = () => {
  const explicit = readEnv("LLM_API_URL");
  if (explicit) return explicit;
  // An OPENAI_API_KEY on its own is unambiguous about which endpoint it is
  // for, so requiring the URL as well would be busywork.
  if (readEnv("OPENAI_API_KEY")) return OPENAI_CHAT_COMPLETIONS_URL;
  throw new Error(
    "No LLM provider is configured. Set OPENAI_API_KEY, or set LLM_API_URL, LLM_API_KEY and LLM_MODEL for an OpenAI-compatible endpoint.",
  );
};

const resolveApiKey = () => {
  const key = readEnv("LLM_API_KEY") ?? readEnv("OPENAI_API_KEY");
  if (!key) {
    throw new Error(
      "No LLM credential is configured. Set OPENAI_API_KEY, or set LLM_API_KEY alongside LLM_API_URL.",
    );
  }
  return key;
};

/**
 * Whether a provider is configured at all.
 *
 * Exported so operational surfaces can report "AI scoring is not configured"
 * as a status rather than letting every scan fail one at a time and leaving
 * the reason buried in a per-row error message.
 */
export function isLlmConfigured(): boolean {
  try {
    resolveApiUrl();
    resolveApiKey();
    return true;
  } catch {
    return false;
  }
}

const resolveModel = (complexity?: TaskComplexity) => routeModel(complexity, process.env).model;

const resolveTimeoutMs = () => {
  const raw = process.env.LLM_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/** Where one call goes. `model` pins the model for this provider; null uses the task-class routing. */
type Endpoint = { apiUrl: string; apiKey: string; model: string | null };

/** A failed call, with what the router needs to decide whether another provider should be tried. */
export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly info: { status?: number; timeout?: boolean; network?: boolean; missingKey?: boolean },
  ) {
    super(message);
    this.name = "LlmCallError";
  }
}

async function invokeOnEndpoint(endpoint: Endpoint, params: InvokeParams): Promise<InvokeResult> {
  const { apiUrl, apiKey } = endpoint;

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: endpoint.model ?? resolveModel(params.complexity),
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = params.maxTokens ?? params.max_tokens ?? 32768;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const timeoutMs = resolveTimeoutMs();
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new LlmCallError(`LLM invoke timed out after ${timeoutMs}ms`, { timeout: true });
    }
    throw new LlmCallError(`LLM invoke failed to reach the provider: ${err instanceof Error ? err.message : String(err)}`, { network: true });
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new LlmCallError(`LLM invoke rate-limited by provider (429)${errorText ? `: ${errorText}` : ""}`, { status: 429 });
    }
    throw new LlmCallError(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`, { status: response.status });
  }

  const result = (await response.json()) as InvokeResult;
  recordLlmUsage({ model: result.model ?? String(payload.model), complexity: params.complexity ?? "complex", purpose: params.purpose ?? null, usage: result.usage });
  return result;
}

// ---------------------------------------------------------------------------
// Provider priority, fallback and budget (task G04)
// ---------------------------------------------------------------------------

const breaker = new CircuitBreaker();

function onRouterEvent(e: RouterEvent): void {
  console.warn(`[llm] ${e.type}`, "provider" in e ? e.provider : "failed" in e ? `${e.failed}:${e.kind}` : "reason" in e ? e.reason : "");
  if (e.type !== "budget_blocked") return;
  // An approved operational threshold being reached is a catalogue event (AO-04), raised once a day per reason.
  void import("../notificationDispatcher")
    .then((m) => m.emitNotification({ event: "AI_OPERATION_THRESHOLD_EXCEEDED", audience: { type: "admin" }, dedupeRef: `llm-budget:${e.reason}:${new Date().toISOString().slice(0, 10)}`, title: "AI calls paused by the spending limit", body: e.reason === "budget_unavailable" ? "A limit is set but spend could not be read." : `The ${e.reason === "daily_budget_exhausted" ? "daily" : "monthly"} AI spending limit was reached.`, href: "/admin/governance" }))
    .catch(() => undefined);
}

/**
 * The entry point every AI feature uses. With no provider list and no budget configured this is the single
 * provider call exactly as before. With either, the call goes through the router: spending limit first, then
 * the providers in priority order with fallback and circuit breaking.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const parsed = parseProviders(process.env);
  const { budget } = parseBudget(process.env);
  if (parsed.source !== "list" && !hasBudget(budget)) {
    return invokeOnEndpoint({ apiUrl: resolveApiUrl(), apiKey: resolveApiKey(), model: null }, params);
  }
  if (parsed.providers.length === 0) {
    resolveApiUrl(); // throws the usual "No LLM provider is configured"
    resolveApiKey();
  }
  return invokeRouted(params, {
    providers: parsed.providers,
    budget,
    breaker,
    now: () => Date.now(),
    spend: async (now) => (await import("./llmUsage")).readLlmSpend(now),
    call: async (p, prm) => {
      const apiKey = readEnv(p.apiKeyEnv);
      if (!apiKey) throw new LlmCallError(`The key variable for provider "${p.name}" is not set.`, { missingKey: true });
      return invokeOnEndpoint({ apiUrl: p.apiUrl, apiKey, model: p.model }, prm);
    },
    describeFailure: (err) => (err instanceof LlmCallError ? err.info : {}),
    onEvent: onRouterEvent,
  });
}

/** What routing is configured and how each provider is doing. Never includes a key or a key value. */
export function llmRoutingStatus(now: number = Date.now()) {
  const parsed = parseProviders(process.env);
  const b = parseBudget(process.env);
  return {
    source: parsed.source,
    providers: parsed.providers.map((p) => ({ name: p.name, priority: p.priority, apiHost: safeHost(p.apiUrl), model: p.model, keyConfigured: Boolean(readEnv(p.apiKeyEnv)), circuit: breaker.state(p.name, now) })),
    budget: { dailyUsd: b.budget.dailyMicros === null ? null : b.budget.dailyMicros / 1_000_000, monthlyUsd: b.budget.monthlyMicros === null ? null : b.budget.monthlyMicros / 1_000_000 },
    problems: [...parsed.problems, ...b.problems],
  };
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

/** Test hook: forget circuit state. */
export function resetLlmRouterForTests(): void {
  breaker.reset();
}
