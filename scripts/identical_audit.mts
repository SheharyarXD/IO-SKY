import { en } from "../client/src/lib/i18n/en";
import { nl } from "../client/src/lib/i18n/nl";
import { de } from "../client/src/lib/i18n/de";
import { fr } from "../client/src/lib/i18n/fr";
import { es } from "../client/src/lib/i18n/es";
import { ar } from "../client/src/lib/i18n/ar";
import { ja } from "../client/src/lib/i18n/ja";
import { zh } from "../client/src/lib/i18n/zh";
import { it } from "../client/src/lib/i18n/it";
import { pt } from "../client/src/lib/i18n/pt";
import { writeFileSync } from "node:fs";

const LOCS: Record<string, Record<string,string>> = { nl, de, fr, es, it, pt, ar, ja, zh };

// keys we intentionally keep identical across all locales (brand/acronyms/urls/symbols)
const ALLOW_IDENTICAL = new Set<string>([]);
// allow if value matches one of these exactly (brand-ish tokens)
const isBrandy = (v: string) => {
  const t = v.trim();
  if (t.length === 0) return true;
  // pure non-letters (numbers, symbols)
  if (!/[A-Za-z]/.test(t)) return true;
  // brand/acronym only tokens
  const brandTokens = /^(IO SKY|CRM|ERP|GDPR|RGPD|API|AI|IVR|SMS|SaaS|24\/7|IO|SKY|EN|NL|DE|FR|ES|IT|PT|AR|JA|ZH)$/i;
  if (brandTokens.test(t)) return true;
  return false;
};

// crude English-word detector for CJK/AR locales: any latin word with vowel of length>=3 that is a common english word
const COMMON_EN = /\b(the|and|with|your|that|grow|growth|built|security|compliance|data|sovereignty|designed|to|all|capabilities|for|of|in|on|across|management|risk|governance|software|systems|enterprise|infrastructure|intelligence|solutions|scale|scan|password|support|integration|dashboards|sources|communication|conversion|impact|end-to-end|real-time|insight|automation|operational|predictive|executive|hub|agents)\b/i;

const report: Record<string, {key:string; en:string; loc:string}[]> = {};
for (const [code, dict] of Object.entries(LOCS)) {
  const flags: {key:string; en:string; loc:string}[] = [];
  for (const [k, env] of Object.entries(en)) {
    const lv = (dict as any)[k];
    if (lv == null) continue; // missing handled elsewhere
    if (lv === env) {
      if (isBrandy(env)) continue;
      // for AR/JA/ZH: identical-to-EN latin string is suspicious unless brandy
      if (["ar","ja","zh"].includes(code)) { flags.push({key:k, en:env, loc:lv}); continue; }
      // for latin locales: only flag if it looks like multiword english OR contains common english function words
      const multiword = env.trim().split(/\s+/).length >= 2;
      if (multiword || COMMON_EN.test(env)) flags.push({key:k, en:env, loc:lv});
    } else {
      // value differs but may still embed an English sentence fragment (mixed). Detect common EN function words inside latin locales.
      if (["nl","de","fr","es","it","pt"].includes(code)) {
        if (/\b(and|with|your|that|the|designed to|grow with|built for|risk management|data sovereignty)\b/i.test(lv)) {
          flags.push({key:k, en:env, loc:lv});
        }
      }
    }
  }
  report[code] = flags;
}
let total=0;
for (const [code, flags] of Object.entries(report)) {
  console.log(`\n=== ${code.toUpperCase()} flagged=${flags.length} ===`);
  flags.slice(0,80).forEach(f=>console.log(`  ${f.key}  ::  ${f.loc}`));
  total+=flags.length;
}
console.log("\nTOTAL FLAGGED:", total);
writeFileSync("scripts/identical_audit.json", JSON.stringify(report,null,2));
