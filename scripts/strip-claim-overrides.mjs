/**
 * One-off launch-honesty cleanup.
 *
 * Removes locale overrides that carried fabricated quantitative claims
 * (uptime percentages, "delivered" track-record numbers) from every non-EN
 * locale so they fall back to the revised, honest EN source strings.
 *
 * Safe & idempotent: only deletes lines whose key is in KEYS_TO_REMOVE.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const I18N_DIR = join(__dirname, "..", "client", "src", "lib", "i18n");

const LOCALES = ["nl", "de", "fr", "es", "it", "ar", "ja", "zh", "pt"];

const KEYS_TO_REMOVE = new Set([
  "infra.trust.uptime.title",
  "sol.trust.t4.title",
  "hero.trust.uptime",
  "about.impact.s1.label",
  "about.impact.s2.label",
  "about.impact.s3.label",
  "about.impact.s4.label",
]);

let totalRemoved = 0;

for (const code of LOCALES) {
  const path = join(I18N_DIR, `${code}.ts`);
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  const kept = [];
  let removed = 0;

  for (const line of lines) {
    // Match: optional whitespace, "key": ...
    const m = line.match(/^\s*"([^"]+)"\s*:/);
    if (m && KEYS_TO_REMOVE.has(m[1])) {
      removed += 1;
      continue;
    }
    kept.push(line);
  }

  if (removed > 0) {
    writeFileSync(path, kept.join("\n"), "utf8");
  }
  totalRemoved += removed;
  console.log(`${code}: removed ${removed} override line(s)`);
}

console.log(`\nDone. Removed ${totalRemoved} fabricated-claim override line(s).`);
console.log("These keys now fall back to the revised EN source strings.");
