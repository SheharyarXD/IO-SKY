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

// English words that strongly indicate untranslated/mixed English content.
// Curated to avoid false positives with cognates shared by Latin languages.
const EN_WORDS = new Set<string>([
 "the","and","with","your","you","for","from","into","every","all","across","our","their","that","this","these","those",
 "growth","engineered","powered","embedded","operation","operations","operational","overview","revenue","conversions","conversion","active","opportunities","opportunity","systems","system","workflows","workflow","careers","partners","about","us","security-first","end-to-end","real-time",
 "explore","capabilities","view","start","learn","more","see","discover","subscribe","subscribed","welcome","signal","people","behind","team","looking","out","over","global","metropolitan","skyline","night",
 "analytics","integrations","integration","dashboards","dashboard","compliance","governance","support","sources","communication","password","enterprise","intelligence","infrastructure","solutions","impact",
 "built","change","detects","preferred","interface","language","using","browser","settings","only","geolocation","used","selected","stored","locally","preserve","preference","visits","cleared","removing","site","data","centralized","table","string","supported","verify","tone","correct","phrasing","before","shipping","surface","transforms","processes","drives","execution","automation","identifies","bottlenecks","gaps","business","qualification","internal","directly","layer",
 "rights","reserved"
]);
// loanwords allowed (do NOT flag even if english-looking) per all latin locales
const LOANS_ALL = new Set(["enterprise","intelligence","infrastructure","solutions","impact","dashboards","dashboard","compliance","governance","integration","integrations","communication","sources","conversion","password","analytics","workflows","workflow","end-to-end","software","saas","crm","pipeline"]);

function tokens(s:string){
  return s.replace(/IO SKY/g," ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g," ")
    .replace(/https?:\/\/\S+/g," ")
    .toLowerCase().split(/[^a-zà-ÿ0-9-]+/).filter(Boolean);
}
const report:Record<string,{key:string;loc:string;hits:string[]}[]>={};
for(const [code,dict] of Object.entries(LOCS)){
  const flags:{key:string;loc:string;hits:string[]}[]=[];
  for(const [k,env] of Object.entries(en)){
    const lv=(dict as any)[k]; if(lv==null) continue;
    if(k.startsWith("ent.partner.")) continue;
    if(/^(LinkedIn|GitHub)$/i.test(lv.trim())) continue;
    const tk=tokens(lv);
    const hits=tk.filter(w=>EN_WORDS.has(w) && !LOANS_ALL.has(w));
    if(hits.length>0) flags.push({key:k,loc:lv,hits:[...new Set(hits)]});
  }
  report[code]=flags;
}
let total=0;
for(const [code,flags] of Object.entries(report)){console.log(`${code.toUpperCase()} mixed=${flags.length}`);total+=flags.length;}
console.log("TOTAL MIXED:",total);
writeFileSync("scripts/mixed_audit.json",JSON.stringify(report,null,2));
