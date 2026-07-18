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
const LOCS: Record<string, Record<string,string>> = { nl, de, fr, es, it, pt };
const PRODUCT = /\b(IO SKY|AI Scan|AI-Scan|Growth Ecosystem|Elite Ecosystem|Growth|Elite|Custom|Engineering Access|Engineering Operations)\b/g;
// Strong English markers, MINUS words that are valid in one or more target langs
const STRONG = new Set<string>([
 "the","and","with","your","you","from","into","every","across","our","their","for","that",
 "engineered","powered","embedded","overview","revenue","conversions","opportunities",
 "careers","capabilities","learn","discover","subscribe","subscribed","welcome",
 "people","behind","looking","skyline","night",
 "built","change","detects","preferred","using","settings","geolocation",
 "stored","preserve","preference","visits","cleared","removing","centralized",
 "supported","verify","correct","phrasing","before","shipping","transforms",
 "drives","identifies","bottlenecks","gaps","internal","directly",
 "rights","reserved","everything","connected","companies","most",
 "security-first"
]);
// words valid in given locale -> skip
const VALID: Record<string,Set<string>> = {
 fr:new Set(["conversions","capabilities","visible","connected"]),
 es:new Set(["visible","explore"]),
 it:new Set(["visible"]),
 pt:new Set([]),nl:new Set([]),de:new Set([]),
};
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
    const hits=tokens(lv).filter(w=>STRONG.has(w) && !valid.has(w));
    // also flag the standalone English word "operations"/"operation" when not part of brand
    if(/\boperations?\b/i.test(lv.replace(PRODUCT," ")) && !["operations","operation"].some(x=>valid.has(x))) {
      if(!/operationeel|operationele|operativ|opérationnel|operacional|operativo|operaties/i.test(lv)) hits.push("operations");
    }
    if(hits.length>0) flags.push({key:k,loc:lv,en:env,hits:[...new Set(hits)]});
  }
  report[code]=flags;
}
let total=0;
for(const [code,flags] of Object.entries(report)){console.log(`${code.toUpperCase()} final=${flags.length}`);total+=flags.length;}
console.log("TOTAL FINAL:",total);
writeFileSync("scripts/mixed_final.json",JSON.stringify(report,null,2));
