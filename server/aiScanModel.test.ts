/**
 * Tests for the AI Scan canonical contract (shared/aiScanModel.ts).
 *
 * These specs lock in the public/marketing-aligned guarantees so they
 * cannot drift silently:
 *   - The five dimensions exist and are stable.
 *   - Tier profiles fall on the documented escalation ladder.
 *   - Grading bands are exhaustive and non-overlapping.
 */
import { describe, expect, it } from "vitest";
import {
  AI_SCAN_DIMENSIONS,
  AI_SCAN_GRADE_BANDS,
  AI_SCAN_TIER_PROFILE,
  gradeForScore,
} from "../shared/aiScanModel";

describe("AI Scan model contract", () => {
  it("declares exactly the five marketed dimensions", () => {
    expect(AI_SCAN_DIMENSIONS).toEqual([
      "operationalMaturity",
      "automationReadiness",
      "infrastructureMaturity",
      "scalabilityReadiness",
      "aiOpportunityPotential",
    ]);
  });

  it("grade bands cover 0..100 with no gaps and no overlap", () => {
    let cursor = 0;
    for (const band of AI_SCAN_GRADE_BANDS) {
      expect(band.min).toBe(cursor);
      expect(band.max).toBeGreaterThanOrEqual(band.min);
      cursor = band.max + 1;
    }
    expect(cursor).toBe(101);
  });

  it("gradeForScore maps boundaries correctly", () => {
    expect(gradeForScore(0)).toBe("critical");
    expect(gradeForScore(39)).toBe("critical");
    expect(gradeForScore(40)).toBe("developing");
    expect(gradeForScore(54)).toBe("developing");
    expect(gradeForScore(55)).toBe("established");
    expect(gradeForScore(69)).toBe("established");
    expect(gradeForScore(70)).toBe("mature");
    expect(gradeForScore(84)).toBe("mature");
    expect(gradeForScore(85)).toBe("leading");
    expect(gradeForScore(100)).toBe("leading");
  });

  it("tier profile escalates monotonically (free < growth < elite)", () => {
    const free = AI_SCAN_TIER_PROFILE.free;
    const growth = AI_SCAN_TIER_PROFILE.growth;
    const elite = AI_SCAN_TIER_PROFILE.elite;

    expect(free.questionCount).toBeLessThan(growth.questionCount);
    expect(growth.questionCount).toBeLessThan(elite.questionCount);

    expect(free.opportunitiesIncluded).toBeLessThan(growth.opportunitiesIncluded);
    expect(growth.opportunitiesIncluded).toBeLessThan(elite.opportunitiesIncluded);

    expect(free.dimensionsCovered.length).toBeLessThan(
      growth.dimensionsCovered.length,
    );
    expect(growth.dimensionsCovered.length).toBeLessThan(
      elite.dimensionsCovered.length,
    );

    expect(elite.dimensionsCovered).toEqual([...AI_SCAN_DIMENSIONS]);
    expect(elite.includesRoadmap).toBe(true);
    expect(elite.expertRefinement).toBe(true);
  });
});
