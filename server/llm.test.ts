/**
 * server/_core/llm.ts — direct LLM provider integration (Milestone 2 §2.2,
 * replacing the Forge/Manus LLM proxy). Provider-neutral: any
 * OpenAI-Chat-Completions-compatible endpoint works via env config alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";

const ORIGINAL_ENV = { ...process.env };

describe("invokeLLM (Milestone 2 §2.2)", () => {
  beforeEach(() => {
    delete process.env.LLM_API_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("throws a clear config error when LLM_API_URL is unset — no silent fallback to a hardcoded Manus/Forge URL", async () => {
    process.env.LLM_API_KEY = "sk-test";
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /LLM_API_URL is not configured/,
    );
  });

  it("throws a clear config error when LLM_API_KEY is unset", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /LLM_API_KEY is not configured/,
    );
  });

  it("sends the configured model/url/key and defaults max_tokens", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "sk-test-key";
    process.env.LLM_MODEL = "gpt-4o";

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: "x", created: 0, model: "gpt-4o", choices: [] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer sk-test-key",
      "content-type": "application/json",
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.max_tokens).toBe(32768);
  });

  it("respects an explicit maxTokens override instead of always sending the hardcoded default", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "sk-test-key";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "x", created: 0, model: "m", choices: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({ messages: [{ role: "user", content: "hi" }], maxTokens: 512 });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.max_tokens).toBe(512);
  });

  it("surfaces a clear rate-limit error on HTTP 429", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "sk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("slow down", { status: 429, statusText: "Too Many Requests" })),
    );

    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /rate-limited/i,
    );
  });

  it("surfaces a clear error for other non-OK responses", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "sk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bad key", { status: 401, statusText: "Unauthorized" })),
    );

    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /401/,
    );
  });

  it("wraps a network failure in a clear error rather than letting a raw fetch rejection propagate", async () => {
    process.env.LLM_API_URL = "https://api.example.com/v1/chat/completions";
    process.env.LLM_API_KEY = "sk-test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(
      /failed to reach the provider/,
    );
  });
});
