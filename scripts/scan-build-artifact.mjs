#!/usr/bin/env node
/**
 * Milestone 3 §3.2 (RM-82) — confirm no secrets ship in the build artifact.
 *
 * Milestone 1's RM-16 scanned the git history. This scans what actually gets
 * deployed, which is a different question: a secret can be absent from source
 * and still end up in `dist/` because a bundler inlined it. Vite in particular
 * inlines every `VITE_`-prefixed variable into the client bundle at build
 * time, so anything mis-prefixed becomes public the moment it is deployed —
 * which is exactly the failure mode `server/_core/env.ts` warns about for
 * SUPABASE_SECRET_KEY.
 *
 * Usage:
 *   pnpm run build && node scripts/scan-build-artifact.mjs
 *
 * Exits non-zero on any finding so CI fails the build rather than shipping it.
 *
 * Deliberately checks the real values from the current environment as well as
 * generic patterns. Pattern-only scanning misses a credential that does not
 * look like one; value-matching catches it but only for secrets this process
 * can see. Both together is meaningfully stronger than either.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DIST = path.resolve(process.cwd(), "dist");

/** Env vars whose values must never appear in any artifact. */
const SECRET_ENV_VARS = [
  "DATABASE_URL",
  "JWT_SECRET",
  "SUPABASE_SECRET_KEY",
  "STAGING_SECRET",
  "STAGING_PASSWORD",
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "TWILIO_AUTH_TOKEN",
  "ZOHO_CLIENT_SECRET",
  "BUILT_IN_FORGE_API_KEY",
  "SMTP_URL",
];

/**
 * Generic credential shapes. Kept deliberately narrow — a scanner that cries
 * wolf on every base64 blob in a 5 MB minified bundle gets switched off.
 */
const SECRET_PATTERNS = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Stripe live secret key", re: /\bsk_live_[A-Za-z0-9]{20,}\b/ },
  { name: "Postgres URL with inline password", re: /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]{6,}@/ },
  { name: "PEM private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
];

/** Files that must never be present in an artifact at all. */
const FORBIDDEN_FILENAMES = [
  /^\.env(\..*)?$/,
  /^\.npmrc$/,
  /^\.git-credentials$/,
  /\.pem$/,
  /\.p12$/,
  /^id_rsa$/,
  /^\.project-config\.json$/,
];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`[RM-82] No build output at ${DIST}. Run "pnpm run build" first.`);
    process.exit(2);
  }

  const files = walk(DIST);
  if (files.length === 0) {
    console.error("[RM-82] Build output directory is empty — refusing to report a clean scan.");
    process.exit(2);
  }

  const findings = [];

  // 1. Forbidden files shipped alongside the build.
  for (const file of files) {
    const base = path.basename(file);
    if (FORBIDDEN_FILENAMES.some((re) => re.test(base))) {
      findings.push(`FORBIDDEN FILE: ${path.relative(process.cwd(), file)}`);
    }
  }

  // 2. Real secret values from the current environment.
  const liveSecrets = SECRET_ENV_VARS.map((name) => [name, process.env[name]])
    // Short values produce noise (NODE_ENV=production style). A real secret is
    // not 12 characters long.
    .filter(([, value]) => typeof value === "string" && value.length >= 12);

  // 3. Scan contents.
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue; // binary/unreadable — nothing to match textually
    }
    const rel = path.relative(process.cwd(), file);

    for (const [name, value] of liveSecrets) {
      if (content.includes(value)) {
        findings.push(`LEAKED VALUE: ${name} appears verbatim in ${rel}`);
      }
    }
    for (const { name, re } of SECRET_PATTERNS) {
      const match = re.exec(content);
      if (match) {
        findings.push(`PATTERN MATCH: ${name} in ${rel} (near "${match[0].slice(0, 12)}…")`);
      }
    }
  }

  console.log(`[RM-82] Scanned ${files.length} files under dist/.`);
  if (liveSecrets.length === 0) {
    // Say so explicitly. A "clean" scan run without any secrets in the
    // environment has only exercised the pattern half of the check, and
    // reporting that as a full pass would overstate it.
    console.log(
      "[RM-82] NOTE: no secret env vars were set in this process, so only the " +
        "pattern checks ran — the value-matching half was not exercised.",
    );
  } else {
    console.log(`[RM-82] Value-checked ${liveSecrets.length} live secrets from the environment.`);
  }

  if (findings.length > 0) {
    console.error(`\n[RM-82] FAILED — ${findings.length} finding(s):`);
    for (const f of findings) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log("[RM-82] PASS — no secret files or credential values found in the build artifact.");
}

main();
