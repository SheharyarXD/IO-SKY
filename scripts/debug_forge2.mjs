const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const pairs = [
  { key: "nav.infrastructure", en: "Infrastructure" },
  { key: "nav.intelligence", en: "Intelligence" },
  { key: "hero.headline.line1", en: "Operational growth becomes" },
];

async function tryModel(model) {
  const sys = `You are a senior IO SKY localization specialist. Translate every entry into Italian. Output ONLY a JSON object of the form {"translations":{"<key>":"<italian value>"}}. Do not translate "IO SKY".`;
  const user = "Translate these into Italian. Return JSON only:\n" +
    pairs.map(p=>`${JSON.stringify(p.key)} -> ${JSON.stringify(p.en)}`).join("\n");
  const body = { model, messages: [
    { role:"system", content: sys },
    { role:"user", content: user },
  ]};
  const res = await fetch(`${FORGE_URL.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${FORGE_KEY}` },
    body: JSON.stringify(body),
  });
  const t = await res.text();
  console.log(`\n=== model=${model} status=${res.status} ===\n${t.slice(0,800)}`);
}

for (const m of ["gpt-4o-mini","gpt-5","claude-haiku-4-5","claude-sonnet-4-5","gemini-2.5-pro"]) {
  try { await tryModel(m); } catch(e){ console.log(m, "ERR", e.message); }
}
