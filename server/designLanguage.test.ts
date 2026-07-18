/**
 * Design-language regression test (Pakket 2).
 *
 * Asserts that the canonical IO SKY design tokens exist in `index.css`.
 * Future refactors that accidentally drop one of these primitives will
 * fail this test instead of silently degrading the UI across surfaces.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const cssPath = path.resolve(__dirname, "../client/src/index.css");
const css = fs.readFileSync(cssPath, "utf8");

const REQUIRED_TOKENS = [
  // Layout primitives
  ".io-surface",
  ".io-surface-glass",
  ".io-card",
  ".io-section",
  ".io-empty-state",
  ".io-empty-icon",
  ".io-icon-chip",
  ".io-icon-chip-sm",
  ".io-divider",
  ".io-divider-vertical",
  ".io-pill",
  ".io-pill-success",
  ".io-pill-danger",
  ".io-pill-warn",
  ".io-pill-orange",
  // Motion primitives that should remain available
  ".reveal",
  ".pulse-orange",
  ".glow-orange",
  ".lift-on-hover",
  ".skeleton",
  ".ticker-track",
  // Typography helpers
  ".font-display",
  ".font-mono",
  ".eyebrow",
  // Buttons
  ".btn-primary",
  ".btn-secondary",
];

describe("Pakket 2 — design-language tokens", () => {
  it.each(REQUIRED_TOKENS)("declares %s", (token) => {
    expect(css.includes(token)).toBe(true);
  });

  it("brand orange variable is the exact #FF6A00 from the brand sheet", () => {
    expect(css).toMatch(/--orange:\s*#FF6A00/);
  });

  it("respects prefers-reduced-motion globally", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("supports RTL reveal on Arabic locale", () => {
    expect(css).toMatch(/\[dir="rtl"\] \.reveal/);
  });
});
