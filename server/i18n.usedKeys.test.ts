/*
 * translate() returns the key itself when the key is missing, so a call written
 * as t("some.key") shows the raw key to the user, and a trailing || "fallback"
 * never runs because the key is a truthy string. This caught the public AI Scan
 * report page showing "aiscan.result.opportunities" as a heading.
 *
 * Every t("key") with no default argument must exist in the English dictionary.
 * A call that passes a default (t("key", "Default")) is allowed to be missing.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CLIENT = path.resolve(__dirname, "..", "client", "src");
const en = fs.readFileSync(path.join(CLIENT, "lib", "i18n", "en.ts"), "utf8");
const have = new Set([...en.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) && !p.replace(/\\/g, "/").includes("lib/i18n/")) out.push(p);
  }
  return out;
}

/** t("a.b") with a single argument, so there is no default to fall back on. */
export function keysWithoutDefault(src: string): string[] {
  return [...src.matchAll(/\bt\(\s*"([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)+)"\s*\)/g)].map((m) => m[1]);
}

describe("keys used without a default exist in the dictionary", () => {
  it("the dictionary has the keys the scan below relies on", () => {
    expect(have.size).toBeGreaterThan(1000);
    expect(have.has("aiscan.result.opportunities")).toBe(true);
  });

  it("detects a single argument call and ignores one with a default", () => {
    expect(keysWithoutDefault('t("a.b")')).toEqual(["a.b"]);
    expect(keysWithoutDefault('t("a.b", "Default")')).toEqual([]);
    expect(keysWithoutDefault('{t("a.b") || "x"}')).toEqual(["a.b"]);
  });

  const files = sourceFiles(CLIENT);
  it("scans the client source", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no t(\"key\") call shows a raw key because its entry is missing", () => {
    const missing: string[] = [];
    for (const f of files) {
      for (const k of keysWithoutDefault(fs.readFileSync(f, "utf8"))) {
        if (!have.has(k)) missing.push(`${path.relative(CLIENT, f)}: ${k}`);
      }
    }
    expect(missing, `Add these keys to every locale, or pass a default as the second argument:\n${missing.join("\n")}`).toEqual([]);
  });
});
