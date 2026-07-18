import { writeFileSync } from "node:fs";
import report from "./identical_audit.json" assert { type: "json" };

const LAT = ["pt","fr","nl","de","it","es"];
// Strip out brand/acronym/email/url tokens; if anything English-looking remains, it's a real leftover.
const isExemptFully = (key:string, en:string) => {
  let t = en.trim();
  if (t.length===0) return true;
  if (key.startsWith("ent.partner.")) return true;       // fictional brand names
  if (/^(LinkedIn|GitHub)$/i.test(t)) return true;
  // remove known safe tokens
  t = t.replace(/IO SKY/g," ")
       .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g," ") // emails
       .replace(/https?:\/\/\S+/g," ")
       .replace(/\b(CRM|ERP|GDPR|RGPD|API|AI|IA|IVR|SMS|SaaS|24\/7)\b/gi," ")
       .replace(/[^A-Za-z]/g," ")  // keep only letters
       .trim();
  if (t.length===0) return true;       // only brand/acronyms/symbols remained
  // remaining single short token that is itself a loanword candidate (<= 1 word, len handled by judgement) -> still flag for review except pure 'Software'
  if (/^Software$/i.test(t)) return true;
  return false;
};
for (const code of LAT) {
  const flags = (report as any)[code] as {key:string; en:string; loc:string}[];
  const rows = flags.filter(f=>!isExemptFully(f.key, f.en)).map(f=>`${f.key}\t${f.en.replace(/\t/g," ")}`);
  writeFileSync(`/tmp/leftover_${code}.tsv`, rows.join("\n")+(rows.length?"\n":""));
  console.log(code.toUpperCase(), rows.length);
}
