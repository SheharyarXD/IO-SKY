/*
 * G04 (SRS 19.25; 29 Oct Ch5): multi-provider priority, fallback and budget limits.
 * Everything here is local: providers are fakes, fetch is stubbed, and fake key
 * values are used. No real provider is contacted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BREAKER,
  BUDGET_WARN_AT,
  CircuitBreaker,
  classifyFailure,
  evaluateBudget,
  hasBudget,
  MAX_PROVIDERS,
  modelFor,
  parseBudget,
  parseProviders,
  planAttempts,
  spendWindows,
  type ProviderConfig,
} from "../shared/providerRouting";
import { AllProvidersFailedError, invokeRouted, LlmBudgetError, type RouterDeps, type RouterEvent } from "./llmRouter";

const T0 = 1_800_000_000_000;
const SECOND = 1000;

describe("parsing the provider list", () => {
  const entry = (over: Record<string, unknown> = {}) => ({ name: "primary", apiUrl: "https://api.one.example/v1/chat/completions", apiKeyEnv: "ONE_API_KEY", ...over });

  it("uses the single existing provider when there is no list, with the same behaviour as before", () => {
    expect(parseProviders({ LLM_API_URL: "https://x.example/v1", LLM_API_KEY: "k" })).toMatchObject({ source: "single", providers: [{ name: "default", apiUrl: "https://x.example/v1", apiKeyEnv: "LLM_API_KEY", model: null }], problems: [] });
    expect(parseProviders({ OPENAI_API_KEY: "k" }).providers[0]).toMatchObject({ apiUrl: "https://api.openai.com/v1/chat/completions", apiKeyEnv: "OPENAI_API_KEY" });
    expect(parseProviders({})).toEqual({ providers: [], problems: [], source: "none" });
  });

  it("orders providers by priority, then by position", () => {
    const r = parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ name: "b", priority: 2 }), entry({ name: "a", priority: 1 }), entry({ name: "c", priority: 2 })]) });
    expect(r.source).toBe("list");
    expect(r.providers.map((p) => p.name)).toEqual(["a", "b", "c"]);
    expect(parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ name: "x" }), entry({ name: "y" })]) }).providers.map((p) => p.name)).toEqual(["x", "y"]);
  });

  it("keys are named, never carried: an entry that supplies a key itself has it ignored", () => {
    const r = parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ apiKey: "sk-LEAK-ME", key: "sk-LEAK-ME" })]) });
    expect(JSON.stringify(r)).not.toContain("sk-LEAK-ME");
    expect(r.providers[0].apiKeyEnv).toBe("ONE_API_KEY");
  });

  it("rejects bad entries one by one and reports why, keeping the good ones", () => {
    const r = parseProviders({
      LLM_PROVIDERS_JSON: JSON.stringify([
        entry({ name: "ok" }),
        entry({ name: "Bad Name!" }),
        entry({ name: "plain", apiUrl: "http://api.example.com/v1" }),
        entry({ name: "creds", apiUrl: "https://user:pass@api.example.com/v1" }),
        entry({ name: "nourl", apiUrl: "not a url" }),
        entry({ name: "lowerenv", apiKeyEnv: "one_api_key" }),
        entry({ name: "ok" }),
        entry({ name: "model", model: "x".repeat(200) }),
        null,
      ]),
    });
    expect(r.providers.map((p) => p.name)).toEqual(["ok"]);
    expect(r.problems).toEqual(expect.arrayContaining(["provider_2_bad_name", "plain_bad_url", "creds_bad_url", "nourl_bad_url", "lowerenv_bad_key_variable", "ok_duplicate", "model_bad_model", "provider_9_bad_name"]));
  });

  it("allows plain http only for a local endpoint", () => {
    const ok = parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ name: "local", apiUrl: "http://localhost:11434/v1/chat/completions" })]) });
    expect(ok.providers).toHaveLength(1);
    expect(parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ name: "x", apiUrl: "http://10.0.0.5/v1" })]) }).providers).toHaveLength(0);
  });

  it("falls back to the known-good single provider when the list is broken or empty, and says so", () => {
    const env = { LLM_API_URL: "https://x.example/v1", LLM_API_KEY: "k" };
    expect(parseProviders({ ...env, LLM_PROVIDERS_JSON: "{not json" })).toMatchObject({ source: "single", problems: ["providers_json_invalid"] });
    expect(parseProviders({ ...env, LLM_PROVIDERS_JSON: '{"a":1}' })).toMatchObject({ source: "single", problems: ["providers_json_not_a_list"] });
    expect(parseProviders({ ...env, LLM_PROVIDERS_JSON: "[]" })).toMatchObject({ source: "single", problems: ["providers_json_empty"] });
    expect(parseProviders({ LLM_PROVIDERS_JSON: "[]" }).providers).toEqual([]);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 9 }, (_, i) => entry({ name: `p${i}` }));
    const r = parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify(many) });
    expect(r.providers).toHaveLength(MAX_PROVIDERS);
  });

  it("a provider's pinned model wins, otherwise the task-class routing applies", () => {
    const pinned = { ...parseProviders({ LLM_PROVIDERS_JSON: JSON.stringify([entry({ model: "model-x" })]) }).providers[0] };
    expect(modelFor(pinned, "simple", {})).toBe("model-x");
    expect(modelFor({ ...pinned, model: null }, "complex", { LLM_MODEL_COMPLEX: "big" })).toBe("big");
  });
});

describe("classifying failures", () => {
  it("fails over for provider problems and not for a rejected request", () => {
    const table: Array<[Parameters<typeof classifyFailure>[0], string, boolean, boolean]> = [
      [{ timeout: true }, "timeout", true, true],
      [{ network: true }, "unreachable", true, true],
      [{ status: 429 }, "rate_limited", true, true],
      [{ status: 503 }, "server_error", true, true],
      [{ status: 500 }, "server_error", true, true],
      [{ status: 401 }, "auth", true, true],
      [{ status: 403 }, "auth", true, true],
      [{ status: 404 }, "provider_not_found", true, true],
      [{ status: 408 }, "timeout", true, true],
      [{ missingKey: true }, "misconfigured", true, false],
      [{ status: 400 }, "request_rejected", false, false],
      [{ status: 422 }, "request_rejected", false, false],
      [{ status: 413 }, "request_rejected", false, false],
      [{}, "unknown", false, false],
      [{ status: 302 }, "unknown", false, false],
    ];
    for (const [input, kind, fallback, counts] of table) expect(classifyFailure(input), JSON.stringify(input)).toEqual({ kind, fallback, countsAgainstProvider: counts });
  });
});

describe("circuit breaker", () => {
  it("opens after repeated failures, stays shut out for the cooldown, then allows a probe", () => {
    const b = new CircuitBreaker();
    for (let i = 0; i < BREAKER.failureThreshold - 1; i++) b.onFailure("a", T0);
    expect(b.canAttempt("a", T0)).toBe(true);
    b.onFailure("a", T0);
    expect(b.canAttempt("a", T0)).toBe(false);
    expect(b.state("a", T0)).toBe("open");
    expect(b.canAttempt("a", T0 + BREAKER.baseCooldownMs - 1)).toBe(false);
    expect(b.canAttempt("a", T0 + BREAKER.baseCooldownMs)).toBe(true);
    expect(b.state("a", T0 + BREAKER.baseCooldownMs)).toBe("half_open");
  });
  it("a failed probe reopens at once for longer, up to the cap, and a success closes it fully", () => {
    const b = new CircuitBreaker();
    for (let i = 0; i < 3; i++) b.onFailure("a", T0);
    const t1 = T0 + BREAKER.baseCooldownMs;
    b.onFailure("a", t1); // the probe fails
    expect(b.canAttempt("a", t1 + BREAKER.baseCooldownMs)).toBe(false);
    expect(b.canAttempt("a", t1 + 2 * BREAKER.baseCooldownMs)).toBe(true);
    let t = t1;
    for (let i = 0; i < 12; i++) {
      t += BREAKER.maxCooldownMs;
      b.onFailure("a", t);
    }
    expect(b.canAttempt("a", t + BREAKER.maxCooldownMs - 1)).toBe(false);
    expect(b.canAttempt("a", t + BREAKER.maxCooldownMs)).toBe(true);
    b.onSuccess("a");
    expect(b.state("a", t)).toBe("closed");
    b.onFailure("a", t);
    expect(b.canAttempt("a", t)).toBe(true); // the count started again from zero
  });
  it("providers are independent, and a success between failures keeps the circuit shut", () => {
    const b = new CircuitBreaker();
    for (let i = 0; i < 3; i++) b.onFailure("a", T0);
    expect(b.canAttempt("b", T0)).toBe(true);
    const c = new CircuitBreaker();
    c.onFailure("c", T0);
    c.onFailure("c", T0);
    c.onSuccess("c");
    c.onFailure("c", T0);
    expect(c.canAttempt("c", T0)).toBe(true);
  });
  it("planAttempts leaves out open circuits and keeps the priority order", () => {
    const ps: ProviderConfig[] = ["a", "b", "c"].map((name, priority) => ({ name, apiUrl: "https://x", apiKeyEnv: "K", model: null, priority }));
    const b = new CircuitBreaker();
    for (let i = 0; i < 3; i++) b.onFailure("a", T0);
    expect(planAttempts(ps, b, T0).map((p) => p.name)).toEqual(["b", "c"]);
    expect(planAttempts(ps, b, T0 + BREAKER.baseCooldownMs).map((p) => p.name)).toEqual(["a", "b", "c"]);
  });
});

describe("budget", () => {
  it("is read in USD from the environment; bad values are reported and ignored", () => {
    expect(parseBudget({ LLM_BUDGET_DAILY_USD: "5", LLM_BUDGET_MONTHLY_USD: "100.5" }).budget).toEqual({ dailyMicros: 5_000_000, monthlyMicros: 100_500_000 });
    expect(parseBudget({}).budget).toEqual({ dailyMicros: null, monthlyMicros: null });
    const bad = parseBudget({ LLM_BUDGET_DAILY_USD: "abc", LLM_BUDGET_MONTHLY_USD: "-3" });
    expect(bad.budget).toEqual({ dailyMicros: null, monthlyMicros: null });
    expect(bad.problems).toEqual(["daily_budget_invalid", "monthly_budget_invalid"]);
    expect(hasBudget({ dailyMicros: null, monthlyMicros: null })).toBe(false);
    expect(hasBudget({ dailyMicros: 1, monthlyMicros: null })).toBe(true);
  });
  it("blocks at the limit (not after it), on either window, and warns before that", () => {
    const budget = { dailyMicros: 1000, monthlyMicros: 10_000 };
    expect(evaluateBudget({ budget, spentTodayMicros: 999, spentMonthMicros: 0 })).toMatchObject({ allowed: true, warn: true });
    expect(evaluateBudget({ budget, spentTodayMicros: 1000, spentMonthMicros: 0 })).toEqual({ allowed: false, reason: "daily_budget_exhausted" });
    expect(evaluateBudget({ budget, spentTodayMicros: 0, spentMonthMicros: 10_000 })).toEqual({ allowed: false, reason: "monthly_budget_exhausted" });
    expect(evaluateBudget({ budget, spentTodayMicros: 1000, spentMonthMicros: 10_000 })).toEqual({ allowed: false, reason: "daily_budget_exhausted" });
    expect(evaluateBudget({ budget, spentTodayMicros: 100, spentMonthMicros: 100 })).toEqual({ allowed: true, warn: false, usedFraction: 0.1 });
    expect(evaluateBudget({ budget, spentTodayMicros: 1000 * BUDGET_WARN_AT, spentMonthMicros: 0 })).toMatchObject({ warn: true });
  });
  it("an unset window never blocks", () => {
    expect(evaluateBudget({ budget: { dailyMicros: null, monthlyMicros: 100 }, spentTodayMicros: 1e12, spentMonthMicros: 99 })).toMatchObject({ allowed: true });
  });
  it("spend windows are UTC days and months", () => {
    const w = spendWindows(Date.UTC(2026, 9, 30, 23, 59, 59));
    expect(new Date(w.dayStartMs).toISOString()).toBe("2026-10-30T00:00:00.000Z");
    expect(new Date(w.monthStartMs).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// the orchestrator
// ---------------------------------------------------------------------------

const providers: ProviderConfig[] = [
  { name: "primary", apiUrl: "https://one.example", apiKeyEnv: "ONE_KEY", model: null, priority: 0 },
  { name: "backup", apiUrl: "https://two.example", apiKeyEnv: "TWO_KEY", model: null, priority: 1 },
];
type Fail = { status?: number; timeout?: boolean; network?: boolean };
class Boom extends Error {
  constructor(readonly info: Fail) {
    super("boom with secret sk-SHOULD-NOT-APPEAR");
  }
}

function harness(over: Partial<RouterDeps<string, string>> & { script?: Record<string, Array<string | Fail>> } = {}) {
  const events: RouterEvent[] = [];
  const calls: string[] = [];
  let now = T0;
  const script = over.script ?? { primary: ["ok-primary"], backup: ["ok-backup"] };
  const cursor: Record<string, number> = {};
  const deps: RouterDeps<string, string> = {
    providers,
    budget: { dailyMicros: null, monthlyMicros: null },
    breaker: new CircuitBreaker(),
    now: () => now,
    spend: async () => ({ todayMicros: 0, monthMicros: 0 }),
    call: async (p) => {
      calls.push(p.name);
      const list = script[p.name] ?? [];
      const step = list[Math.min(cursor[p.name] ?? 0, list.length - 1)];
      cursor[p.name] = (cursor[p.name] ?? 0) + 1;
      if (typeof step === "string") return step;
      throw new Boom(step ?? { status: 500 });
    },
    describeFailure: (e) => (e instanceof Boom ? e.info : {}),
    onEvent: (e) => events.push(e),
    ...over,
  };
  return { deps, events, calls, advance: (ms: number) => (now += ms) };
}

describe("invokeRouted", () => {
  it("uses the first provider when it works, and never touches the others", async () => {
    const h = harness();
    await expect(invokeRouted("req", h.deps)).resolves.toBe("ok-primary");
    expect(h.calls).toEqual(["primary"]);
    expect(h.events).toEqual([]);
  });

  it("falls over to the next provider on a provider failure and reports it", async () => {
    for (const fail of [{ status: 503 }, { status: 429 }, { timeout: true }, { network: true }, { status: 401 }] as Fail[]) {
      const h = harness({ script: { primary: [fail], backup: ["ok-backup"] } });
      await expect(invokeRouted("req", h.deps), JSON.stringify(fail)).resolves.toBe("ok-backup");
      expect(h.calls).toEqual(["primary", "backup"]);
      expect(h.events.map((e) => e.type)).toEqual(["fallback", "served_by_fallback"]);
    }
  });

  it("does not replay a rejected request to another provider", async () => {
    const h = harness({ script: { primary: [{ status: 400 }], backup: ["ok-backup"] } });
    await expect(invokeRouted("req", h.deps)).rejects.toBeInstanceOf(Boom);
    expect(h.calls).toEqual(["primary"]);
    // and an unclassifiable error is not retried elsewhere either
    const u = harness({ script: { primary: [{}], backup: ["ok-backup"] } });
    await expect(invokeRouted("req", u.deps)).rejects.toBeInstanceOf(Boom);
    expect(u.calls).toEqual(["primary"]);
  });

  it("raises one error naming every provider and failure kind when all fail, with no secret in it", async () => {
    const h = harness({ script: { primary: [{ status: 503 }], backup: [{ timeout: true }] } });
    const err = await invokeRouted("req", h.deps).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(err.attempts).toEqual([{ provider: "primary", kind: "server_error" }, { provider: "backup", kind: "timeout" }]);
    expect(err.message).toBe("All AI providers failed (primary: server_error, backup: timeout).");
    expect(err.message).not.toContain("sk-SHOULD-NOT-APPEAR");
  });

  it("after repeated failures skips the dead provider, then probes it again after the cooldown", async () => {
    const h = harness({ script: { primary: [{ status: 503 }, { status: 503 }, { status: 503 }, "ok-primary"], backup: ["ok-backup"] } });
    for (let i = 0; i < 3; i++) await invokeRouted("req", h.deps);
    expect(h.calls).toEqual(["primary", "backup", "primary", "backup", "primary", "backup"]);
    h.calls.length = 0;
    await invokeRouted("req", h.deps); // circuit open: straight to the backup
    expect(h.calls).toEqual(["backup"]);
    h.advance(BREAKER.baseCooldownMs);
    h.calls.length = 0;
    await expect(invokeRouted("req", h.deps)).resolves.toBe("ok-primary"); // the probe succeeds and the primary is back
    expect(h.calls).toEqual(["primary"]);
  });

  it("with every circuit open it fails fast and says nobody was tried", async () => {
    const h = harness({ script: { primary: [{ status: 503 }], backup: [{ status: 503 }] } });
    for (let i = 0; i < 3; i++) await invokeRouted("req", h.deps).catch(() => undefined);
    h.calls.length = 0;
    const err = await invokeRouted("req", h.deps).catch((e) => e);
    expect(err).toBeInstanceOf(AllProvidersFailedError);
    expect(err.attempts).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it("a missing key skips that provider without counting it as an outage", async () => {
    const h = harness({
      script: { backup: ["ok-backup"] },
      call: async (p) => {
        if (p.name === "primary") throw new Boom({ missingKey: true } as never);
        return "ok-backup";
      },
    });
    for (let i = 0; i < 5; i++) await invokeRouted("req", h.deps);
    expect(h.deps.breaker.state("primary", T0)).toBe("closed");
  });

  describe("budget", () => {
    const budget = { dailyMicros: 1_000_000, monthlyMicros: null };
    it("refuses before any provider is called when the limit is reached, and raises the event", async () => {
      const h = harness({ budget, spend: async () => ({ todayMicros: 1_000_000, monthMicros: 0 }) });
      const err = await invokeRouted("req", h.deps).catch((e) => e);
      expect(err).toBeInstanceOf(LlmBudgetError);
      expect(err.reason).toBe("daily_budget_exhausted");
      expect(h.calls).toEqual([]);
      expect(h.events).toEqual([{ type: "budget_blocked", reason: "daily_budget_exhausted" }]);
    });
    it("fails closed when spend cannot be read", async () => {
      const h = harness({ budget, spend: async () => { throw new Error("db down"); } });
      const err = await invokeRouted("req", h.deps).catch((e) => e);
      expect(err).toBeInstanceOf(LlmBudgetError);
      expect(err.reason).toBe("budget_unavailable");
      expect(h.calls).toEqual([]);
    });
    it("lets the call through with a warning when close to the limit", async () => {
      const h = harness({ budget, spend: async () => ({ todayMicros: 850_000, monthMicros: 0 }) });
      await expect(invokeRouted("req", h.deps)).resolves.toBe("ok-primary");
      expect(h.events).toEqual([{ type: "budget_warning", usedFraction: 0.85 }]);
    });
    it("without a budget the spend is never read, so a broken usage store cannot block AI", async () => {
      const spend = vi.fn(async () => { throw new Error("should not be called"); });
      const h = harness({ spend });
      await expect(invokeRouted("req", h.deps)).resolves.toBe("ok-primary");
      expect(spend).not.toHaveBeenCalled();
    });
  });

  it("an observer that throws cannot break the call", async () => {
    const h = harness({ script: { primary: [{ status: 503 }], backup: ["ok-backup"] }, onEvent: () => { throw new Error("observer bug"); } });
    await expect(invokeRouted("req", h.deps)).resolves.toBe("ok-backup");
  });
});

// ---------------------------------------------------------------------------
// the real invokeLLM with fetch stubbed
// ---------------------------------------------------------------------------

vi.mock("./_core/llmUsage", () => ({
  recordLlmUsage: vi.fn(),
  readLlmSpend: vi.fn(async () => ({ todayMicros: 0, monthMicros: 0, unpricedCalls: 0 })),
}));

import { invokeLLM, llmRoutingStatus, resetLlmRouterForTests } from "./_core/llm";
import * as usage from "./_core/llmUsage";

const ORIGINAL_ENV = { ...process.env };
const okBody = (model: string) => JSON.stringify({ id: "x", created: 0, model, choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }] });

describe("invokeLLM with routing configured", () => {
  beforeEach(() => {
    for (const k of ["LLM_API_URL", "LLM_API_KEY", "LLM_MODEL", "OPENAI_API_KEY", "LLM_PROVIDERS_JSON", "LLM_BUDGET_DAILY_USD", "LLM_BUDGET_MONTHLY_USD", "ONE_KEY", "TWO_KEY"]) delete process.env[k];
    resetLlmRouterForTests();
    vi.mocked(usage.readLlmSpend).mockResolvedValue({ todayMicros: 0, monthMicros: 0, unpricedCalls: 0 });
    process.env.LLM_PROVIDERS_JSON = JSON.stringify([
      { name: "primary", apiUrl: "https://one.example/v1/chat/completions", apiKeyEnv: "ONE_KEY", model: "model-one" },
      { name: "backup", apiUrl: "https://two.example/v1/chat/completions", apiKeyEnv: "TWO_KEY", model: "model-two" },
    ]);
    process.env.ONE_KEY = "fake-key-one";
    process.env.TWO_KEY = "fake-key-two";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("calls the primary with its own URL, key and pinned model", async () => {
    const fetchMock = vi.fn(async () => new Response(okBody("model-one"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://one.example/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer fake-key-one");
    expect(JSON.parse(init.body as string).model).toBe("model-one");
  });

  it("falls over to the backup on a 503, using the backup's URL, key and model, and never sends one provider's key to the other", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.startsWith("https://one.example") ? new Response("unavailable", { status: 503, statusText: "Service Unavailable" }) : new Response(okBody("model-two"), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    const out = await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect(out.model).toBe("model-two");
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map((c) => c[0])).toEqual(["https://one.example/v1/chat/completions", "https://two.example/v1/chat/completions"]);
    expect((calls[0][1].headers as Record<string, string>).authorization).toBe("Bearer fake-key-one");
    expect((calls[1][1].headers as Record<string, string>).authorization).toBe("Bearer fake-key-two");
    expect(JSON.parse(calls[1][1].body as string).model).toBe("model-two");
  });

  it("does not try the backup when the request itself is rejected", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400, statusText: "Bad Request" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/LLM invoke failed: 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips a provider whose key variable is not set", async () => {
    delete process.env.ONE_KEY;
    const fetchMock = vi.fn(async () => new Response(okBody("model-two"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://two.example/v1/chat/completions");
  });

  it("refuses with the budget error and calls nobody when the daily limit is reached", async () => {
    process.env.LLM_BUDGET_DAILY_USD = "1";
    vi.mocked(usage.readLlmSpend).mockResolvedValue({ todayMicros: 1_000_000, monthMicros: 1_000_000, unpricedCalls: 0 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/daily spending limit/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a budget on its own (no provider list) still applies to the single provider", async () => {
    delete process.env.LLM_PROVIDERS_JSON;
    process.env.LLM_API_URL = "https://solo.example/v1/chat/completions";
    process.env.LLM_API_KEY = "fake-solo";
    process.env.LLM_BUDGET_MONTHLY_USD = "10";
    vi.mocked(usage.readLlmSpend).mockResolvedValue({ todayMicros: 0, monthMicros: 10_000_000, unpricedCalls: 0 });
    vi.stubGlobal("fetch", vi.fn());
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/monthly spending limit/);
    vi.mocked(usage.readLlmSpend).mockResolvedValue({ todayMicros: 0, monthMicros: 1, unpricedCalls: 0 });
    const ok = vi.fn(async () => new Response(okBody("m"), { status: 200 }));
    vi.stubGlobal("fetch", ok);
    await invokeLLM({ messages: [{ role: "user", content: "hi" }] });
    expect((ok.mock.calls[0] as unknown as [string])[0]).toBe("https://solo.example/v1/chat/completions");
  });

  it("a budget with no provider at all still gives the usual configuration error", async () => {
    delete process.env.LLM_PROVIDERS_JSON;
    process.env.LLM_BUDGET_DAILY_USD = "1";
    await expect(invokeLLM({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/No LLM provider is configured/);
  });

  it("the status report never contains a key or a key variable's value", () => {
    const s = llmRoutingStatus();
    const text = JSON.stringify(s);
    expect(text).not.toContain("fake-key-one");
    expect(text).not.toContain("fake-key-two");
    expect(s.providers).toEqual([
      { name: "primary", priority: 0, apiHost: "one.example", model: "model-one", keyConfigured: true, circuit: "closed" },
      { name: "backup", priority: 1, apiHost: "two.example", model: "model-two", keyConfigured: true, circuit: "closed" },
    ]);
    delete process.env.TWO_KEY;
    expect(llmRoutingStatus().providers[1].keyConfigured).toBe(false);
  });
});
