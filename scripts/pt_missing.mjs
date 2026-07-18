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
const pt = loadLocale(path.join(ROOT, "pt.ts"));
const enKeys = Object.keys(en);
const missing = enKeys.filter((k) => !(k in pt));
console.log("EN keys:", enKeys.length, "PT keys:", Object.keys(pt).length, "Missing in PT:", missing.length);
// Emit a JSON of missing key->EN value so we can translate
fs.writeFileSync("scripts/pt_missing.json", JSON.stringify(missing.reduce((a,k)=>{a[k]=en[k];return a;},{}), null, 2));
console.log("Wrote scripts/pt_missing.json");
