/**
 * Seed agreement_versions for the 8 legal documents.
 * Uses the project's existing drizzle helper (server/db.ts → getDb)
 * which already manages SSL/TLS to TiDB Cloud correctly.
 *
 * Run via: tsx scripts/seed-legal-versions.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../server/db";
import {
  legalDocuments,
  agreementVersions,
} from "../drizzle/schema";
import { hashLegalBody } from "../server/legalDb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const LEGAL_DIR = path.join(REPO_ROOT, "references", "legal");

const FILES: Record<string, string> = {
  "privacy-policy": "privacy-policy_v1.0_en.md",
  "terms-of-service": "terms-of-service_v1.0_en.md",
  "cookie-policy": "cookie-policy_v1.0_en.md",
  "ai-disclaimer": "ai-disclaimer_v1.0_en.md",
  "developer-agreement": "developer-agreement_v1.0_en.md",
  nda: "nda_v1.0_en.md",
  "access-agreement": "access-agreement_v1.0_en.md",
  dpa: "dpa_v1.0_en.md",
};

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available — DATABASE_URL missing or connection refused.");
    process.exit(1);
  }

  const docs = await db.select().from(legalDocuments);
  const docByKind = new Map(docs.map((d) => [d.kind, d]));
  console.log(`[seed] found ${docs.length} legal documents`);

  let inserted = 0;
  let unchanged = 0;
  let republished = 0;

  for (const [kind, file] of Object.entries(FILES)) {
    const doc = docByKind.get(kind);
    if (!doc) {
      console.warn(`[seed] no legal_document row for kind=${kind} — run document seed first`);
      continue;
    }

    const body = readFileSync(path.join(LEGAL_DIR, file), "utf8");
    const bodyHash = hashLegalBody(body);
    const version = "1.0";

    const existingRows = await db
      .select()
      .from(agreementVersions)
      .where(
        and(
          eq(agreementVersions.documentId, doc.id),
          eq(agreementVersions.version, version),
          eq(agreementVersions.language, "en"),
        ),
      )
      .orderBy(desc(agreementVersions.createdAt))
      .limit(1);

    const existing = existingRows[0];
    if (existing && existing.bodyHash === bodyHash && existing.status === "published") {
      unchanged += 1;
      console.log(`  ${kind} v${version} unchanged (id=${existing.id})`);
      continue;
    }

    if (existing) {
      await db
        .update(agreementVersions)
        .set({ status: "superseded" })
        .where(eq(agreementVersions.id, existing.id));
      republished += 1;
    } else {
      inserted += 1;
    }

    await db.insert(agreementVersions).values({
      documentId: doc.id,
      version,
      language: "en",
      bodyMd: body,
      bodyHash,
      effectiveFrom: new Date(),
      status: "published",
    });

    console.log(
      `  ${kind} v${version} ${existing ? "republished" : "inserted"} (${body.length} bytes)`,
    );
  }

  console.log(
    `\n[seed] done: inserted=${inserted} republished=${republished} unchanged=${unchanged}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] fatal:", err);
  process.exit(1);
});
