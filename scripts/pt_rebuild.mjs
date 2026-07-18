import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("client/src/lib/i18n");

function loadLocale(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = {};
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm)) {
    try { out[m[1]] = JSON.parse(m[2]); } catch { /* skip */ }
  }
  return out;
}

const en = loadLocale(path.join(ROOT, "en.ts"));
const existingPt = loadLocale(path.join(ROOT, "pt.ts"));

// Merge translated batches
const map = JSON.parse(fs.readFileSync("translate_pt_batches.json", "utf8"));
const translated = {};
let parsed = 0, failed = 0;
for (const r of map.results) {
  const s = r.output?.translated_json;
  if (!s) { failed++; continue; }
  let obj;
  try { obj = JSON.parse(s); }
  catch {
    // try to salvage: strip code fences
    try { obj = JSON.parse(s.replace(/^```json\s*/i, "").replace(/```\s*$/, "")); }
    catch { failed++; continue; }
  }
  Object.assign(translated, obj);
  parsed++;
}
console.log("Batches parsed:", parsed, "failed:", failed, "translated keys:", Object.keys(translated).length);

// Build final dict: every EN key, prefer existing pt, then translated, then EN fallback
const finalDict = {};
const enKeys = Object.keys(en);
let usedExisting = 0, usedTranslated = 0, usedEn = 0;
for (const k of enKeys) {
  if (k in existingPt) { finalDict[k] = existingPt[k]; usedExisting++; }
  else if (k in translated) { finalDict[k] = translated[k]; usedTranslated++; }
  else { finalDict[k] = en[k]; usedEn++; }
}
// Also keep any pt-only keys (legacy) that aren't in EN, appended at end
for (const k of Object.keys(existingPt)) {
  if (!(k in finalDict)) finalDict[k] = existingPt[k];
}
console.log("Final keys:", Object.keys(finalDict).length, "existing:", usedExisting, "translated:", usedTranslated, "en-fallback:", usedEn);

// Emit list of EN-fallback keys for visibility
const fallbackKeys = enKeys.filter(k => !(k in existingPt) && !(k in translated));
fs.writeFileSync("scripts/pt_fallback_keys.json", JSON.stringify(fallbackKeys, null, 2));

// Serialize pt.ts
const header = `/**\n * Portuguese (PT) translation.\n *\n * Mirrors every English key. Brand/product names (IO SKY, AI Scan, Growth,\n * Elite, Custom Intelligence) are intentionally kept in English.\n */\nexport const pt: Record<string, string> = {\n`;
const body = Object.entries(finalDict)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");
const footer = `\n};\n`;
fs.writeFileSync(path.join(ROOT, "pt.ts"), header + body + footer, "utf8");
console.log("Wrote pt.ts");
