import fs from "node:fs";
import { en } from "../client/src/lib/i18n/en";

const missing = fs
  .readFileSync("/tmp/missing_keys.txt", "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);
const out: Record<string, string> = {};
for (const k of missing) {
  const v = (en as Record<string, string>)[k];
  if (typeof v !== "string") {
    console.warn("Not in en:", k);
    continue;
  }
  out[k] = v;
}
fs.writeFileSync("/tmp/missing_en.json", JSON.stringify(out, null, 2));
console.log("Wrote", Object.keys(out).length, "entries");
