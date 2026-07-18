import { writeFileSync } from "node:fs";
import report from "./identical_audit.json" assert { type: "json" };
const LAT=["pt","fr","nl","de","it","es"];
const strip=(en:string)=>en.trim()
  .replace(/IO SKY/g," ")
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g," ")
  .replace(/https?:\/\/\S+/g," ")
  .replace(/\b(CRM|ERP|GDPR|RGPD|API|AI|IA|IVR|SMS|SaaS|24\/7)\b/gi," ")
  .replace(/[^A-Za-z]/g," ").trim();
for(const code of LAT){
  const flags=(report as any)[code] as {key:string;en:string;loc:string}[];
  // real sentence = remaining english words form >=2 words
  const rows=flags.filter(f=>{
    if(f.key.startsWith("ent.partner."))return false;
    const r=strip(f.en);
    if(r.length===0)return false;
    return r.split(/\s+/).length>=2;   // multiword english = genuinely untranslated phrase
  }).map(f=>`${f.key}\t${f.en.replace(/\t/g," ")}`);
  writeFileSync(`/tmp/sent_${code}.tsv`, rows.join("\n")+(rows.length?"\n":""));
  console.log(code.toUpperCase(), rows.length);
}
