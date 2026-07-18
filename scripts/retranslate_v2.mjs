/**
 * IO SKY — retranslate every key in target locale that still equals the
 * English source. Uses a plain-JSON instruction (no response_format), parses
 * the model's output as JSON (with or without ```json fences).
 */
import fs from "node:fs";
import path from "node:path";

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_KEY) { console.error("BUILT_IN_FORGE_API_KEY missing"); process.exit(1); }

const I18N_DIR = "/home/ubuntu/io-sky/client/src/lib/i18n";
const LANGS = [
  { code: "nl", name: "Dutch" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "ar", name: "Arabic" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Simplified Chinese" },
];

function parse(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const entries = [];
  const re = /^(\s*)"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")(\s*,?\s*)$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    try {
      entries.push({
        key: m[2],
        value: JSON.parse(m[3]),
        rangeStart: m.index,
        rangeEnd: m.index + m[0].length,
        leadingWs: m[1],
        trailingWsComma: m[4],
      });
    } catch { /* */ }
  }
  return { src, entries };
}

function applyReplacements(filePath, replacements) {
  const { src, entries } = parse(filePath);
  let out = src;
  const sorted = [...entries].sort((a, b) => b.rangeStart - a.rangeStart);
  for (const e of sorted) {
    if (!replacements.has(e.key)) continue;
    const newVal = replacements.get(e.key);
    const newLine = `${e.leadingWs}${JSON.stringify(e.key)}: ${JSON.stringify(newVal)}${e.trailingWsComma}`;
    out = out.slice(0, e.rangeStart) + newLine + out.slice(e.rangeEnd);
  }
  fs.writeFileSync(filePath, out, "utf8");
}

function extractJson(text) {
  if (!text) return null;
  // Strip code fences
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(t);
  if (fence) t = fence[1].trim();
  // Otherwise find first { ... last }
  if (!t.startsWith("{")) {
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first !== -1 && last > first) t = t.slice(first, last + 1);
  }
  try { return JSON.parse(t); } catch { return null; }
}

async function callForge(systemMsg, userMsg) {
  const body = {
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ],
  };
  const res = await fetch(`${FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,150)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(typeof content === "string" ? content : "");
  if (!parsed) throw new Error(`bad output: ${String(content).slice(0,150)}`);
  return parsed.translations || parsed;
}

function systemFor(name) {
  return `You are a senior localization specialist for IO SKY, a Dutch enterprise software brand. Tone: confident, professional, executive operational-intelligence.

Rules:
- Translate every entry into ${name}. Never leave English unless the value is itself a brand name or acronym.
- Preserve placeholders ({name}, {count}) exactly.
- Keep "IO SKY" untranslated. Keep these acronyms unchanged: AI, CRM, ERP, MFA, SLA, KPI, SaaS, API, ROI, GDPR, HIPAA, ISO 27001, SOC 2, NIS2, IoT, EBITDA, RPA, OCR, NLP, LLM, IaC, AS/400.
- Keep length roughly comparable to the source.
- For Arabic: formal Modern Standard Arabic.
- For Simplified Chinese: mainland-China conventions and rhythm.
- For Japanese: polite です/ます register suitable for executive readers.

Output ONLY a JSON object of the exact form:
{"translations":{"<key>":"<value in ${name}>", ...}}
Include every requested key. No prose, no explanation, no markdown fence.`;
}

async function withRetry(fn, label) {
  let lastErr;
  for (let i = 1; i <= 4; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; if (i < 4) await new Promise(r=>setTimeout(r, 1200*i)); else console.warn(`[give up] ${label}: ${e.message}`); }
  }
  throw lastErr;
}

async function processLang(lang, name) {
  const enPath = path.join(I18N_DIR, "en.ts");
  const tgtPath = path.join(I18N_DIR, `${lang}.ts`);
  const en = Object.fromEntries(parse(enPath).entries.map(e => [e.key, e.value]));
  const tgt = Object.fromEntries(parse(tgtPath).entries.map(e => [e.key, e.value]));
  const needs = Object.keys(en).filter(k => tgt[k] === en[k]);
  if (needs.length === 0) { console.log(`✓ ${lang}: clean`); return; }
  console.log(`→ ${lang}: ${needs.length} fallbacks (${name})`);
  const CHUNK = 50;
  let totalDone = 0;
  for (let i = 0; i < needs.length; i += CHUNK) {
    const slice = needs.slice(i, i + CHUNK);
    const pairs = slice.map(k => ({ key: k, en: en[k] }));
    const userMsg =
      `Translate these strings into ${name}. Return JSON only.\n\n` +
      pairs.map(p => `${JSON.stringify(p.key)} -> ${JSON.stringify(p.en)}`).join("\n");
    let result;
    try {
      result = await withRetry(() => callForge(systemFor(name), userMsg), `${lang}-${i}`);
    } catch (e) { console.warn(`  ✗ ${lang} batch ${i}: ${e.message}`); continue; }
    const repl = new Map();
    let n = 0;
    for (const p of pairs) {
      const v = result[p.key];
      if (typeof v === "string" && v.trim() && v.trim() !== p.en.trim()) {
        repl.set(p.key, v);
        n++;
      }
    }
    applyReplacements(tgtPath, repl);
    totalDone += n;
    console.log(`  ${lang} ${i + slice.length}/${needs.length}  +${n}/${pairs.length}`);
  }
  console.log(`✓ ${lang}: translated ${totalDone}/${needs.length}`);
}

async function main() {
  for (const { code, name } of LANGS) {
    await processLang(code, name);
  }
  console.log("DONE");
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
