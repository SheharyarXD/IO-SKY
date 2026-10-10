import { afterEach, describe, expect, it, vi } from "vitest";

const gov = vi.hoisted(() => ({
  gate: { outcome: "completed" as string, reason: "" },
  results: [] as any[],
}));
vi.mock("./db/srsGovernance", () => ({
  ensureAgent: vi.fn(async () => undefined),
  authoriseAndRecordAgentAction: vi.fn(async () => gov.gate),
  getActivePrompt: vi.fn(async () => ({ version: 2, body: "managed prompt" })),
  recordAgentResult: vi.fn(async (a: any) => {
    gov.results.push(a);
    return 41;
  }),
}));

import { integrationStatus, testIntegration } from "./integrations";
import { evaluateLead, parseLeadEvaluation } from "./leadEvaluation";

const lead = { id: 7, fullName: "Sam Example", company: "Example BV", interest: "ai-scan:growth", note: null, source: "ai-scan" };
const good = { fit: "high", summary: "Likely a fit; this is a hypothesis.", likelyService: "ai_scan", nextStep: "Book a Discovery Call", questions: ["How many sites?"] };

afterEach(() => {
  vi.restoreAllMocks();
  gov.gate = { outcome: "completed", reason: "" };
  gov.results.length = 0;
});

describe("integration status", () => {
  it("reports configured only when every required variable is set", () => {
    const rows = integrationStatus({ STRIPE_SECRET_KEY: "sk_test_x" });
    const stripe = rows.find((r) => r.key === "stripe")!;
    expect(stripe.configured).toBe(false);
    expect(stripe.missing).toEqual(["STRIPE_WEBHOOK_SECRET"]);
  });
  it("accepts either of two alternative variables", () => {
    expect(integrationStatus({ OPENAI_API_KEY: "k" }).find((r) => r.key === "openai")!.configured).toBe(true);
    expect(integrationStatus({}).find((r) => r.key === "openai")!.configured).toBe(false);
  });
  it("never includes a secret value in the status", () => {
    const json = JSON.stringify(integrationStatus({ STRIPE_SECRET_KEY: "sk_test_SECRET123", STRIPE_WEBHOOK_SECRET: "whsec_SECRET456" }));
    expect(json).not.toContain("SECRET123");
    expect(json).not.toContain("SECRET456");
  });
  it("does not call a provider that is not configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await testIntegration("stripe", {});
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("reports the mode when the Stripe key is accepted", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await testIntegration("stripe", { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "w" });
    expect(res).toMatchObject({ ok: true });
    expect(res.detail).toContain("test mode");
  });
  it("reports a rejected key as a failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const res = await testIntegration("openai", { OPENAI_API_KEY: "bad" });
    expect(res.ok).toBe(false);
  });
});

describe("lead evaluation (SRS 14.16)", () => {
  it("parses a valid answer and rejects malformed ones", () => {
    expect(parseLeadEvaluation(JSON.stringify(good))?.fit).toBe("high");
    expect(parseLeadEvaluation(JSON.stringify({ ...good, fit: "great" }))).toBeNull();
    expect(parseLeadEvaluation("not json")).toBeNull();
    expect(parseLeadEvaluation(JSON.stringify({ ...good, summary: "" }))).toBeNull();
  });
  it("routes through the agent gate, uses the simple model class and records the result", async () => {
    const invokeLLM = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify(good) } }] }) as any);
    const res = await evaluateLead(lead, { invokeLLM });
    expect(res).toMatchObject({ ok: true, executionId: 41 });
    expect(invokeLLM.mock.calls[0][0]).toMatchObject({ complexity: "simple", purpose: "lead.evaluation" });
    expect(gov.results[0]).toMatchObject({ action: "evaluate_lead_result", subjectRef: "lead:7" });
  });
  it("does not call the model when the agent is blocked", async () => {
    gov.gate = { outcome: "blocked_by_permission", reason: "agent_disabled" };
    const invokeLLM = vi.fn();
    const res = await evaluateLead(lead, { invokeLLM: invokeLLM as any });
    expect(res.ok).toBe(false);
    expect(invokeLLM).not.toHaveBeenCalled();
  });
  it("records nothing when the model answer is unusable", async () => {
    const invokeLLM = vi.fn(async () => ({ choices: [{ message: { content: "sorry" } }] }) as any);
    const res = await evaluateLead(lead, { invokeLLM });
    expect(res.ok).toBe(false);
    expect(gov.results).toHaveLength(0);
  });
  it("reports a provider failure instead of throwing", async () => {
    const invokeLLM = vi.fn(async () => {
      throw new Error("credit_balance_exhausted");
    });
    const res = await evaluateLead(lead, { invokeLLM: invokeLLM as any });
    expect(res).toEqual({ ok: false, reason: "credit_balance_exhausted" });
  });
});
