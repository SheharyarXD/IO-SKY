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
    downloads: Array<Record<string, unknown>>;
    versions: Array<{ scanId: number; payload: string; score: number | null }>;
    versionFailure: "none" | "reject" | "throw";
  } = { leads: [], aiScans: [], downloads: [], versions: [], versionFailure: "none" };
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
    appendReportDownloadAudit: vi.fn(async (row: Record<string, unknown>) => void state.downloads.push(row)),
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
    // P06: each report the engine produces is kept as a version.
    recordReportVersion: vi.fn((scanId: number, payload: string, score: number | null) => {
      if (state.versionFailure === "throw") throw new Error("sync failure");
      if (state.versionFailure === "reject") return Promise.reject(new Error("table missing"));
      state.versions.push({ scanId, payload, score });
      return Promise.resolve(state.versions.length);
    }),
    recordNotificationEvent: vi.fn(async () => true),
    createAdminNotification: vi.fn(async () => null),
    // A healthy agent registry. The AI gate fails closed (P0-01), so a test that
    // expects the engine to run must provide one rather than rely on an outage.
    AI_SCAN_AGENT_KEY: "ai_scan_analyst",
    ensureDefaultAiAgents: vi.fn(async () => {}),
    authoriseAndRecordAgentAction: vi.fn(async () => ({ outcome: "completed", executionId: 1, promptVersion: null })),
    getActivePrompt: vi.fn(async () => null),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

