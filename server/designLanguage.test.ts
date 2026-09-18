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

  it("brand orange variable is the exact #F58A1F specified by the approved design system", () => {
    // Was #FF7A00 (pixel-sampled from the official logo PNG as a ground-truth
    // best guess) until the client-approved Signature High Glass spec and the
    // AI Scan / Discovery Call / Contact developer specs gave an explicit,
    // repeated instruction: "IO SKY Orange #F58A1F exactly (RGB 245, 138, 31)
    // — never yellow, amber, gold or any alternate orange. Do not substitute
    // a visually similar token." That written spec now outranks the earlier
    // pixel sample.
    expect(css).toMatch(/--io-orange:\s*#F58A1F/);
    expect(css).toMatch(/--orange:\s*var\(--io-orange\)/);
  });

  it("brand background is the exact #0D2D2E Deep Teal specified by the approved design system", () => {
    // The Signature High Glass spec scopes #0D2D2E to "the entire IO SKY
    // website and authenticated platform" — it is the single background
    // source of truth even though individual page specs (Homepage, Contact)
    // quote their own slightly different teal values for their own canvases.
    expect(css).toMatch(/--io-bg:\s*#0D2D2E/);
    expect(css).toMatch(/--background:\s*var\(--io-bg\)/);
  });

  it("respects prefers-reduced-motion globally", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it("supports RTL reveal on Arabic locale", () => {
    expect(css).toMatch(/\[dir="rtl"\] \.reveal/);
  });
});
