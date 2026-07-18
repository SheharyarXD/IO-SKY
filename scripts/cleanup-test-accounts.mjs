/**
 * IO SKY — LAUNCH CLEANUP: remove or rotate seeded `.local` test accounts.
 *
 * The seed script (scripts/seed-users.mjs) creates three convenience accounts
 * with KNOWN passwords so reviewers can exercise every portal during staging:
 *
 *   admin@iosky.local       (role=admin)
 *   client@iosky.local      (role=client)
 *   developer@iosky.local   (role=developer)
 *
 * These accounts are a LAUNCH BLOCKER — they must never reach production with
 * their well-known passwords. This script provides two safe, auditable modes.
 *
 * Usage:
 *   node scripts/cleanup-test-accounts.mjs --mode=disable   (default; recommended)
 *   node scripts/cleanup-test-accounts.mjs --mode=rotate    (keep accounts, new random passwords)
 *   node scripts/cleanup-test-accounts.mjs --mode=delete    (hard-delete the rows)
 *
 *   --yes   Skip the confirmation prompt (for CI / non-interactive use).
 *
 * Modes:
 *   disable  → blanks the passwordHash (login via local password becomes
 *              impossible) and sets loginMethod='disabled'. Reversible by
 *              re-running the seed or rotate.
 *   rotate   → assigns a freshly generated 24-char random password to each
 *              account and prints it ONCE to stdout. Copy it to your password
 *              manager; it is not stored anywhere else.
 *   delete   → removes the user rows entirely (and the demo-org membership for
 *              the client). Use only if you do not want the accounts at all.
 *
 * The script is idempotent and prints exactly what it changed.
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import readline from "node:readline";

const TEST_EMAILS = [
  "admin@iosky.local",
  "client@iosky.local",
  "developer@iosky.local",
];

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = "disable";
  let yes = false;
  for (const a of args) {
    if (a.startsWith("--mode=")) mode = a.split("=")[1];
    if (a === "--yes" || a === "-y") yes = true;
  }
  if (!["disable", "rotate", "delete"].includes(mode)) {
    console.error(`Invalid --mode=${mode}. Use disable | rotate | delete.`);
    process.exit(1);
  }
  return { mode, yes };
}

function randomPassword() {
  // 24 url-safe chars, plenty of entropy; not stored anywhere but stdout.
  return crypto.randomBytes(18).toString("base64url");
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase() === "yes");
    });
  });
}

async function main() {
  const { mode, yes } = parseArgs();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log(`\nIO SKY — test-account cleanup`);
  console.log(`Mode:    ${mode}`);
  console.log(`Targets: ${TEST_EMAILS.join(", ")}\n`);

  if (!yes) {
    const ok = await confirm(
      `This will ${mode.toUpperCase()} the accounts above. Type "yes" to proceed: `,
    );
    if (!ok) {
      console.log("Aborted. No changes made.");
      process.exit(0);
    }
  }

  const conn = await mysql.createConnection(url);
  try {
    for (const email of TEST_EMAILS) {
      const [rows] = await conn.execute(
        "SELECT id, role FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`  • skip      ${email} (not found)`);
        continue;
      }
      const userId = rows[0].id;

      if (mode === "delete") {
        // Remove org membership first to satisfy FK-free integrity, then user.
        await conn.execute("DELETE FROM organization_memberships WHERE userId = ?", [userId]).catch(() => {});
        await conn.execute("DELETE FROM users WHERE id = ?", [userId]);
        console.log(`  • deleted   ${email}`);
      } else if (mode === "rotate") {
        const pw = randomPassword();
        const hash = bcrypt.hashSync(pw, 12);
        await conn.execute(
          "UPDATE users SET passwordHash = ?, updatedAt = NOW() WHERE id = ?",
          [hash, userId],
        );
        console.log(`  • rotated   ${email}  NEW PASSWORD: ${pw}`);
      } else {
        // disable
        await conn.execute(
          "UPDATE users SET passwordHash = '', loginMethod = 'disabled', updatedAt = NOW() WHERE id = ?",
          [userId],
        );
        console.log(`  • disabled  ${email} (local password login blocked)`);
      }
    }

    if (mode === "rotate") {
      console.log(
        `\n⚠  Copy the rotated passwords above into your password manager NOW.\n   They are not stored anywhere else.\n`,
      );
    }
    console.log("Done.\n");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
