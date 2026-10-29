/*
 * G06 (SRS 19.7; 29 Oct Ch5, ACC-36): prompt comparison and preview. Pure rules plus
 * the endpoints with the data layer mocked. Nothing calls a model.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanSamples, diffPrompts, estimateTokens, findPlaceholders, PROMPT_LIMITS, renderPreview } from "../shared/promptTools";

describe("placeholders", () => {
  it("finds each well-formed {{name}} once, allowing inner spaces", () => {
    expect(findPlaceholders("Hi {{customer_name}}, your {{ plan }} and {{customer_name}} again")).toEqual(["customer_name", "plan"]);
  });
  it("ignores malformed ones", () => {
    for (const bad of ["{{Name}}", "{{1abc}}", "{{a-b}}", "{{}}", "{ {x} }", "{{x", "x}}", "{{ " + "a".repeat(40) + " }}"]) expect(findPlaceholders(bad), bad).toEqual([]);
  });
});

describe("preview", () => {
  it("fills placeholders from the samples", () => {
    const p = renderPreview("Hello {{customer_name}} from {{ company }}.", { customer_name: "Pat", company: "Acme" });
    expect(p).toMatchObject({ rendered: "Hello Pat from Acme.", placeholders: ["customer_name", "company"], unresolved: [], warnings: [] });
  });
  it("shows a missing value as missing instead of dropping it, and warns", () => {
    const p = renderPreview("Hello {{customer_name}}", {});
    expect(p.rendered).toBe("Hello [missing: customer_name]");
    expect(p.unresolved).toEqual(["customer_name"]);
    expect(p.warnings).toEqual(["unresolved_placeholders"]);
  });
  it("is a single pass: a value containing a placeholder is not expanded again", () => {
    const p = renderPreview("A {{x}} B {{y}}", { x: "{{y}}", y: "secret" });
    expect(p.rendered).toBe("A {{y}} B secret");
  });
  it("evaluates nothing: markup, template syntax and code in a sample stay as text", () => {
    const p = renderPreview("Say {{x}}", { x: "${process.env.SECRET} <script>alert(1)</script> {{constructor}}" });
    expect(p.rendered).toBe("Say ${process.env.SECRET} <script>alert(1)</script> {{constructor}}");
  });
  it("cannot reach inherited properties through a placeholder name", () => {
    // `constructor` is a valid placeholder name and exists on every object; it must be reported missing, never looked up.
    expect(renderPreview("{{constructor}}", {}).rendered).toBe("[missing: constructor]");
    expect(renderPreview("{{constructor}}", {}).unresolved).toEqual(["constructor"]);
    // camel-case names (toString, hasOwnProperty) are not valid placeholders at all and stay as plain text
    expect(renderPreview("{{toString}} {{hasOwnProperty}}", {}).rendered).toBe("{{toString}} {{hasOwnProperty}}");
    // it is replaced only when the caller supplies it themselves
    expect(renderPreview("{{constructor}}", { constructor: "yes" } as never).rendered).toBe("yes");
  });
  it("warns on empty, very long and unfinished prompts", () => {
    expect(renderPreview("   ").warnings).toContain("empty");
    expect(renderPreview("x".repeat(PROMPT_LIMITS.recommendedChars + 1)).warnings).toContain("very_long");
    expect(renderPreview("Hello {{name").warnings).toContain("unclosed_placeholder");
    expect(renderPreview("Hello name}}").warnings).toContain("unclosed_placeholder");
    expect(renderPreview("Hello {{name}} fine", { name: "x" }).warnings).toEqual([]);
  });
  it("estimates size as about four characters a token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(renderPreview("x".repeat(400)).estimatedTokens).toBe(100);
  });
});

describe("sample values", () => {
  it("keeps good names, drops bad ones, cleans control characters and caps length and count", () => {
    const { samples, dropped } = cleanSamples({ ok: "fine", "Bad Name": "x", "9x": "y", also_ok: "a\u0000b\u0007c", long: "z".repeat(900) });
    expect(Object.keys(samples).sort()).toEqual(["also_ok", "long", "ok"]);
    expect(dropped.sort()).toEqual(["9x", "Bad Name"]);
    expect(samples.also_ok).toBe("a b c");
    expect(samples.long).toHaveLength(PROMPT_LIMITS.sampleValue);
    const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, "v"]));
    expect(Object.keys(cleanSamples(many).samples)).toHaveLength(PROMPT_LIMITS.sampleCount);
  });
});

describe("compare", () => {
  it("identical text has no changes", () => {
    const d = diffPrompts("a\nb\nc", "a\nb\nc");
    expect(d).toMatchObject({ identical: true, added: 0, removed: 0, unchanged: 3, truncated: false });
  });
  it("shows an added, a removed and a changed line in order", () => {
    const d = diffPrompts("You are helpful.\nBe brief.\nNever guess.", "You are helpful.\nBe concise.\nNever guess.\nAsk before acting.");
    expect(d.ops).toEqual([
      { type: "same", text: "You are helpful." },
      { type: "removed", text: "Be brief." },
      { type: "added", text: "Be concise." },
      { type: "same", text: "Never guess." },
      { type: "added", text: "Ask before acting." },
    ]);
    expect(d).toMatchObject({ added: 2, removed: 1, unchanged: 2, identical: false });
  });
  it("handles empty sides and CRLF line endings", () => {
    expect(diffPrompts("", "a\nb")).toMatchObject({ added: 2, removed: 0 });
    expect(diffPrompts("a\nb", "")).toMatchObject({ added: 0, removed: 2 });
    expect(diffPrompts("", "")).toMatchObject({ identical: true, ops: [] });
    expect(diffPrompts("a\r\nb", "a\nb").identical).toBe(true);
  });
  it("applying the operations to the old text always gives the new text (a property check)", () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const words = ["alpha", "beta", "gamma", "delta", "same line"];
    for (let k = 0; k < 200; k++) {
      const gen = () => Array.from({ length: rnd(12) }, () => words[rnd(words.length)]).join("\n");
      const a = gen();
      const b = gen();
      const d = diffPrompts(a, b);
      const rebuiltNew = d.ops.filter((o) => o.type !== "removed").map((o) => o.text).join("\n");
      const rebuiltOld = d.ops.filter((o) => o.type !== "added").map((o) => o.text).join("\n");
      expect(rebuiltNew, `new #${k}`).toBe(b);
      expect(rebuiltOld, `old #${k}`).toBe(a);
      expect(d.added + d.removed + d.unchanged).toBe(d.ops.length);
    }
  });
  it("keeps the common lines (it finds a shortest edit, not a rewrite)", () => {
    const old = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const next = old.replace("line 25", "changed 25");
    const d = diffPrompts(old, next);
    expect(d).toMatchObject({ added: 1, removed: 1, unchanged: 49 });
  });
  it("cuts very long input and says so", () => {
    const big = Array.from({ length: PROMPT_LIMITS.diffLines + 50 }, (_, i) => `l${i}`).join("\n");
    const d = diffPrompts(big, big);
    expect(d.truncated).toBe(true);
    expect(d.identical).toBe(false); // never claim identical when part was not compared
    expect(d.ops).toHaveLength(PROMPT_LIMITS.diffLines);
  });
});

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({
  appendLoginAudit: vi.fn(async () => {}),
  listPromptVersions: vi.fn(),
}));
vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listVerifiedMfaFactorsForUser: vi.fn(async () => [{ id: 1, userId: 1, kind: "totp", verifiedAt: new Date() }]), ...m };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type U = NonNullable<TrpcContext["user"]>;
function ctx(role: U["role"]): TrpcContext {
  return {
    user: { id: 99, openId: "test-admin", email: "ops@example.com", name: "Ops Admin", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    impersonation: null,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}
const ops = (role: U["role"] = "admin") => appRouter.createCaller(ctx(role)).adminOps;
const versions = [
  { version: 1, body: "Be brief.\nNever guess.", isActive: false, createdAt: new Date("2026-10-01"), changeNote: "first" },
  { version: 2, body: "Be concise.\nNever guess.\nHello {{customer_name}}", isActive: true, createdAt: new Date("2026-10-10"), changeNote: null },
];

describe("adminOps prompt endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.listPromptVersions.mockResolvedValue(versions);
  });
  it("are staff only", async () => {
    for (const role of ["client", "developer"] as const) {
      await expect(ops(role).comparePromptVersions({ agentKey: "a", from: 1, to: 2 }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(ops(role).previewPrompt({ body: "x" }), role).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("compares two saved versions", async () => {
    const r = await ops().comparePromptVersions({ agentKey: "a", from: 1, to: 2 });
    expect(r).toMatchObject({ from: { version: 1, isActive: false }, to: { version: 2, isActive: true }, added: 2, removed: 1, unchanged: 1, identical: false });
    expect(m.listPromptVersions).toHaveBeenCalledWith("a");
  });
  it("404s on an unknown version rather than comparing against nothing", async () => {
    await expect(ops().comparePromptVersions({ agentKey: "a", from: 1, to: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    m.listPromptVersions.mockResolvedValueOnce([]);
    await expect(ops().comparePromptVersions({ agentKey: "a", from: 1, to: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("previews draft text, or a saved version, with samples", async () => {
    await expect(ops().previewPrompt({ body: "Hi {{customer_name}}", samples: { customer_name: "Pat" } })).resolves.toMatchObject({ rendered: "Hi Pat", unresolved: [] });
    const saved = await ops().previewPrompt({ agentKey: "a", version: 2, samples: { customer_name: "Sam" } });
    expect(saved.rendered).toContain("Hello Sam");
    expect(m.listPromptVersions).toHaveBeenCalledTimes(1); // draft text needs no lookup
    await expect(ops().previewPrompt({ agentKey: "a", version: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("needs exactly one source and bounded input", async () => {
    await expect(ops().previewPrompt({})).rejects.toThrow();
    await expect(ops().previewPrompt({ body: "x", agentKey: "a", version: 1 })).rejects.toThrow();
    await expect(ops().previewPrompt({ agentKey: "a" })).rejects.toThrow();
    await expect(ops().previewPrompt({ body: "x".repeat(PROMPT_LIMITS.body + 1) })).rejects.toThrow();
    await expect(ops().previewPrompt({ body: "x", samples: { k: "v".repeat(PROMPT_LIMITS.sampleValue + 1) } })).rejects.toThrow();
  });
});
