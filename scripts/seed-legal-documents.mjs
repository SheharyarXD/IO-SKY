#!/usr/bin/env node
/**
 * Seed the eight enterprise-grade legal documents into the legal_documents
 * + agreement_versions tables.
 *
 * Idempotent: re-running this script will leave existing rows untouched
 * unless the document body has changed (in which case the previous version
 * is marked superseded and a new published version is inserted).
 *
 * Usage:
 *   node scripts/seed-legal-documents.mjs
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LEGAL_DIR = path.join(REPO_ROOT, "references", "legal");

const DOCS = [
  {
    kind: "privacy-policy",
    slug: "privacy",
    title: "Privacy Policy",
    file: "privacy-policy_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "terms-of-service",
    slug: "terms",
    title: "Terms of Service",
    file: "terms-of-service_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "cookie-policy",
    slug: "cookies",
    title: "Cookie Policy",
    file: "cookie-policy_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "ai-disclaimer",
    slug: "ai-disclaimer",
    title: "AI Disclaimer",
    file: "ai-disclaimer_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "developer-agreement",
    slug: "developer-agreement",
    title: "Developer Agreement",
    file: "developer-agreement_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "nda",
    slug: "nda",
    title: "Non-Disclosure Agreement",
    file: "nda_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "access-agreement",
    slug: "access-agreement",
    title: "Access Agreement",
    file: "access-agreement_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
  {
    kind: "dpa",
    slug: "dpa",
    title: "Data Processing Agreement (DPA)",
    file: "dpa_v1.0_en.md",
    version: "1.0",
    jurisdiction: "EU/NL",
  },
];

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function loadBody(filename) {
  const full = path.join(LEGAL_DIR, filename);
  return readFileSync(full, "utf8");
}

async function ensureDocument(conn, doc) {
  const [existing] = await conn.execute(
    `SELECT id FROM legal_documents WHERE kind = ? LIMIT 1`,
    [doc.kind],
  );
  if (existing.length > 0) {
    await conn.execute(
      `UPDATE legal_documents SET slug = ?, title = ?, jurisdiction = ?, defaultLanguage = 'en', status = 'active' WHERE id = ?`,
      [doc.slug, doc.title, doc.jurisdiction, existing[0].id],
    );
    return existing[0].id;
  }
  const [result] = await conn.execute(
    `INSERT INTO legal_documents (kind, slug, title, jurisdiction, defaultLanguage, status) VALUES (?, ?, ?, ?, 'en', 'active')`,
    [doc.kind, doc.slug, doc.title, doc.jurisdiction],
  );
  return result.insertId;
}

async function publishVersion(conn, documentId, doc, body) {
  const bodyHash = sha256(body);

  const [existing] = await conn.execute(
    `SELECT id, bodyHash, status FROM agreement_versions WHERE documentId = ? AND version = ? AND language = 'en' ORDER BY createdAt DESC LIMIT 1`,
    [documentId, doc.version],
  );

  if (existing.length > 0) {
    if (existing[0].bodyHash === bodyHash && existing[0].status === "published") {
      return { action: "unchanged", id: existing[0].id };
    }
    await conn.execute(
      `UPDATE agreement_versions SET status = 'superseded' WHERE id = ?`,
      [existing[0].id],
    );
  }

  const [result] = await conn.execute(
    `INSERT INTO agreement_versions (documentId, version, language, bodyMd, bodyHash, effectiveFrom, status) VALUES (?, ?, 'en', ?, ?, NOW(), 'published')`,
    [documentId, doc.version, body, bodyHash],
  );
  return { action: existing.length > 0 ? "republished" : "inserted", id: result.insertId };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(1);
  }
  const conn = await mysql.createConnection(dbUrl);
  try {
    console.log("[seed-legal] Connected to TiDB");
    const summary = [];
    for (const doc of DOCS) {
      const body = loadBody(doc.file);
      const documentId = await ensureDocument(conn, doc);
      const result = await publishVersion(conn, documentId, doc, body);
      summary.push({
        kind: doc.kind,
        slug: doc.slug,
        version: doc.version,
        documentId,
        versionRow: result.id,
        action: result.action,
        bytes: body.length,
      });
      console.log(
        `[seed-legal] ${doc.kind} → docId=${documentId} versionId=${result.id} (${result.action}, ${body.length} bytes)`,
      );
    }
    console.log("\n[seed-legal] Summary:");
    console.table(summary);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[seed-legal] Failed:", err);
  process.exit(1);
});
