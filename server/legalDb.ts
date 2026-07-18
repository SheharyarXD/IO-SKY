import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  agreementAcceptances,
  agreementVersions,
  cookieConsents,
  legalAcknowledgements,
  legalDocuments,
  type AgreementVersion,
  type CookieConsent,
  type LegalDocument,
} from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Compute the SHA-256 hex hash of a body string. Used as `bodyHash` when
 * publishing a new agreement version so we can detect tampering and reference
 * a stable identity in audit rows.
 */
export function hashLegalBody(body: string): string {
  return crypto.createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * Insert a legal document row (idempotent on `kind`). Returns the document.
 * Used at seed time to register every supported document kind exactly once.
 */
export async function upsertLegalDocument(args: {
  kind: string;
  slug: string;
  title: string;
  jurisdiction?: string | null;
  defaultLanguage?: string;
  status?: "active" | "draft" | "retired";
}): Promise<LegalDocument | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, args.kind))
    .limit(1);

  if (existing[0]) {
    // Update mutable fields if drifted.
    await db
      .update(legalDocuments)
      .set({
        slug: args.slug,
        title: args.title,
        jurisdiction: args.jurisdiction ?? null,
        defaultLanguage: args.defaultLanguage ?? "en",
        status: args.status ?? "active",
      })
      .where(eq(legalDocuments.id, existing[0].id));
    const reread = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.id, existing[0].id))
      .limit(1);
    return reread[0] ?? null;
  }

  const inserted = await db.insert(legalDocuments).values({
    kind: args.kind,
    slug: args.slug,
    title: args.title,
    jurisdiction: args.jurisdiction ?? null,
    defaultLanguage: args.defaultLanguage ?? "en",
    status: args.status ?? "active",
  });

  // Drizzle MySQL doesn't return the inserted row — re-read.
  const reread = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, args.kind))
    .limit(1);
  return reread[0] ?? null;
}

/**
 * Publish a new version of a legal document. If a version with the same
 * (documentId, version) tuple already exists with a matching bodyHash, we
 * leave it alone (idempotent reseed). If the body changed under the same
 * version label we mark the previous one as superseded and insert a new
 * row. The latest published version is returned.
 */
export async function publishAgreementVersion(args: {
  documentId: number;
  version: string;
  language?: string;
  bodyMd: string;
  effectiveFrom?: Date;
}): Promise<AgreementVersion | null> {
  const db = await getDb();
  if (!db) return null;
  const language = args.language ?? "en";
  const bodyHash = hashLegalBody(args.bodyMd);

  const existingRows = await db
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.documentId, args.documentId),
        eq(agreementVersions.version, args.version),
        eq(agreementVersions.language, language),
      ),
    );

  const existing = existingRows[0];
  if (existing) {
    if (existing.bodyHash === bodyHash) {
      // Idempotent — already in DB with identical content.
      return existing;
    }
    // Body drift under same version label: mark superseded.
    await db
      .update(agreementVersions)
      .set({ status: "superseded" })
      .where(eq(agreementVersions.id, existing.id));
  }

  await db.insert(agreementVersions).values({
    documentId: args.documentId,
    version: args.version,
    language,
    bodyMd: args.bodyMd,
    bodyHash,
    effectiveFrom: args.effectiveFrom ?? new Date(),
    status: "published",
  });

  const fresh = await db
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.documentId, args.documentId),
        eq(agreementVersions.version, args.version),
        eq(agreementVersions.language, language),
        eq(agreementVersions.status, "published"),
      ),
    )
    .orderBy(desc(agreementVersions.createdAt))
    .limit(1);
  return fresh[0] ?? null;
}

/**
 * Return the currently live (`status="published"`) version of a document
 * by kind. If multiple are published (transitional state), returns the most
 * recent by effectiveFrom.
 */
export async function getLiveAgreementVersion(
  kind: string,
  language: string = "en",
): Promise<{ document: LegalDocument; version: AgreementVersion } | null> {
  const db = await getDb();
  if (!db) return null;

  const docs = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, kind))
    .limit(1);
  const doc = docs[0];
  if (!doc) return null;

  const versions = await db
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.documentId, doc.id),
        eq(agreementVersions.language, language),
        eq(agreementVersions.status, "published"),
      ),
    )
    .orderBy(desc(agreementVersions.effectiveFrom))
    .limit(1);

  if (!versions[0]) {
    // Fallback to default language ("en") if requested locale is missing.
    if (language !== "en") {
      const fallback = await db
        .select()
        .from(agreementVersions)
        .where(
          and(
            eq(agreementVersions.documentId, doc.id),
            eq(agreementVersions.language, "en"),
            eq(agreementVersions.status, "published"),
          ),
        )
        .orderBy(desc(agreementVersions.effectiveFrom))
        .limit(1);
      if (!fallback[0]) return null;
      return { document: doc, version: fallback[0] };
    }
    return null;
  }
  return { document: doc, version: versions[0] };
}