vi.mock("./_core/aiScanScoring", () => ({
  DEFAULT_SCAN_BASE_PROMPT: "test base prompt",
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
    st.versions.length = 0;
    st.versionFailure = "none";
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

  it("keeps each report the engine produces as a version (BR-017)", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.7"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.success).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    // Match on the payload itself: scan ids restart in this mock and another test's engine run may finish late,
    // so the reliable proof is that a kept version is exactly the report stored on this scan.
    const mine = st.aiScans.find((x: Record<string, unknown>) => x.reportToken === r.reportToken);
    expect(typeof mine.reportPayload).toBe("string");
    const kept = st.versions.filter((v: { payload: string }) => v.payload === mine.reportPayload);
    expect(kept.length).toBeGreaterThanOrEqual(1);
    expect(kept[0].scanId).toBe(mine.id);
    expect(JSON.parse(kept[0].payload).overallScore).toBe(kept[0].score);
  });

  it("a failure to keep the version never stops the report reaching review", async () => {
    for (const mode of ["reject", "throw"] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (dbMock as any).__state;
      st.versionFailure = mode;
      const caller = aiScansRouter.createCaller(makeCtx(`11.0.1.${mode.length}`));
      const r = await caller.submitQuestionnaire(questionnaireInput());
      expect(r.success, mode).toBe(true);
      const row = st.aiScans[st.aiScans.length - 1];
      expect(row.status, mode).toBe("ready");
      expect(row.reportStatus, mode).toBe("awaiting_expert_review");
    }
  });

  it("does not block the response on owner notification failure", async () => {
    vi.mocked(notifyOwner).mockRejectedValueOnce(new Error("notify down"));
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.5"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.success).toBe(true);
  });

  it("holds a scored report for expert review and shows it only once published (BR-016)", async () => {
    const caller = aiScansRouter.createCaller(makeCtx("11.0.0.6"));
    const r = await caller.submitQuestionnaire(questionnaireInput());
    expect(r.reportToken).toBeTruthy();

    // The engine has finished, but a person has not approved it yet.
    const held = await caller.getReport({ token: r.reportToken as string });
    expect(held.status).toBe("ready");
    expect(held.reportStatus).toBe("awaiting_expert_review");
    expect(held.report).toBeNull();
    await expect(caller.getReportPdf({ token: r.reportToken as string })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    // Approved is still not visible: only Published is.
    const state = (dbMock as unknown as { __state: { aiScans: Array<Record<string, unknown>> } }).__state;
    const row = state.aiScans.find((x) => x.reportToken === r.reportToken)!;
    row.reportStatus = "approved";
    expect((await caller.getReport({ token: r.reportToken as string })).report).toBeNull();

    row.reportStatus = "revision_required";
    expect((await caller.getReport({ token: r.reportToken as string })).report).toBeNull();

    row.reportStatus = "published";
    const ready = await caller.getReport({ token: r.reportToken as string });
    expect(ready.status).toBe("ready");
    expect(ready.report).not.toBeNull();
    expect(ready.report?.overallScore).toBe(64);
    expect(ready.report?.executiveSummary).toContain("executive summary");
  });

  // P0-02 / P08, SRS 9.10: a paid report opens only for the account that ordered it.
  describe("report ownership (SRS 9.10)", () => {
    const PAID_TOKEN = "p".repeat(48);
    const withUser = (user: { id: number; email: string; role: string } | null) => ({ ...makeCtx("12.0.0.1"), user }) as unknown as Parameters<typeof aiScansRouter.createCaller>[0];
    const seedPaid = (tier: "growth" | "elite" = "growth") => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (dbMock as any).__state;
      st.aiScans.push({
        id: 900, reportToken: PAID_TOKEN, tier, email: "owner@acme.test", company: "Acme", status: "ready", reportStatus: "published",
        reportPayload: JSON.stringify({ overallScore: 70, executiveSummary: "Confidential findings.", dimensions: [], opportunities: [], roadmap: [], disclaimers: [] }),
        createdAt: new Date(),
      });
    };

    it("refuses a paid report to an anonymous caller who only holds the link", async () => {
      seedPaid();
      const caller = aiScansRouter.createCaller(withUser(null));
      await expect(caller.getReport({ token: PAID_TOKEN })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(caller.getReportPdf({ token: PAID_TOKEN })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });

    it("refuses another organisation's signed in user (cross-tenant), for both the report and the PDF", async () => {
      seedPaid("elite");
      const caller = aiScansRouter.createCaller(withUser({ id: 7, email: "mallory@other.test", role: "client" }));
      await expect(caller.getReport({ token: PAID_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.getReportPdf({ token: PAID_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("refuses a developer or technical operator who is not the owner", async () => {
      seedPaid();
      for (const role of ["developer", "technical_operator", "user"]) {
        const caller = aiScansRouter.createCaller(withUser({ id: 8, email: "someone@iosky.test", role }));
        await expect(caller.getReport({ token: PAID_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    });

    it("shows the report to the owner, matching the email case-insensitively", async () => {
      seedPaid();
      const caller = aiScansRouter.createCaller(withUser({ id: 9, email: "Owner@Acme.test", role: "client" }));
      const r = await caller.getReport({ token: PAID_TOKEN });
      expect(r.report?.executiveSummary).toBe("Confidential findings.");
    });

    it("lets IO SKY staff (admin, super_admin) read it", async () => {
      seedPaid();
      for (const role of ["admin", "super_admin"]) {
        const caller = aiScansRouter.createCaller(withUser({ id: 1, email: "staff@iosky.test", role }));
        expect((await caller.getReport({ token: PAID_TOKEN })).report).not.toBeNull();
      }
    });

    it("keeps the emailed link working for a free guest scan (no account exists)", async () => {
      const guest = aiScansRouter.createCaller(withUser(null));
      const r = await guest.submitQuestionnaire(questionnaireInput({ email: "guest@example.com" }));
      const state = (dbMock as unknown as { __state: { aiScans: Array<Record<string, unknown>> } }).__state;
      state.aiScans.find((x) => x.reportToken === r.reportToken)!.reportStatus = "published";
      expect((await guest.getReport({ token: r.reportToken as string })).report).not.toBeNull();
    });

    it("never returns the report body of an unpublished paid scan, even to its owner (BR-016)", async () => {
      seedPaid();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dbMock as any).__state.aiScans.find((x: Record<string, unknown>) => x.reportToken === PAID_TOKEN).reportStatus = "awaiting_expert_review";
      const caller = aiScansRouter.createCaller(withUser({ id: 9, email: "owner@acme.test", role: "client" }));
      expect((await caller.getReport({ token: PAID_TOKEN })).report).toBeNull();
    });
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
