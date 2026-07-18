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

// Product / brand names that are intentionally English everywhere.
const PRODUCT = /\b(IO SKY|AI Scan|AI-Scan|Growth|Elite|Custom|Growth Ecosystem|Elite Ecosystem)\b/g;

// HIGH-PRECISION English words: words that are unambiguously English and are NOT
// normal words in NL/DE/FR/ES/IT/PT. (Deliberately exclude data, start, over, real-time, etc.)
const EN_WORDS = new Set<string>([
 "the","and","with","your","you","for","from","into","every","across","our","their",
 "engineered","powered","embedded","overview","revenue","conversions","active","opportunities","opportunity",
 "careers","about","us","explore","capabilities","view","learn","more","see","discover","subscribe","subscribed","welcome","signal",
 "people","behind","team","looking","global","metropolitan","skyline","night",
 "built","change","detects","preferred","interface","using","browser","settings","only","geolocation","used",
 "selected","stored","locally","preserve","preference","visits","cleared","removing","site","centralized",
 "table","supported","verify","tone","correct","phrasing","before","shipping","surface","transforms",
 "drives","execution","identifies","bottlenecks","gaps","business","qualification","internal","directly",
 "rights","reserved","systems","workflows","analytics","integrations","dashboards","operational","operation","operations",
 "security-first","end-to-end","support","everything","connected","visible","most","companies","problem","growth-engine"
]);
// Allowed loanwords per locale (won't flag)
const LOANS: Record<string,Set<string>> = {
  nl:new Set(["enterprise","intelligence","infrastructure","dashboards","compliance","governance","analytics","workflows","data","real-time","realtime","businessauto","software","saas","crm","pipeline","integrations"]),
  de:new Set(["enterprise","intelligence","infrastructure","dashboards","compliance","governance","analytics","workflows","data","real-time","realtime","software","saas","crm","pipeline","integration","integrations","support"]),
  fr:new Set(["infrastructure","intelligence","solutions","communication","conversion","sources","impact","analytics","software","saas","crm","pipeline","integrations"]),
  es:new Set(["enterprise","infraestructura","inteligencia","analytics","software","saas","crm","pipeline"]),
  it:new Set(["enterprise","intelligence","infrastructure","dashboards","compliance","governance","analytics","workflows","end-to-end","password","software","saas","crm","pipeline"]),
  pt:new Set(["dashboards","analytics","workflows","software","saas","crm","pipeline","integrations"]),
  ar:new Set([]), ja:new Set([]), zh:new Set([]),
};

function tokens(s:string){
  return s.replace(PRODUCT," ")
    .replace(/IO SKY/g," ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g," ")
    .replace(/https?:\/\/\S+/g," ")
    .toLowerCase().split(/[^a-zà-ÿ0-9-]+/).filter(Boolean);
}
const report:Record<string,{key:string;loc:string;hits:string[]}[]>={};
for(const [code,dict] of Object.entries(LOCS)){
  const allow=LOANS[code]||new Set();
  const flags:{key:string;loc:string;hits:string[]}[]=[];
  for(const [k,env] of Object.entries(en)){
    const lv=(dict as any)[k]; if(lv==null) continue;
    if(k.startsWith("ent.partner.")) continue;
    if(/^(LinkedIn|GitHub)$/i.test(lv.trim())) continue;
    const tk=tokens(lv);
    const hits=tk.filter(w=>EN_WORDS.has(w) && !allow.has(w));
    if(hits.length>0) flags.push({key:k,loc:lv,hits:[...new Set(hits)]});
  }
  report[code]=flags;
}
let total=0;
for(const [code,flags] of Object.entries(report)){console.log(`${code.toUpperCase()} mixed=${flags.length}`);total+=flags.length;}
console.log("TOTAL MIXED:",total);
writeFileSync("scripts/mixed_audit.json",JSON.stringify(report,null,2));
