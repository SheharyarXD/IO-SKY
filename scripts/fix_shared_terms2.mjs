import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");

const T = {
  // NL CTAs containing "AI Scan" -> "AI-Scan"
  "path.aiscan.cta": { nl:"Start AI-Scan" },
  "hero.cta.scan": { nl:"Start AI-Scan" },
  "hov.scan.cta": { nl:"Start AI-Scan" },
  "infra.hero.cta.book": { nl:"Start AI-Scan" },
  "nav.aiScan": { nl:"AI-Scan" },
  "nav.enterprise": { nl:"Onderneming" },
  "infra.cap.security.title": { nl:"Beveiliging & governance" },

  // DE infra benefit / diagram terms
  "infra.benefit.integration.title": { de:"Integration", it:"Integrazione" },
  "infra.benefit.governance.title": { de:"Governance", nl:"Governance", it:"Governance" },
  "infra.diagram.left.support": { de:"Support", fr:"Support" },
  "infra.diagram.right.dashboards": { de:"Dashboards", nl:"Dashboards" },

  // IT
  "intel.cap.executive.title": { it:"Analisi esecutive" },
};

const LOCALES = ["nl","de","fr","es","ar","zh","ja","it"];
const files = {};
for (const c of LOCALES) files[c] = readFileSync(path.join(I18N_DIR, `${c}.ts`), "utf8");
function setKey(src, key, val) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`("${esc}"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`);
  if (!re.test(src)) return { src, ok: false };
  return { src: src.replace(re, `$1${val}$3`), ok: true };
}
let applied=0; const misses=[];
for (const [key, per] of Object.entries(T))
  for (const [loc,val] of Object.entries(per)) {
    if(!LOCALES.includes(loc)) continue;
    const r=setKey(files[loc],key,val);
    if(r.ok){files[loc]=r.src;applied++;} else misses.push(`${loc}:${key}`);
  }
for (const c of LOCALES) writeFileSync(path.join(I18N_DIR, `${c}.ts`), files[c]);
console.log(`applied=${applied}`); if(misses.length) console.log("MISSES:",misses.join(", "));
