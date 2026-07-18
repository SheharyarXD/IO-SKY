/**
 * IO SKY — Translate locale chunks via the Forge LLM endpoint.
 *
 * Reads /tmp/translate/task_*.json, calls forge.manus.ai for each chunk with a
 * structured JSON response, then merges the result into the corresponding
 * client/src/lib/i18n/<lang>.ts dictionary file by appending the missing keys.
 *
 * Idempotent: if a target locale already contains a key, that key is skipped.
 *
 * Run:  node /home/ubuntu/io-sky/scripts/translate_locales.mjs
 */
import fs from "node:fs";
import path from "node:path";

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;
if (!FORGE_KEY) {
  console.error("BUILT_IN_FORGE_API_KEY missing");
  process.exit(1);
}

const TASKS_DIR = "/tmp/translate";
const I18N_DIR = "/home/ubuntu/io-sky/client/src/lib/i18n";

function parseLocaleFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const m of src.matchAll(/^\s*"([^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$/gm)) {
    try {
      map.set(m[1], JSON.parse(m[2]));
    } catch {
      /* ignore */
    }
  }
  return { src, map };
}

/** Append entries `{ key: value }` into `client/src/lib/i18n/<lang>.ts`.
 *  Inserted right before the closing brace `};`. */
function appendEntries(lang, entries) {
  const filePath = path.join(I18N_DIR, `${lang}.ts`);
  let src = fs.readFileSync(filePath, "utf8");
  const closingIdx = src.lastIndexOf("};");
  if (closingIdx === -1) throw new Error(`Cannot locate closing brace in ${lang}.ts`);
  const lines = [];
  for (const [k, v] of Object.entries(entries)) {
    const safe = JSON.stringify(v);
    lines.push(`  ${JSON.stringify(k)}: ${safe},`);
  }
  const insertion = `  // Auto-translated additions (${new Date().toISOString()})\n${lines.join("\n")}\n`;
  src = src.slice(0, closingIdx) + insertion + src.slice(closingIdx);
  fs.writeFileSync(filePath, src, "utf8");
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
          properties: {
            translations: {
              type: "object",
              additionalProperties: { type: "string" },
            },
          },
          required: ["translations"],
        },
      },
    },
  };
  const res = await fetch(`${FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${FORGE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forge HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  // The structured JSON can either come back as a JSON-stringified object
  // or already as an object; handle both.
  let parsed;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : content;
  } catch (e) {
    throw new Error(`Bad JSON from Forge: ${content.slice(0, 200)}`);
  }
  if (!parsed || typeof parsed.translations !== "object") {
    throw new Error(`Missing 'translations' object`);
  }
  return parsed.translations;
}

function systemFor(langName) {
  return `You are a senior localization specialist for IO SKY, a Dutch enterprise software brand (operational intelligence + AI infrastructure for executives).

Tone: confident, professional, executive operational-intelligence — never marketing fluff, never overly literal.

Rules:
1. Preserve placeholders such as {name}, {count} exactly as-is.
2. Preserve the brand name "IO SKY" unchanged (do NOT translate it).
3. Preserve well-known acronyms (AI, CRM, ERP, MFA, SLA, KPI, SaaS, API, ROI, TCO, GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001, NIS2, AS/400, RPA, OCR, NLP, LLM, IoT, EBITDA).
4. Keep length roughly comparable to the source so layouts don't break.
5. Translate every key — never leave English unless the value is itself a brand name or acronym.
6. For Arabic: formal Modern Standard Arabic.
7. For Simplified Chinese: mainland-China conventions, traditional rhythm.
8. For Japanese: polite "です/ます" register for executive readers.

Return only the JSON object { "translations": { "<key>": "<translated value>", ... } }. Cover every key exactly once.`;
}

function userFor(pairs, langName) {
  const lines = pairs.map((p) => `${JSON.stringify(p.key)} -> ${JSON.stringify(p.en)}`);
  return `Translate the following English source strings into ${langName}. Return a JSON object whose "translations" property maps each given key to its translated string.\n\n${lines.join("\n")}`;
}

async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`[retry ${attempt}] ${label}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith(".json")).sort();
  // Cache per-language current dictionary so we skip already-translated keys.
  const dicts = new Map();
  for (const f of files) {
    const task = JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), "utf8"));
    const { lang, name, pairs, chunkIndex } = task;
    if (!dicts.has(lang)) {
      const { map } = parseLocaleFile(path.join(I18N_DIR, `${lang}.ts`));
      dicts.set(lang, map);
    }
    const dict = dicts.get(lang);
    const todo = pairs.filter((p) => !dict.has(p.key));
    if (todo.length === 0) {
      console.log(`✓ ${lang} chunk ${chunkIndex}: already complete (skip)`);
      continue;
    }
    console.log(`→ ${lang} chunk ${chunkIndex}: translating ${todo.length} keys (${name})`);
    const translations = await withRetry(
      () => callForge(systemFor(name), userFor(todo, name)),
      `${lang}-${chunkIndex}`,
    );

    // Filter to only keys we asked for, in source order, with non-empty values.
    const clean = {};
    for (const p of todo) {
      const v = translations[p.key];
      if (typeof v === "string" && v.trim().length > 0) {
        clean[p.key] = v;
      } else {
        clean[p.key] = p.en; // fallback to EN so we never leave gaps
      }
    }
    appendEntries(lang, clean);
    // Update in-memory cache so subsequent chunks for same lang also skip.
    for (const [k, v] of Object.entries(clean)) dict.set(k, v);
    console.log(`  ✓ wrote ${Object.keys(clean).length} keys to ${lang}.ts`);
  }
  console.log("All translations complete.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
