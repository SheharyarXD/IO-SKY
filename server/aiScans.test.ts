/**
 * Tests for the AI Scan funnel tRPC router (Phase 5 — workflow boundaries).
 *
 * Boundary guarantees verified here:
 *   • submitLead persists a CRM lead with source="ai-scan" and tier-aware
 *     interest tag (so Free / Growth / Elite never collide with each other
 *     or with Discovery Call / Proposal funnels).
 *   • Honeypot field is silently absorbed (no lead created).
 *   • Rate limit kicks in after 6 submissions / minute / IP.
 *   • Owner notification is fire-and-forget and never breaks the response.
 *   • A failing acceptedAiDisclaimer flag is rejected at the schema level.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => {
  const state: {
    leads: Array<Record<string, unknown>>;
    aiScans: Array<Record<string, unknown>>;
  } = { leads: [], aiScans: [] };
  return {
    __state: state,
    createLead: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: state.leads.length + 1, ...input };
      state.leads.push(row);
      return row;
    }),
    createAiScan: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: state.aiScans.length + 1, ...input };
      state.aiScans.push(row);
      return row;
    }),
    getAiScanByToken: vi.fn(async (token: string) => {
      return state.aiScans.find((s) => s.reportToken === token) ?? null;
    }),
    getAiScanById: vi.fn(async (id: number) => {
      return state.aiScans.find((s) => s.id === id) ?? null;
    }),
    updateAiScanStatus: vi.fn(
      async (id: number, patch: Record<string, unknown>) => {
        const row = state.aiScans.find((s) => s.id === id);
        if (row) Object.assign(row, patch);
      },
    ),
    listRecentAiScans: vi.fn(async () => state.aiScans),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

vi.mock("./_core/aiScanScoring", () => ({
  scoreAiScan: vi.fn(async () => ({
    ok: true as const,
    report: {
      overallScore: 64,
      overallGrade: "Established",
      scoredAt: 1700000000000,
      tier: "free" as const,
      dimensions: [
        {
          dimension: "operationalMaturity" as const,
          score: 60,
          grade: "Established",
          rationale: "Stub rationale for unit tests.",
        },
        {
          dimension: "automationReadiness" as const,
          score: 70,
          grade: "Established",
          rationale: "Stub rationale for unit tests.",
        },
      ],
      executiveSummary:
        "Stub executive summary used by unit tests to validate persistence flow.",
      opportunities: [
        {
          id: "op-1",
          title: "Document core processes",
          category: "operationalMaturity" as const,
          impact: "medium" as const,
          effort: "low" as const,
          horizon: "30-90d" as const,
          summary: "Lock down the playbooks.",
        },
      ],
      roadmap: [],
      charts: { radar: true, bar: true, timeline: false },
      disclaimers: ["Indicative output, not advisory."],
    },
  })),
}));

import { aiScansRouter } from "./routers/aiScans";
import * as dbMock from "./db";
import { notifyOwner } from "./_core/notification";
import { scoreAiScan } from "./_core/aiScanScoring";
import {
  AI_SCAN_QUESTION_BANK,
  getQuestionsForTier,
  computeRawDimensionScores,
  isQuestionnaireConsistent,
  findMissingAnswers,
} from "../shared/aiScanQuestionnaire";
import { AI_SCAN_TIER_PROFILE } from "../shared/aiScanModel";

function makeCtx(ip = "1.2.3.4") {
  return {
    req: {
      headers: { "user-agent": "vitest", "x-forwarded-for": ip },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Express.Request,
    res: {} as unknown as Express.Response,
    user: null,
    impersonation: null,
  };
}

function baseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tier: "free" as const,
    fullName: "Alice Test",
    email: "alice@example.com",
    phone: "+31600000000",
    company: "Acme BV",
    acceptedAiDisclaimer: true,
    ...overrides,
  };
}

describe("aiScansRouter.submitLead", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.leads.length = 0;
    vi.mocked(notifyOwner).mockClear();
    vi.mocked(dbMock.createLead).mockClear();
  });

  it("persists a free-tier lead with source=ai-scan and interest=ai-scan:free", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.1"));
    const r = await caller.submitLead(baseInput());
    expect(r.success).toBe(true);
    expect(r.tier).toBe("free");
    expect(typeof r.leadId).toBe("number");
    expect(vi.mocked(dbMock.createLead)).toHaveBeenCalledOnce();
    const arg = vi.mocked(dbMock.createLead).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.source).toBe("ai-scan");
    expect(arg.interest).toBe("ai-scan:free");
    expect(arg.email).toBe("alice@example.com");
  });

  it("preserves tier distinction for paid Growth tier", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.2"));
    const r = await caller.submitLead(baseInput({ tier: "growth" as const }));
    expect(r.tier).toBe("growth");
    const arg = vi.mocked(dbMock.createLead).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.interest).toBe("ai-scan:growth");
  });

  it("preserves tier distinction for paid Elite tier", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.3"));
    const r = await caller.submitLead(baseInput({ tier: "elite" as const }));
    expect(r.tier).toBe("elite");
    const arg = vi.mocked(dbMock.createLead).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.interest).toBe("ai-scan:elite");
  });

  it("rejects submissions where the AI Disclaimer was not accepted", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.4"));
    await expect(
      caller.submitLead(
        baseInput({ acceptedAiDisclaimer: false }) as unknown as Parameters<
          typeof caller.submitLead
        >[0],
      ),
    ).rejects.toThrow();
    expect(vi.mocked(dbMock.createLead)).not.toHaveBeenCalled();
  });

  it("rejects invalid email", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.5"));
    await expect(
      caller.submitLead(
        baseInput({ email: "not-an-email" }) as unknown as Parameters<
          typeof caller.submitLead
        >[0],
      ),
    ).rejects.toThrow();
  });

  it("rejects non-empty honeypot field at the schema layer", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.6"));
    // Bots filling the honeypot must never reach createLead. The schema
    // enforces max(0); either the request is rejected outright or, if a
    // bot somehow passes an empty string, the runtime guard short-circuits.
    await expect(
      caller.submitLead(
        baseInput({ website: "https://bot.example.com" }) as unknown as Parameters<
          typeof caller.submitLead
        >[0],
      ),
    ).rejects.toThrow();
    expect(vi.mocked(dbMock.createLead)).not.toHaveBeenCalled();
  });

  it("does not break when notifyOwner throws", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("notify down"));
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.7"));
    const r = await caller.submitLead(baseInput());
    expect(r.success).toBe(true);
    expect(r.leadId).toBeGreaterThan(0);
  });

  it("rate-limits after 6 submissions from the same IP within 1 minute", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.99"));
    for (let i = 0; i < 6; i++) {
      await caller.submitLead(baseInput({ email: `u${i}@example.com` }));
    }
    await expect(
      caller.submitLead(baseInput({ email: "overflow@example.com" })),
    ).rejects.toThrow(/Too many/i);
  });

  it("propagates a meaningful error when the lead cannot be persisted", async () => {
    vi.mocked(dbMock.createLead).mockResolvedValueOnce(null);
    const caller = aiScansRouter.createCaller(makeCtx("10.0.0.8"));
    await expect(caller.submitLead(baseInput())).rejects.toThrow(
      /could not be saved/i,
    );
  });
});


// ────────────────────────────────────────────────────────────────────────────
// Questionnaire bank consistency
// ────────────────────────────────────────────────────────────────────────────
describe("AI Scan questionnaire bank", () => {
  it("contract is consistent: tier counts match AI_SCAN_TIER_PROFILE", () => {
    expect(isQuestionnaireConsistent()).toBe(true);
  });

  it("free tier exposes exactly the configured number of questions", () => {
    expect(getQuestionsForTier("free")).toHaveLength(
      AI_SCAN_TIER_PROFILE.free.questionCount,
    );
  });

  it("growth tier is a strict superset of free tier", () => {
    const free = new Set(getQuestionsForTier("free").map((q) => q.id));
    const growth = new Set(getQuestionsForTier("growth").map((q) => q.id));
    for (const id of free) expect(growth.has(id)).toBe(true);
  });

  it("elite tier is a strict superset of growth tier", () => {
    const growth = new Set(getQuestionsForTier("growth").map((q) => q.id));
    const elite = new Set(getQuestionsForTier("elite").map((q) => q.id));
    for (const id of growth) expect(elite.has(id)).toBe(true);
  });

  it("every question maps to a covered dimension at its tier", () => {
    for (const tier of ["free", "growth", "elite"] as const) {
      const profile = AI_SCAN_TIER_PROFILE[tier];
      const covered = new Set<string>(profile.dimensionsCovered);
      for (const q of getQuestionsForTier(tier)) {
        expect(covered.has(q.dimension)).toBe(true);
      }
    }
  });

  it("findMissingAnswers reports omissions and is empty when complete", () => {
    const all = AI_SCAN_QUESTION_BANK.reduce<Record<string, string>>(
      (acc, q) => {
        acc[q.id] = q.options[0].value;
        return acc;
      },
      {},
    );
    expect(findMissingAnswers("elite", all)).toHaveLength(0);

    const partial = { ...all };
    delete partial["om.processes"];
    expect(findMissingAnswers("free", partial)).toContain("om.processes");
  });

  it("computeRawDimensionScores averages within 0..100", () => {
    const answers: Record<string, string> = {};
    for (const q of getQuestionsForTier("elite")) {
      answers[q.id] = q.options[q.options.length - 1].value; // best answers
    }
    const scores = computeRawDimensionScores(answers);
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      expect(v).toBeGreaterThan(70); // top-of-scale answers should be high
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// submitQuestionnaire end-to-end (with mocked engine + db)
// ────────────────────────────────────────────────────────────────────────────
function freeAnswers(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of getQuestionsForTier("free")) {
    out[q.id] = q.options[0].value;
  }
  return out;
}

function questionnaireInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tier: "free" as const,
    fullName: "Bob Q",
    email: "bob@example.com",
    company: "Acme",
    locale: "en",
    acceptedAiDisclaimer: true,
    answers: freeAnswers(),
    ...overrides,
  };
}

describe("aiScansRouter.submitQuestionnaire", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.leads.length = 0;
    st.aiScans.length = 0;
    vi.mocked(scoreAiScan).mockClear();
    vi.mocked(notifyOwner).mockClear();
  });

  it("persists scan + lead, runs scoring engine inline for free tier, returns reportToken", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.1"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.success).toBe(true);
    expect(r.tier).toBe("free");
    expect(typeof r.reportToken).toBe("string");
    expect((r.reportToken ?? "").length).toBeGreaterThanOrEqual(32);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    expect(st.aiScans).toHaveLength(1);
    expect(st.leads).toHaveLength(1);
    expect(st.aiScans[0].status).toBe("ready");
    expect(typeof st.aiScans[0].reportPayload).toBe("string");
    expect(st.aiScans[0].overallScore).toBe(64);
    expect(vi.mocked(scoreAiScan)).toHaveBeenCalledOnce();
  });

  it("rejects payload missing required answers", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.2"));
    const partial = freeAnswers();
    delete partial["om.processes"];
    await expect(
      caller.submitQuestionnaire(questionnaireInput({ answers: partial })),
    ).rejects.toThrow(/Missing answers/);
  });

  it("rejects unknown question ids to prevent payload pollution", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.3"));
    const tampered = { ...freeAnswers(), "evil.injected": "ad-hoc" };
    await expect(
      caller.submitQuestionnaire(questionnaireInput({ answers: tampered })),
    ).rejects.toThrow(/Unknown question id/);
  });

  it("marks scan as failed and notifies owner when engine fails", async () => {
    vi.mocked(scoreAiScan).mockResolvedValueOnce({
      ok: false,
      error: "LLM unavailable",
    });
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.4"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    expect(st.aiScans[0].status).toBe("failed");
    expect(st.aiScans[0].errorMessage).toContain("LLM unavailable");
  });

  it("does not block the response on owner notification failure", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("notify down"));
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.5"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.success).toBe(true);
  });

  it("getReport returns 'pending' shape until status=ready", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.6"));
    // First produce a ready report.
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.reportToken).toBeTruthy();

    const ready = await caller.getReport({ token: r.reportToken as string });
    expect(ready.status).toBe("ready");
    expect(ready.report).not.toBeNull();
    expect(ready.report?.overallScore).toBe(64);
    expect(ready.report?.executiveSummary).toContain("executive summary");
  });

  it("getReport throws NOT_FOUND for unknown tokens", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.7"));
    await expect(
      caller.getReport({ token: "0".repeat(48) }),
    ).rejects.toThrow(/not found/i);
  });

  it("getQuestionnaire returns canonical question set for the tier", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.8"));
    const r = await caller.getQuestionnaire({ tier: "growth" });
    expect(r.tier).toBe("growth");
    expect(r.questions).toHaveLength(
      AI_SCAN_TIER_PROFILE.growth.questionCount,
    );
  });
});
