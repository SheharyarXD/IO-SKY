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
const PRODUCT = /\b(IO SKY|AI Scan|AI-Scan|Growth Ecosystem|Elite Ecosystem|Growth|Elite|Custom)\b/g;
// STRONG English words: extremely unlikely to be a normal word in ANY of NL/DE/FR/ES/IT/PT
const STRONG = new Set<string>([
 "the","and","with","your","you","from","into","every","across","our","their","for","that","this",
 "engineered","powered","embedded","overview","revenue","conversions","opportunities","opportunity",
 "careers","explore","capabilities","view","learn","more","see","discover","subscribe","subscribed","welcome",
 "people","behind","team","looking","skyline","night",
 "built","change","detects","preferred","using","browser","settings","geolocation",
 "stored","preserve","preference","visits","cleared","removing","centralized",
 "supported","verify","correct","phrasing","before","shipping","transforms",
 "drives","identifies","bottlenecks","gaps","qualification","internal","directly",
 "rights","reserved","everything","connected","visible","companies","most","operational","operations","operation",
 "security-first","end-to-end","dashboards","systems"
]);
// per-locale: words that ARE valid target words (remove from STRONG for that locale)
const VALID: Record<string,Set<string>> = {
 fr:new Set(["conversions","qualification","visible","operational","operations","operation","opportunities","opportunity","interface","global","active","site","surface","signal","capabilities"]), // cognates
 es:new Set(["conversiones","operational"]),
 it:new Set(["operational","operations","operation","qualification","visible"]),
 pt:new Set([]),
 nl:new Set([]),
 de:new Set([]),
 ar:new Set([]),ja:new Set([]),zh:new Set([]),
};
const LOANS_ALL = new Set(["dashboards","systems","end-to-end","real-time","analytics","workflows","support"]);
function tokens(s:string){
  return s.replace(PRODUCT," ").replace(/IO SKY/g," ")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g," ")
    .replace(/https?:\/\/\S+/g," ")
    .toLowerCase().split(/[^a-zà-ÿ0-9-]+/).filter(Boolean);
}
const report:Record<string,any[]>={};
for(const [code,dict] of Object.entries(LOCS)){
  const valid=VALID[code]||new Set();
  const flags:any[]=[];
  for(const [k,env] of Object.entries(en)){
    const lv=(dict as any)[k]; if(lv==null) continue;
    if(k.startsWith("ent.partner.")) continue;
    if(/^(LinkedIn|GitHub)$/i.test(lv.trim())) continue;
    const hits=tokens(lv).filter(w=>STRONG.has(w) && !valid.has(w) && !LOANS_ALL.has(w));
    if(hits.length>0) flags.push({key:k,loc:lv,en:env,hits:[...new Set(hits)]});
  }
  report[code]=flags;
}
let total=0;
for(const [code,flags] of Object.entries(report)){console.log(`${code.toUpperCase()} strong=${flags.length}`);total+=flags.length;}
console.log("TOTAL STRONG:",total);
writeFileSync("scripts/mixed_strong.json",JSON.stringify(report,null,2));
