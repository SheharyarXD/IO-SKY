/**
 * Prompt comparison and preview (task G06; SRS 19.7; 29 Oct Ch5, ACC-36). Pure
 * helpers for the prompt configuration screen. Nothing here calls a model: a
 * preview shows the prompt text with sample values filled in, so checking a
 * change costs nothing and sends nothing to a provider.
 *
 *  - Compare: a line-by-line difference between two versions, so a reviewer sees
 *    exactly what changed before activating one.
 *  - Preview: `{{name}}` placeholders are filled from the sample values given.
 *    Only whole, well-formed placeholders are replaced, nothing is evaluated, and
 *    a placeholder with no sample value is shown as missing rather than dropped.
 */

export const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]{0,31})\s*\}\}/g;

export const PROMPT_LIMITS = { body: 50_000, sampleCount: 20, sampleValue: 500, diffLines: 2000, recommendedChars: 8000 } as const;

export function findPlaceholders(body: string): string[] {
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/** Rough size for budgeting: about four characters to a token. Labelled as an estimate wherever shown. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export type SampleValues = Record<string, string>;

/** Own properties only: a placeholder named constructor or toString must not reach anything inherited. */
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function cleanSamples(raw: SampleValues): { samples: SampleValues; dropped: string[] } {
  const samples: SampleValues = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(raw).slice(0, PROMPT_LIMITS.sampleCount)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(k) || typeof v !== "string") {
      dropped.push(k);
      continue;
    }
    samples[k] = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, PROMPT_LIMITS.sampleValue);
  }
  return { samples, dropped };
}

export type Preview = {
  rendered: string;
  placeholders: string[];
  unresolved: string[];
  estimatedTokens: number;
  warnings: Array<"empty" | "unresolved_placeholders" | "very_long" | "unclosed_placeholder">;
};

export function renderPreview(body: string, rawSamples: SampleValues = {}): Preview {
  const { samples } = cleanSamples(rawSamples);
  const placeholders = findPlaceholders(body);
  const unresolved = placeholders.filter((p) => !hasOwn(samples, p));
  // Replacement is done in one pass over the original text, so a value that itself contains {{x}} is never re-expanded.
  const rendered = body.replace(PLACEHOLDER, (_m, name: string) => (hasOwn(samples, name) ? samples[name] : `[missing: ${name}]`));
  const warnings: Preview["warnings"] = [];
  if (body.trim().length === 0) warnings.push("empty");
  if (unresolved.length > 0) warnings.push("unresolved_placeholders");
  if (body.length > PROMPT_LIMITS.recommendedChars) warnings.push("very_long");
  const stripped = body.replace(PLACEHOLDER, "");
  if (/\{\{|\}\}/.test(stripped)) warnings.push("unclosed_placeholder");
  return { rendered, placeholders, unresolved, estimatedTokens: estimateTokens(rendered), warnings };
}

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

export type DiffOp = { type: "same" | "added" | "removed"; text: string };

export type PromptDiff = { ops: DiffOp[]; added: number; removed: number; unchanged: number; identical: boolean; truncated: boolean };

const lines = (t: string) => (t.length === 0 ? [] : t.replace(/\r\n/g, "\n").split("\n"));

/** Line difference by longest common subsequence. Inputs beyond the line cap are cut and the result is marked truncated. */
export function diffPrompts(from: string, to: string): PromptDiff {
  const cap = PROMPT_LIMITS.diffLines;
  const a = lines(from);
  const b = lines(to);
  const truncated = a.length > cap || b.length > cap;
  const x = a.slice(0, cap);
  const y = b.slice(0, cap);
  const n = x.length;
  const m = y.length;
  // lcs[i][j] = length of the LCS of x[i..] and y[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      ops.push({ type: "same", text: x[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) ops.push({ type: "removed", text: x[i++] });
    else ops.push({ type: "added", text: y[j++] });
  }
  while (i < n) ops.push({ type: "removed", text: x[i++] });
  while (j < m) ops.push({ type: "added", text: y[j++] });
  const added = ops.filter((o) => o.type === "added").length;
  const removed = ops.filter((o) => o.type === "removed").length;
  return { ops, added, removed, unchanged: ops.length - added - removed, identical: added === 0 && removed === 0 && !truncated, truncated };
}
