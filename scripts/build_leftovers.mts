import { en } from "../client/src/lib/i18n/en";
import { writeFileSync } from "node:fs";
import report from "./identical_audit.json" assert { type: "json" };

const LAT = ["pt","fr","nl","de","it","es"];
const isExempt = (key:string, en:string) => {
  const t = en.trim();
  if (/@/.test(t)) return true;                 // emails
  if (/^https?:\/\//.test(t)) return true;      // urls
  if (/io-sky\.io/.test(t)) return true;
  if (/IO SKY/.test(t)) return true;            // brand within
  if (/^©/.test(t)) return true;                // copyright handled separately
  if (key.startsWith("ent.partner.")) return true; // fictional partner brand names
  if (/^(LinkedIn|GitHub)$/i.test(t)) return true;
  if (/^[^A-Za-z]*$/.test(t)) return true;      // no letters
  // single brand/acronym tokens
  if (/^(CRM|ERP|GDPR|RGPD|API|AI|IVR|SMS|SaaS|24\/7)$/i.test(t)) return true;
  return false;
};
for (const code of LAT) {
  const flags = (report as any)[code] as {key:string; en:string; loc:string}[];
  const rows = flags.filter(f=>!isExempt(f.key, f.en)).map(f=>`${f.key}\t${f.en.replace(/\t/g," ")}`);
  writeFileSync(`/tmp/leftover_${code}.tsv`, rows.join("\n")+"\n");
  console.log(code.toUpperCase(), "to-translate:", rows.length);
}
