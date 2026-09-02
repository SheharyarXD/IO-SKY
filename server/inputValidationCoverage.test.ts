/**
 * Milestone 3 §3.3 — XSS surface and input-validation coverage.
 *
 * RM-91: `dangerouslySetInnerHTML` review.
 * RM-93: zod validation coverage across every tRPC procedure.
 *
 * Both are specified in the plan as one-off audits. Written as tests instead
 * so the finding is enforced rather than recorded: an audit that concludes
 * "clean" in a document is stale the moment someone adds a procedure, whereas
 * this fails the CI gate the Milestone 1 workflow already runs on every merge.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");

/** Recursively collect source files under a directory. */
function collectSources(dir: string, exts = [".ts", ".tsx"]): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSources(full, exts));
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// RM-91 — dangerouslySetInnerHTML
// ---------------------------------------------------------------------------
describe("RM-91: dangerouslySetInnerHTML surface", () => {
  it("has no dangerouslySetInnerHTML anywhere in client or server source", () => {
    // The audit found exactly one occurrence, in client/src/components/ui/chart.tsx —
    // an unreferenced shadcn scaffold that injected a <style> block built from
    // caller-supplied config values. Nothing imported it (recharts is used
    // directly in AIScanResult.tsx), so it was deleted rather than hardened,
    // following the RM-04 precedent that removed ui/form.tsx the same way.
    //
    // This assertion keeps the sink from silently reappearing. If a future
    // feature genuinely needs raw HTML injection, this test should be updated
    // deliberately — with a sanitizer in the diff — rather than deleted.
    const offenders = [
      ...collectSources(path.join(repoRoot, "client", "src")),
      ...collectSources(path.join(repoRoot, "server")),
    ]
      // Test sources are excluded: this file names the identifier in its own
      // assertion, so without this the check would always fail on itself.
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => fs.readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));

    expect(offenders.map((f) => path.relative(repoRoot, f))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// RM-93 — zod validation coverage
// ---------------------------------------------------------------------------

type Procedure = {
  file: string;
  name: string;
  kind: string;
  chain: string;
  destructure: string;
};

function parseProcedures(): Procedure[] {
  const dir = path.join(repoRoot, "server", "routers");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  // Matches `name: someProcedure ...chain... .query(|.mutation( (async)? ({ destructure })`
  // Non-greedy so the chain stops at the first terminal call.
  const re =
    /(\w+)\s*:\s*(\w*[Pp]rocedure)\b([\s\S]*?)\.(query|mutation)\s*\(\s*(?:async\s*)?\(?\s*(\{[^}]*\})?/g;

  const found: Procedure[] = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      found.push({
        file: f,
        name: m[1],
        chain: m[3],
        kind: m[4],
        destructure: m[5] ?? "",
      });
    }
  }
  return found;
}

describe("RM-93: zod validation coverage across tRPC procedures", () => {
  const procedures = parseProcedures();

  it("finds the expected procedure surface (guards the parser itself)", () => {
    // If a refactor changes how procedures are declared, this parser could
    // silently match nothing and the coverage assertions below would all
    // trivially pass. Pinning a floor makes that failure loud.
    expect(procedures.length).toBeGreaterThan(150);
  });

  it("every procedure that reads `input` declares a validator for it", () => {
    // This is the assertion that actually matters: a handler destructuring
    // `input` without a preceding `.input(schema)` receives unvalidated,
    // unparsed client data.
    const gaps = procedures
      .filter((p) => p.destructure.includes("input"))
      .filter((p) => !/\.input\s*\(/.test(p.chain))
      .map((p) => `${p.file}:${p.name} (${p.kind})`);

    expect(gaps).toEqual([]);
  });

  it("every declared validator is a zod schema", () => {
    // Accepts both the inline `z.object(...)` form and the named-constant
    // form (adminActionInput, listSlotsSchema, ...). Named constants are
    // resolved back to their declaration so a non-zod validator cannot hide
    // behind an indirection.
    const routerDir = path.join(repoRoot, "server", "routers");
    const allRouterSrc = fs
      .readdirSync(routerDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => fs.readFileSync(path.join(routerDir, f), "utf8"))
      .join("\n");

    const nonZod: string[] = [];
    for (const p of procedures) {
      const arg = /\.input\s*\(\s*([\s\S]{0,60})/.exec(p.chain)?.[1]?.trim();
      if (!arg) continue;
      // Collapse whitespace first: several procedures format the schema as
      // `z\n  .object({...})`, which a naive startsWith("z.") reads as the
      // bare identifier `z` and reports as a non-zod validator.
      const argNorm = arg.replace(/\s+/g, "");
      if (argNorm.startsWith("z.")) continue;

      const identifier = /^([A-Za-z_$][\w$]*)/.exec(argNorm)?.[1];
      if (!identifier) {
        nonZod.push(`${p.file}:${p.name} → ${arg.slice(0, 40)}`);
        continue;
      }
      const declRe = new RegExp(`(?:const|let|var)\\s+${identifier}\\s*(?::[^=]+)?=\\s*z\\.`);
      if (!declRe.test(allRouterSrc)) {
        nonZod.push(`${p.file}:${p.name} → ${identifier} is not a zod schema`);
      }
    }

    expect(nonZod).toEqual([]);
  });

  it("procedures without a validator genuinely take no input", () => {
    const suspicious = procedures
      .filter((p) => !/\.input\s*\(/.test(p.chain))
      .filter((p) => /\binput\b/.test(p.destructure))
      .map((p) => `${p.file}:${p.name}`);

    expect(suspicious).toEqual([]);
  });
});
