import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const I18N_DIR = path.resolve(__dirname, "../client/src/lib/i18n");
function parse(code){
  const src=readFileSync(path.join(I18N_DIR,`${code}.ts`),"utf8");
  const map={};const re=/"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;let m;
  while((m=re.exec(src))!==null)map[m[1]]=m[2];return map;
}
const en=parse("en"), pt=parse("pt");
const r=JSON.parse(readFileSync(path.join(__dirname,"locale_audit2.json"),"utf8"));
const keys=[];const bp=r.pt.byPrefix;
for(const p of Object.keys(bp))for(const line of bp[p])keys.push(line.split("  ==  ")[0]);
const rows=keys.map(k=>`${k}\t${en[k]??""}\t${pt[k]??""}`);
writeFileSync("/tmp/pt_todo.tsv",rows.join("\n"));
console.log("count="+rows.length);
console.log(rows.slice(0,40).join("\n"));
