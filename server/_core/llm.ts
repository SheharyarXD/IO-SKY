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
const DEFAULT_MODEL = "gpt-4o-mini";
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

const resolveModel = () => process.env.LLM_MODEL || DEFAULT_MODEL;

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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const apiUrl = resolveApiUrl();
  const apiKey = resolveApiKey();

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
    model: resolveModel(),
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
      throw new Error(`LLM invoke timed out after ${timeoutMs}ms`);
    }
    throw new Error(
      `LLM invoke failed to reach the provider: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error(
        `LLM invoke rate-limited by provider (429)${errorText ? `: ${errorText}` : ""}`,
      );
    }
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
