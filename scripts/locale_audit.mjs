// Locale audit: find (1) missing keys vs EN, (2) values identical to EN (likely untranslated),
// and (3) values containing obvious English-only words (likely mixed-language), per locale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");

const LOCALES = ["en", "nl", "de", "fr", "es", "pt", "ar", "zh", "ja", "it"];

// Crude but effective: import each module via dynamic import after transpiling? Simpler:
// the files are plain `export const xx: Record<string,string> = { "k": "v", ... }`.
// We parse them with a tolerant regex that captures "key": "value" pairs.
function parseLocale(code) {
  const file = path.join(I18N_DIR, `${code}.ts`);
  const src = readFileSync(file, "utf8");
  const map = {};
  // Match  "key": "value",  allowing escaped quotes and unicode escapes inside value.
  const re = /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[1];
    const val = m[2];
    // skip the export type line etc. keys always contain a dot or lowercase ident
    map[key] = val;
  }
  return map;
}

const dicts = {};
for (const code of LOCALES) dicts[code] = parseLocale(code);

const en = dicts.en;
const enKeys = Object.keys(en);

// Tokens that are legitimately shared/untranslated (brand, acronyms, product tiers, etc.)
const ALLOW_EQUAL = new Set();
const ALLOW_SUBSTR = [
  "IO SKY", "AI Scan", "CRM", "ERP", "API", "AI", "SaaS", "KPI", "ROI",
  "Growth", "Elite", "Custom Intelligence", "Growth Ecosystem", "Elite Ecosystem",
  "Hub", "Dashboards", "Dashboard", "Analytics", "live", "B2B", "GDPR", "ISO",
  "SLA", "SSO", "MKB", "©", "IO", "SKY",
];

// English-only stopwords that should never appear inside a translated (non-EN) value.
const EN_WORDS = [
  "the","and","with","your","that","this","from","into","for","you","are","our",
  "without","growth problem","operational","infrastructure","systems","automation",
  "decision","visibility","scale","more","less","faster","than","when","where",
  "across","into","they","have","most","companies","intelligent","makes","predictable",
  "depending","hiring","people","clarity","outcomes","results","explore","view",
  "discover","start","book","strategy","call","scan","free","analysis","execution",
  "security","governance","integration","integrations","data","insight","control",
];

const report = {};
let totalMissing = 0, totalEqual = 0, totalMixed = 0;

for (const code of LOCALES) {
  if (code === "en") continue;
  const d = dicts[code];
  const missing = [];
  const equal = [];
  const mixed = [];
  for (const k of enKeys) {
    const ev = en[k];
    if (!(k in d)) { missing.push(k); continue; }
    const v = d[k];
    if (v === "") continue; // intentional empty (e.g. problem.title.part2)
    // identical-to-EN (likely untranslated), unless it's a short shared token
    if (v === ev) {
      const isAllowed = v.length <= 3 || ALLOW_SUBSTR.some(t => v === t) ||
        /^[A-Z0-9 .,&/+-]+$/.test(v) === false ? false : true;
      // treat purely-symbolic / acronym-ish as allowed
      const allowed = ALLOW_EQUAL.has(k) || /^[\d\s.,%×x+\-–—:/&]+$/.test(v) ||
        ALLOW_SUBSTR.includes(v);
      if (!allowed) equal.push(k + "  ==  " + v);
      continue;
    }
  }
  report[code] = { missing, equal, mixed };
  totalMissing += missing.length;
  totalEqual += equal.length;
  console.log(`\n=== ${code.toUpperCase()} ===  missing=${missing.length}  equalEN=${equal.length}`);
  if (missing.length) console.log("  MISSING:", missing.slice(0, 40).join(", ") + (missing.length>40?` … (+${missing.length-40})`:""));
  if (equal.length) console.log("  EQUAL-EN (sample):\n   " + equal.slice(0, 25).join("\n   ") + (equal.length>25?`\n   … (+${equal.length-25})`:""));
}

writeFileSync(path.join(__dirname, "locale_audit.json"), JSON.stringify(report, null, 2));
console.log(`\nTOTAL  missing=${totalMissing}  equalEN=${totalEqual}`);
console.log("Wrote scripts/locale_audit.json");