/**
 * Record an acceptance row for the given user/version pair. Idempotent: if
 * the user already accepted this exact version we don't insert a duplicate.
 * Returns true if a new row was inserted.
 */
export async function recordAgreementAcceptance(args: {
  userId: number;
  organizationId?: number | null;
  versionId: number;
  documentKind: string;
  ip?: string | null;
  userAgent?: string | null;
  method:
    | "signup"
    | "login-revalidation"
    | "ai-scan"
    | "booking"
    | "proposal"
    | "dev-onboarding"
    | "manual";
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(
      and(
        eq(agreementAcceptances.userId, args.userId),
        eq(agreementAcceptances.versionId, args.versionId),
      ),
    )
    .limit(1);

  if (existing[0]) return false;

  await db.insert(agreementAcceptances).values({
    userId: args.userId,
    organizationId: args.organizationId ?? null,
    versionId: args.versionId,
    documentKind: args.documentKind,
    ip: args.ip ?? null,
    userAgent: args.userAgent ?? null,
    method: args.method,
  });
  return true;
}

/**
 * Did this user accept the *currently live* version of the given document
 * kind? Returns the live version + acceptance status. Used by the gate
 * middleware to decide whether to re-prompt.
 */
export async function userHasAcceptedLatest(
  userId: number,
  kind: string,
  language: string = "en",
): Promise<{
  document: LegalDocument | null;
  version: AgreementVersion | null;
  accepted: boolean;
}> {
  const live = await getLiveAgreementVersion(kind, language);
  if (!live) return { document: null, version: null, accepted: false };

  const db = await getDb();
  if (!db) return { document: live.document, version: live.version, accepted: false };

  const rows = await db
    .select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(
      and(
        eq(agreementAcceptances.userId, userId),
        eq(agreementAcceptances.versionId, live.version.id),
      ),
    )
    .limit(1);

  return { document: live.document, version: live.version, accepted: !!rows[0] };
}

/**
 * Record (or update) a cookie consent decision for a subject. The subject is
 * either a logged-in user (`user:<id>`) or an anonymous device id
 * (`anon:<uuid>`). Each call inserts a new row (we never delete history).
 */
export async function recordCookieConsent(args: {
  subjectKey: string;
  userId?: number | null;
  policyVersionId?: number | null;
  categories: { functional: boolean; analytics: boolean; marketing: boolean };
  decision: "accepted-all" | "rejected-all" | "custom";
  ip?: string | null;
  userAgent?: string | null;
}): Promise<CookieConsent | null> {
  const db = await getDb();
  if (!db) return null;

  await db.insert(cookieConsents).values({
    subjectKey: args.subjectKey,
    userId: args.userId ?? null,
    policyVersionId: args.policyVersionId ?? null,
    categoriesJson: JSON.stringify(args.categories),
    decision: args.decision,
    ip: args.ip ?? null,
    userAgent: args.userAgent ?? null,
  });

  const recent = await db
    .select()
    .from(cookieConsents)
    .where(eq(cookieConsents.subjectKey, args.subjectKey))
    .orderBy(desc(cookieConsents.acceptedAt))
    .limit(1);
  return recent[0] ?? null;
}

/**
 * Return the latest cookie-consent row for a subject (user or anon).
 */
export async function getLatestCookieConsent(
  subjectKey: string,
): Promise<CookieConsent | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(cookieConsents)
    .where(eq(cookieConsents.subjectKey, subjectKey))
    .orderBy(desc(cookieConsents.acceptedAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Record a lightweight acknowledgement (e.g. user clicked through an inline
 * AI Disclaimer banner before submitting an AI Scan).
 */
export async function recordLegalAcknowledgement(args: {
  userId?: number | null;
  documentKind: string;
  versionId?: number | null;
  context: string;
  ip?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(legalAcknowledgements).values({
    userId: args.userId ?? null,
    documentKind: args.documentKind,
    versionId: args.versionId ?? null,
    context: args.context,
    ip: args.ip ?? null,
  });
}

/**
 * Convenience: count acceptances per document kind. Used by the admin audit
 * dashboard to verify gates are working.
 */
export async function countAcceptancesByKind(): Promise<
  { documentKind: string; count: number }[]
> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      documentKind: agreementAcceptances.documentKind,
      count: sql<number>`count(*)`,
    })
    .from(agreementAcceptances)
    .groupBy(agreementAcceptances.documentKind);
  return rows.map((r) => ({
    documentKind: r.documentKind,
    count: Number(r.count),
  }));
}
