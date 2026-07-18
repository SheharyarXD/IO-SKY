import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");

// Only translate where a natural non-English target exists.
const T = {
  "login.metric.monitoring": { nl:"Bewaking" },
  "infra.diagram.right.analytics": { nl:"Analyse" },
  "infra.diagram.right.dashboards": { nl:"Dashboards" }, // standard NL loanword, keep
  "intel.flow.impact.title": { nl:"Impact", fr:"Impact" }, // identical/correct in NL & FR
  "infra.benefit.governance.title": { nl:"Governance", de:"Governance", it:"Governance" }, // standard loanword
  "infra.diagram.left.support": { de:"Support", fr:"Support" }, // standard loanword
  "infra.benefit.integration.title": { de:"Integration" }, // correct German
  "about.impact.s1.value": { it:"End-to-end" }, // technical term kept
  "login.field.password": { it:"Password" }, // standard Italian loanword
  "pillars.enterprise.title": { it:"Enterprise" }, // brand-tier term kept
};
// Note: FR nav/footer/pillars "Infrastructure/Intelligence/Solutions/Contact/Communication/Sources",
// "Conversion", and intel.caps.title.accent "intelligence" are valid French words -> left unchanged.

const LOCALES = ["nl","de","fr","es","ar","zh","ja","it"];
const files = {};
for (const c of LOCALES) files[c] = readFileSync(path.join(I18N_DIR, `${c}.ts`), "utf8");
function setKey(src,key,val){const esc=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const re=new RegExp(`("${esc}"\\s*:\\s*")((?:[^"\\\\]|\\\\.)*)(")`);if(!re.test(src))return{src,ok:false};return{src:src.replace(re,`$1${val}$3`),ok:true};}
let applied=0;const misses=[];
for(const[key,per]of Object.entries(T))for(const[loc,val]of Object.entries(per)){if(!LOCALES.includes(loc))continue;const r=setKey(files[loc],key,val);if(r.ok){files[loc]=r.src;applied++;}else misses.push(`${loc}:${key}`);}
for(const c of LOCALES)writeFileSync(path.join(I18N_DIR,`${c}.ts`),files[c]);
console.log(`applied=${applied}`);if(misses.length)console.log("MISSES:",misses.join(", "));
