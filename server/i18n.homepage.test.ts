/**
 * i18n homepage key-completeness regression test.
 *
 * Background: the homepage sections (`Hero`, `OperationalFriction`,
 * `EcosystemOverview`, `FourPillars`, `Intelligence`, `Infrastructure`,
 * `ResultsThatMatter`, `AIScanSection`, `LiveOpsTicker`) used a handful of
 * translation keys (e.g. `problem.card1.title`) that were never declared in
 * `en.ts` — so visitors were seeing literal keys instead of copy.
 *
 * This test re-scans every section file for `t("...")` calls and asserts the
 * referenced key exists in the canonical English dictionary. Any future key
 * that gets added to JSX without a matching entry in `en.ts` will fail this
 * test immediately.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const SECTION_FILES = [
  "client/src/components/sections/Hero.tsx",
  "client/src/components/sections/LiveOpsTicker.tsx",
  "client/src/components/sections/OperationalFriction.tsx",
  "client/src/components/sections/EcosystemOverview.tsx",
  "client/src/components/sections/FourPillars.tsx",
  "client/src/components/sections/Intelligence.tsx",
  "client/src/components/sections/Infrastructure.tsx",
  "client/src/components/sections/ResultsThatMatter.tsx",
  "client/src/components/sections/AIScanSection.tsx",
];

const T_CALL_RE = /\bt\(\s*"([^"]+)"/g;

function extractKeys(source: string): string[] {
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = T_CALL_RE.exec(source)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}

function loadEnDictKeys(): Set<string> {
  const enPath = path.join(projectRoot, "client/src/lib/i18n/en.ts");
  const src = fs.readFileSync(enPath, "utf8");
  // Pull every quoted key on a line that looks like `"foo.bar": "..."`.
  const re = /^\s*"([a-zA-Z0-9._]+)"\s*:/gm;
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) keys.add(m[1]);
  return keys;
}

describe("i18n — homepage key completeness", () => {
  const enKeys = loadEnDictKeys();

  it("loads a non-empty English dictionary", () => {
    expect(enKeys.size).toBeGreaterThan(100);
  });

  for (const file of SECTION_FILES) {
    it(`every t("...") key in ${path.basename(file)} is declared in en.ts`, () => {
      const abs = path.join(projectRoot, file);
      const source = fs.readFileSync(abs, "utf8");
      const usedKeys = extractKeys(source);
      const missing = usedKeys.filter((k) => !enKeys.has(k));
      expect(missing).toEqual([]);
    });
  }
});
