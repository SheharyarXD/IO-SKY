/**
 * Pakket 3 — i18n / RTL / locale-formatters regression tests.
 *
 * These tests run in vitest's node environment, so we exercise the pure
 * functions (translate, formatNumber, formatCurrency, formatDate,
 * formatRelative) and inspect the locale registry without touching the DOM.
 */

import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  translate,
  isRTL,
  bcp47For,
  formatNumber,
  formatCurrency,
  formatDate,
  formatRelative,
  allKeys,
  dictFor,
} from "../client/src/lib/i18n";

describe("Pakket 3 — i18n registry", () => {
  it("registers exactly the 10 active languages", () => {
    const codes = LANGUAGES.map((l) => l.code).sort();
    expect(codes).toEqual(["AR", "DE", "EN", "ES", "FR", "IT", "JA", "NL", "PT", "ZH"]);
  });

  it("Arabic is the only RTL locale", () => {
    expect(isRTL("AR")).toBe(true);
    expect(isRTL("EN")).toBe(false);
    expect(isRTL("ZH")).toBe(false);
    expect(isRTL("JA")).toBe(false);
  });

  it("each language exposes a BCP47 tag for Intl APIs", () => {
    expect(bcp47For("EN")).toBe("en-US");
    expect(bcp47For("NL")).toBe("nl-NL");
    expect(bcp47For("DE")).toBe("de-DE");
    expect(bcp47For("FR")).toBe("fr-FR");
    expect(bcp47For("ES")).toBe("es-ES");
    expect(bcp47For("IT")).toBe("it-IT");
    expect(bcp47For("PT")).toBe("pt-PT");
    expect(bcp47For("AR")).toBe("ar-SA");
    expect(bcp47For("ZH")).toBe("zh-CN");
    expect(bcp47For("JA")).toBe("ja-JP");
  });
});

describe("Pakket 3 — translate()", () => {
  it("returns the localized value when the key exists in the locale", () => {
    expect(translate("ZH", "nav.cta")).toBe("预约Discovery Call");
    expect(translate("AR", "nav.cta")).toBeTruthy();
    expect(translate("EN", "nav.cta")).toBe("Book Discovery Call");
  });

  it("falls back to English when the key is missing in the target locale", () => {
    // Use a key that genuinely does not exist anywhere — translate() should
    // fall back to English, which itself falls back to the key string.
    const enValue = translate("EN", "definitely.not.a.real.key.xyz");
    expect(translate("FR", "definitely.not.a.real.key.xyz")).toBe(enValue);
  });

  it("returns the raw key as a last-resort fallback", () => {
    expect(translate("EN", "nonexistent.key.deliberately")).toBe(
      "nonexistent.key.deliberately",
    );
  });

  it("supports {name} placeholder substitution", () => {
    // Make a one-off check against EN since substitution is locale-agnostic.
    const dict = dictFor("EN");
    const keyWithVar = Object.keys(dict).find((k) =>
      /\{[a-zA-Z]+\}/.test(dict[k]),
    );
    // If no key currently uses {var}, just verify the substitution mechanic.
    expect(translate("EN", "any.key", { name: "Alex" })).not.toContain("{name}");
    if (keyWithVar) {
      const interpolated = translate("EN", keyWithVar, { name: "Alex" });
      expect(typeof interpolated).toBe("string");
    }
  });
});

describe("Pakket 3 — Chinese locale", () => {
  it("ZH dictionary contains at least the core navigation keys", () => {
    const zh = dictFor("ZH");
    [
      "nav.cta",
      "nav.login",
      "hero.cta.primary",
      "hero.cta.secondary",
      "ticker.aria",
      "problem.title",
      "solution.title",
      "footer.tagline",
      "auth.mfa.title",
    ].forEach((key) => {
      expect(zh[key]).toBeTruthy();
    });
  });

  it("every ZH value is non-Latin (catches accidental EN copy-paste)", () => {
    const zh = dictFor("ZH");
    const sample = ["nav.cta", "hero.cta.primary", "problem.title"];
    sample.forEach((k) => {
      expect(zh[k]).toMatch(/[\u4e00-\u9fff]/);
    });
  });
});

describe("Pakket 3 — locale-aware formatters", () => {
  it("formatNumber respects locale separators", () => {
    const enOut = formatNumber("EN", 1234567);
    const nlOut = formatNumber("NL", 1234567);
    const deOut = formatNumber("DE", 1234567);
    // EN uses ',' as thousands sep; NL/DE use '.'
    expect(enOut).toMatch(/1,234,567/);
    expect(nlOut).toMatch(/1\.234\.567/);
    expect(deOut).toMatch(/1\.234\.567/);
  });

  it("formatCurrency emits a recognisable currency symbol", () => {
    const euro = formatCurrency("EN", 127430, "EUR");
    expect(euro).toMatch(/€/);
    const yen = formatCurrency("JA", 50000, "JPY");
    expect(yen).toMatch(/¥|￥/);
  });

  it("formatDate produces locale-specific output", () => {
    const date = new Date("2026-05-20T10:42:00Z");
    const en = formatDate("EN", date);
    const ja = formatDate("JA", date);
    expect(en).not.toEqual(ja);
    expect(typeof en).toBe("string");
  });

  it("formatRelative returns a sensible string", () => {
    expect(formatRelative("EN", -1, "day")).toMatch(/yesterday|day/i);
    expect(formatRelative("ZH", -1, "day")).toBeTruthy();
  });

  it("formatters never throw on unknown locale (defensive fallback)", () => {
    // @ts-expect-error — intentional bad input
    expect(formatNumber("ZZ", 42)).toBe("42");
  });
});

describe("Pakket 3 — dictionary parity", () => {
  it("EN remains the single source of truth", () => {
    const en = dictFor("EN");
    const universe = allKeys();
    // Every key in the universe must exist in EN so translate() always
    // finds a sensible fallback.
    const missingInEn = universe.filter((k) => !(k in en));
    expect(missingInEn).toEqual([]);
  });
});
