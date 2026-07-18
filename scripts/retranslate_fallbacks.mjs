/**
 * Re-translate the keys that still equal the English source value, for every
 * target locale. Writes the new translations *in place* (replaces the value
 * of each key) so we don't append duplicates.
 *
 * Usage: node /home/ubuntu/io-sky/scripts/retranslate_fallbacks.mjs
 */
import fs from "node:fs";
import path from "node:path";

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_KEY) {
  console.error("BUILT_IN_FORGE_API_KEY missing"); process.exit(1);
}

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
  const entries = []; // [{ key, value, raw, range:[start,end] }]
  const re = /^(\s*)"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")(\s*,?\s*)$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    try {
      entries.push({
        key: m[2],
        value: JSON.parse(m[3]),
        rawLine: m[0],
        rangeStart: m.index,
        rangeEnd: m.index + m[0].length,
        leadingWs: m[1],
        trailingWsComma: m[4],
      });
    } catch { /* skip */ }
  }
  return { src, entries };
}

function applyReplacements(filePath, replacements) {
  // replacements: Map<key, newValue>
  const { src, entries } = parse(filePath);
  // Build replacement in reverse order to keep offsets valid.
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

async function callForge(systemMsg, userMsg) {
  const body = {
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "translations",
        strict: false,
        schema: {
          type: "object",
          properties: { translations: { type: "object", additionalProperties: { type: "string" } } },
          required: ["translations"],
        },
      },
    },
  };
  const res = await fetch(`${FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Forge HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  let parsed;
  try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch (e) {
    throw new Error(`Bad JSON: ${String(content).slice(0, 200)}`);
  }
  if (!parsed?.translations || typeof parsed.translations !== "object") throw new Error("missing translations");
  return parsed.translations;
}

function systemFor(name) {
  return `You are a senior localization specialist for IO SKY (Dutch enterprise software brand). Tone: confident, professional, executive operational-intelligence.

Rules:
- Preserve placeholders ({name}, {count}) exactly.
- Keep "IO SKY" untranslated. Keep acronyms (AI, CRM, ERP, MFA, SLA, KPI, SaaS, API, ROI, GDPR, HIPAA, ISO 27001, SOC 2, NIS2, IoT, EBITDA, RPA, OCR, NLP, LLM, IaC, AS/400) unchanged.
- Keep length close to source.
- Translate every entry into ${name}. Do NOT return English unless the value is a brand name/acronym.
- For Arabic: formal Modern Standard Arabic.
- For Simplified Chinese: mainland-China conventions, traditional rhythm.
- For Japanese: polite です/ます register.

Return ONLY { "translations": { "<key>": "<value in ${name}>", ... } } with every requested key.`;
}

async function withRetry(fn, label) {
  let lastErr;
  for (let i = 1; i <= 4; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; console.warn(`[retry ${i}] ${label}: ${e.message}`); await new Promise(r => setTimeout(r, 1500 * i)); }
  }
  throw lastErr;
}

async function processLang(lang, name) {
  const enPath = path.join(I18N_DIR, "en.ts");
  const tgtPath = path.join(I18N_DIR, `${lang}.ts`);
  const en = Object.fromEntries(parse(enPath).entries.map((e) => [e.key, e.value]));
  const tgt = Object.fromEntries(parse(tgtPath).entries.map((e) => [e.key, e.value]));
  const needs = Object.keys(en).filter((k) => tgt[k] === en[k]);
  if (needs.length === 0) {
    console.log(`✓ ${lang}: no fallbacks remaining`);
    return;
  }
  console.log(`→ ${lang}: ${needs.length} fallbacks to fix`);
  const CHUNK = 60;
  for (let i = 0; i < needs.length; i += CHUNK) {
    const slice = needs.slice(i, i + CHUNK);
    const pairs = slice.map((k) => ({ key: k, en: en[k] }));
    const user = `Translate the following English source strings into ${name}. Return { "translations": { "<key>": "<translated value>" } } for every key.\n\n` +
      pairs.map((p) => `${JSON.stringify(p.key)} -> ${JSON.stringify(p.en)}`).join("\n");
    const result = await withRetry(() => callForge(systemFor(name), user), `${lang}-${i}`);
    const repl = new Map();
    let translated = 0;
    for (const p of pairs) {
      const v = result[p.key];
      if (typeof v === "string" && v.trim() && v.trim() !== p.en.trim()) {
        repl.set(p.key, v);
        translated++;
      }
    }
    applyReplacements(tgtPath, repl);
    console.log(`  ✓ ${lang} batch ${Math.floor(i / CHUNK) + 1}: translated ${translated}/${pairs.length}`);
  }
}

async function main() {
  for (const { code, name } of LANGS) {
    await processLang(code, name);
  }
  console.log("All fallbacks re-translated.");
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
