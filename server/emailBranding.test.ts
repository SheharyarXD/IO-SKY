/**
 * Transactional email branding.
 *
 * The client specified the IO SKY brand values exactly: Warm Deep Teal
 * #0D2D2E as the ground and IO SKY Orange #F58A1F as the accent. The
 * templates previously shipped #0A0E14 and #FF7A00 — a different teal and a
 * different orange, close enough to pass a glance and wrong on a brand
 * review. This file pins the palette at the source level so the next edit to
 * a template cannot quietly reintroduce an approximation.
 *
 * Asserted against the source text rather than a rendered email because the
 * point is that no template may carry its own hardcoded hex at all: a
 * rendered-output check would pass for a template that hardcoded the right
 * value and then drifted on the next one added.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, "email.ts"), "utf8");

/** Everything outside the file's comment blocks. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("transactional email branding", () => {
  it("defines the exact brand ground and accent", () => {
    expect(CODE).toContain('ground: "#0D2D2E"');
    expect(CODE).toContain('accent: "#F58A1F"');
  });

  it("carries no off-brand approximations of the teal or the orange", () => {
    for (const wrong of ["#0A0E14", "#0F141B", "#FF7A00", "rgba(255, 122, 0"]) {
      expect(CODE, `${wrong} is not an IO SKY brand value`).not.toContain(wrong);
    }
  });

  it("routes every template colour through the shared palette", () => {
    // A hex literal anywhere in the template strings means one template can
    // drift away from the others.
    const literals = CODE.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    const allowed = new Set(["#0D2D2E", "#123A3B", "#F58A1F", "#E6EAF0"]);
    const stray = literals.filter((h) => !allowed.has(h.toUpperCase()));
    expect(stray, `unexpected hex literals: ${stray.join(", ")}`).toEqual([]);
  });
});
