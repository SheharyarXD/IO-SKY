/**
 * Print raw Forge LLM response for one small batch, to understand why our
 * matching code returned 0 translations.
 */
const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.ai";
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const pairs = [
  { key: "nav.infrastructure", en: "Infrastructure" },
  { key: "nav.intelligence", en: "Intelligence" },
  { key: "hero.headline.line1", en: "Operational growth becomes" },
];

const sys = `You are a senior IO SKY localization specialist. Translate every entry into Italian. Return ONLY {"translations":{"<key>":"<italian value>"}}. Do not translate "IO SKY".`;
const user =
  "Translate these into Italian:\n" +
  pairs.map((p) => `${JSON.stringify(p.key)} -> ${JSON.stringify(p.en)}`).join("\n");

const body = {
  messages: [
    { role: "system", content: sys },
    { role: "user", content: user },
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
console.log("status", res.status);
const txt = await res.text();
console.log(txt.slice(0, 1500));
