/**
 * Tailwind arbitrary values must not contain raw spaces.
 *
 * A Tailwind class is delimited by whitespace, so `bg-[rgba(255, 122, 0,0.08)]`
 * is not one class with a space in it: it is three fragments, none of which
 * Tailwind recognises, and the utility is never generated. Nothing warns. The
 * element simply renders with no background, which looks like a design choice
 * rather than a bug.
 *
 * Thirteen of these had accumulated and every one was dead: the built
 * stylesheet on production contained zero occurrences of `255,122,0`, so the
 * orange accents on the nav mega-menu icons, the Engineering Access page, the
 * Login focus rings and the Portal header were all missing.
 *
 * Spaces inside an arbitrary value must be written as underscores
 * (`bg-[rgba(255,122,0,0.08)]`, or `shadow-[0_0_24px_rgba(...)]`). This test
 * scans the source rather than the built CSS, because by the time it reaches
 * the CSS the evidence has been silently discarded.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * An arbitrary value containing a raw space.
 *
 * Anchored on `[` immediately after a utility prefix so it matches Tailwind
 * bracket syntax and not, say, a TypeScript index signature or an array
 * literal. `[^\]"'\`]` keeps the match inside a single bracket group and stops
 * it running across a quote boundary into unrelated code.
 */
const SPACED_ARBITRARY = /[a-z0-9-]\[[^\]"'`\n]*\s[^\]"'`\n]*\]/g;

/**
 * Written as underscores, these are the legitimate spellings, so a file using
 * them correctly must not trip the check. Listed for the reader's benefit
 * rather than used in the matching.
 */
void ["bg-[rgba(255,122,0,0.08)]", "shadow-[0_0_24px_rgba(255,122,0,0.45)]"];

describe("Tailwind arbitrary values", () => {
  const files = walk(SRC);

  it("finds source files to scan", () => {
    // Guards against the walk silently returning nothing, which would make
    // every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(50);
  });

  it("contains no arbitrary value with a raw space", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      source.split("\n").forEach((line, i) => {
        // Only class strings matter. A `style={{ boxShadow: "0 0 4px red" }}`
        // is plain CSS in a JS object and spaces there are correct.
        if (!/class(Name)?\s*=|cn\(|clsx\(|"[^"]*\[[a-z-]+\(/.test(line)) return;

        for (const match of line.matchAll(SPACED_ARBITRARY)) {
          // Template-literal interpolation legitimately contains spaces.
          if (match[0].includes("${")) continue;
          offenders.push(
            `${file.slice(SRC.length + 1)}:${i + 1}  ${match[0].trim()}`,
          );
        }
      });
    }

    expect(
      offenders,
      `Tailwind will not generate these; write spaces as underscores:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
