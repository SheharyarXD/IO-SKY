// Finds t("some.key") calls whose key is missing from the English dictionary.
// translate() returns the key itself when it is missing, so a call written as
// t("key") || "fallback" never reaches its fallback and the raw key is shown.
import fs from "node:fs";
import path from "node:path";

const en = fs.readFileSync("client/src/lib/i18n/en.ts", "utf8");
const have = new Set([...en.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((m) => m[1]));
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(f.name) && !/\.test\./.test(f.name) && !p.replace(/\\/g, "/").includes("lib/i18n/")) files.push(p);
  }
})("client/src");
const miss = {};
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  // capture the key and, when present, the fallback string that follows "||"
  for (const m of s.matchAll(/\bt\(\s*"([a-zA-Z0-9_.-]+\.[a-zA-Z0-9_.-]+)"\s*(?:,[^)]*)?\)\s*(?:\|\|\s*(?:\n\s*)?(?:"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`))?/g)) {
    if (have.has(m[1])) continue;
    (miss[m[1]] ??= { files: new Set(), fallback: m[2] ?? m[3] ?? null });
    miss[m[1]].files.add(path.relative("client/src", f));
    if (!miss[m[1]].fallback && (m[2] || m[3])) miss[m[1]].fallback = m[2] ?? m[3];
  }
}
const keys = Object.keys(miss);
console.log("distinct missing keys:", keys.length, "| with a fallback in code:", keys.filter((k) => miss[k].fallback).length);
const byFile = {};
for (const k of keys) for (const f of miss[k].files) byFile[f] = (byFile[f] || 0) + 1;
console.log(Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([f, n]) => `${n}  ${f}`).join("\n"));
fs.writeFileSync(process.env.OUT ?? "missing-keys.json", JSON.stringify(Object.fromEntries(keys.map((k) => [k, { files: [...miss[k].files], fallback: miss[k].fallback }])), null, 1));
