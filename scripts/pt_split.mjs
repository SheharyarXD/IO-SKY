import fs from "node:fs";
const missing = JSON.parse(fs.readFileSync("scripts/pt_missing.json", "utf8"));
const entries = Object.entries(missing);
const SIZE = 45;
const batches = [];
for (let i = 0; i < entries.length; i += SIZE) {
  batches.push(entries.slice(i, i + SIZE));
}
fs.mkdirSync("scripts/pt_batches", { recursive: true });
batches.forEach((b, idx) => {
  const obj = Object.fromEntries(b);
  fs.writeFileSync(`scripts/pt_batches/batch_${idx}.json`, JSON.stringify(obj, null, 2));
});
console.log("Batches:", batches.length, "sizes:", batches.map(b=>b.length).join(","));
