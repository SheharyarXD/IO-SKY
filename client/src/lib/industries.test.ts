import { describe, it, expect } from "vitest";
import { searchIndustries, INDUSTRY_OPTIONS } from "./industries";

describe("searchIndustries", () => {
  it("returns every canonical option for an empty query", () => {
    expect(searchIndustries("").map((m) => m.option)).toEqual([...INDUSTRY_OPTIONS]);
  });

  it("matches the canonical label directly", () => {
    expect(searchIndustries("health").some((m) => m.option === "Healthcare")).toBe(true);
  });

  it("surfaces the canonical category from a Dutch alias", () => {
    expect(searchIndustries("zorg").map((m) => m.option)).toContain("Healthcare");
    expect(searchIndustries("ziekenhuis").map((m) => m.option)).toContain("Healthcare");
    expect(searchIndustries("gemeente").map((m) => m.option)).toContain("Government & Public Sector");
    expect(searchIndustries("bouwbedrijf").map((m) => m.option)).toContain("Construction");
  });

  it("is case-insensitive and tolerant of punctuation", () => {
    expect(searchIndustries("HEALTHCARE").map((m) => m.option)).toContain("Healthcare");
    expect(searchIndustries("e-commerce").map((m) => m.option)).toContain("E-commerce");
    expect(searchIndustries("ecommerce").map((m) => m.option)).toContain("E-commerce");
  });

  it("never returns a value outside the canonical list", () => {
    const results = searchIndustries("zorg");
    for (const r of results) {
      expect(INDUSTRY_OPTIONS).toContain(r.option);
    }
  });

  it("returns nothing for a query matching no label or alias", () => {
    expect(searchIndustries("xyzzyplugh")).toEqual([]);
  });
});
