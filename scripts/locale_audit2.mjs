// Refined locale audit: only report keys that are (a) actually used/rendered and
// (b) identical to EN (likely untranslated/mixed), excluding legit shared tokens.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");
const LOCALES = ["en", "nl", "de", "fr", "es", "pt", "ar", "zh", "ja", "it"];

function parseLocale(code) {
  const src = readFileSync(path.join(I18N_DIR, `${code}.ts`), "utf8");
  const map = {};
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) map[m[1]] = m[2];
  return map;
}

const dicts = {};
for (const c of LOCALES) dicts[c] = parseLocale(c);
const en = dicts.en;

const used = new Set(
  readFileSync("/tmp/all_used_keys.txt", "utf8").split("\n").map(s => s.trim()).filter(Boolean)
);

// Values that are legitimately identical across languages (brand, prices, emails, acronyms).
function isAllowedEqual(key, val) {
  if (val === "") return true;
  // brand / product tiers / layer name
  if (/IO SKY|Operational Layer/i.test(val)) return true;
  // emails & urls
  if (/@|https?:\/\//.test(val)) return true;
  // prices / pure numbers / symbols
  if (/^[\s\d.,%×x+\-–—:/&€$]+$/.test(val)) return true;
  // all-caps short partner/brand names & acronyms (NEXORA, GROUP, CRM, AI, SSO…)
  if (/^[A-Z0-9 &.+/-]{1,28}$/.test(val)) return true;
  // single-word tech brands
  if (["GitHub","LinkedIn","Slack","HubSpot","Salesforce","Zapier","Stripe","API"].includes(val)) return true;
  return false;
}

const report = {};
let grand = 0;
for (const code of LOCALES) {
  if (code === "en") continue;
  const d = dicts[code];
  const hits = [];
  for (const k of Object.keys(en)) {
    if (!used.has(k)) continue;          // skip dead keys
    const ev = en[k], v = d[k];
    if (v === undefined) { hits.push([k, "(MISSING)"]); continue; }
    if (v === ev && !isAllowedEqual(k, v)) hits.push([k, v]);
  }
  // group by prefix (first segment before '.')
  const byPrefix = {};
  for (const [k, v] of hits) {
    const p = k.split(".")[0];
    (byPrefix[p] ||= []).push(`${k}  ==  ${v}`);
  }
  report[code] = { count: hits.length, byPrefix };
  grand += hits.length;
  const prefixSummary = Object.entries(byPrefix)
    .sort((a,b)=>b[1].length-a[1].length)
    .map(([p,arr])=>`${p}:${arr.length}`).join("  ");
  console.log(`\n=== ${code.toUpperCase()} === rendered-untranslated = ${hits.length}`);
  console.log("  " + prefixSummary);
}
writeFileSync(path.join(__dirname, "locale_audit2.json"), JSON.stringify(report, null, 2));
console.log(`\nGRAND TOTAL rendered-untranslated = ${grand}`);
console.log("Wrote scripts/locale_audit2.json");
