import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/** Parse a locale TS dictionary file into a key->value map. */
function loadLocale(file: string): Record<string, string> {
  const src = fs.readFileSync(file, "utf8");
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm)) {
    try { out[m[1]] = JSON.parse(m[2]); } catch { /* skip */ }
  }
  return out;
}

const ROOT = path.resolve(__dirname, "..", "client", "src", "lib", "i18n");
const en = loadLocale(path.join(ROOT, "en.ts"));
const enKeys = Object.keys(en);

const LOCALES = ["nl", "de", "fr", "es", "it", "pt", "ar", "ja", "zh"] as const;

describe("i18n completeness", () => {
  it("English has at least 1100 keys", () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(1100);
  });

  for (const code of LOCALES) {
    it(`${code}.ts covers every English key`, () => {
      const dict = loadLocale(path.join(ROOT, `${code}.ts`));
      const missing = enKeys.filter((k) => !(k in dict));
      expect(missing, `Locale ${code} is missing keys: ${missing.slice(0,10).join(", ")}`).toEqual([]);
    });
  }
});
