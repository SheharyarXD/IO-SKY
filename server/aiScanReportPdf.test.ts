import { describe, it, expect } from "vitest";
import { renderAiScanReportPdf } from "./aiScanReportPdf";
import type { AiScanReportPayload } from "../shared/aiScanModel";

function makeReport(tier: "free" | "growth" | "elite"): AiScanReportPayload {
  return {
    overallScore: 67,
    overallGrade: "established",
    scoredAt: Date.now(),
    tier,
    dimensions: [
      {
        dimension: "operationalMaturity",
        score: 72,
        grade: "mature",
        rationale: "Processes are documented but inconsistently followed.",
      },
      {
        dimension: "automationReadiness",
        score: 58,
        grade: "established",
        rationale: "Some tooling in place; ownership is unclear.",
      },
    ],
    executiveSummary:
      "The organization shows solid operational fundamentals with clear automation upside over the next two quarters.",
    opportunities: [
      {
        id: "op-1",
        title: "Automate invoice reconciliation",
        category: "automationReadiness",
        impact: "high",
        effort: "medium",
        horizon: "30-90d",
        summary: "Reduce manual finance effort by routing invoices through a rules engine.",
      },
    ],
    roadmap: [
      { horizon: "0-30d", items: ["Map the top 5 manual workflows"] },
      { horizon: "30-90d", items: ["Pilot invoice automation", "Define data ownership"] },
    ],
    charts: { radar: true, bar: true, timeline: true },
    disclaimers: [
      "This report is generated from self-reported inputs and AI analysis for guidance only.",
    ],
  };
}

const meta = {
  company: "Acme Operations",
  publicRef: "ABCDEF1234",
  createdAt: Date.now(),
};

describe("renderAiScanReportPdf", () => {
  it("produces a non-empty PDF buffer with a valid header for each tier", async () => {
    for (const tier of ["free", "growth", "elite"] as const) {
      const buf = await renderAiScanReportPdf(makeReport(tier), { ...meta, tier });
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(800);
      // PDF files start with "%PDF-"
      expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      // and end with the EOF marker somewhere near the tail
      expect(buf.subarray(-1024).toString("latin1")).toContain("%%EOF");
    }
  });

  it("does not throw when optional sections are empty", async () => {
    const empty = makeReport("free");
    empty.opportunities = [];
    empty.roadmap = [];
    empty.disclaimers = [];
    const buf = await renderAiScanReportPdf(empty, { ...meta, tier: "free" });
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles a missing company gracefully", async () => {
    const buf = await renderAiScanReportPdf(makeReport("growth"), {
      ...meta,
      company: "Your organization",
      tier: "growth",
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
