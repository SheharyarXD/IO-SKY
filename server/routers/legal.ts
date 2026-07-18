/**
 * IO SKY — Legal & Consent tRPC router.
 *
 * Public surface (no auth required):
 *   - legal.getDocument     — fetch the live version of a legal document by kind/slug.
 *   - legal.listDocuments   — index of every published legal document with metadata.
 *   - legal.recordCookieConsent — record an anonymous cookie-consent decision.
 *   - legal.getCookieConsent    — return the latest consent for a subject key.
 *
 * Authenticated surface:
 *   - legal.acceptAgreement — record an authenticated user's acceptance of a version.
 *   - legal.acknowledgeAi   — record an inline AI Disclaimer acknowledgement.
 *   - legal.myAcceptances   — list the current user's acceptance history.
 *   - legal.myMissingAcceptances — list documents the current user has not yet accepted.
 *
 * Admin surface:
 *   - legal.adminCounts — aggregate counts per document kind for the audit dashboard.
 */

import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  agreementAcceptances,
  agreementVersions,
  cookieConsents,
  legalAcknowledgements,
  legalDocuments,
} from "../../drizzle/schema";
import { getDb } from "../db";
import {
  countAcceptancesByKind,
  getLatestCookieConsent,
  getLiveAgreementVersion,
  recordAgreementAcceptance,
  recordCookieConsent,
  recordLegalAcknowledgement,
} from "../legalDb";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";

const SUPPORTED_KINDS = [
  "privacy-policy",
  "terms-of-service",
  "cookie-policy",
  "ai-disclaimer",
  "developer-agreement",
  "nda",
  "access-agreement",
  "dpa",
] as const;

const kindOrSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/);

function pickIp(ctx: { req?: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } } | null }): string | null {
  const fwd = ctx.req?.headers?.["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]?.trim() ?? null;
  return ctx.req?.socket?.remoteAddress ?? null;
}

function pickUa(ctx: { req?: { headers?: Record<string, unknown> } | null }): string | null {
  const ua = ctx.req?.headers?.["user-agent"];
  return typeof ua === "string" ? ua : null;
}

export const legalRouter = router({
  /**
   * Fetch the live published version of a legal document.
   * Accepts either the canonical `kind` (privacy-policy) or the URL `slug`
   * (privacy) so this works from both internal references and external URLs.
   */
  getDocument: publicProcedure
    .input(
      z.object({
        kindOrSlug: kindOrSlugSchema,
        language: z.string().min(2).max(8).optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Legal database unavailable.",
        });
      }
      // Resolve kind from slug if needed.
      let kind = input.kindOrSlug;
      if (!SUPPORTED_KINDS.includes(kind as (typeof SUPPORTED_KINDS)[number])) {
        const docs = await db
          .select()
          .from(legalDocuments)
          .where(eq(legalDocuments.slug, input.kindOrSlug))
          .limit(1);
        if (!docs[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Unknown legal document: ${input.kindOrSlug}`,
          });
        }
        kind = docs[0].kind;
      }
      const live = await getLiveAgreementVersion(kind, input.language ?? "en");
      if (!live) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No published version found for ${kind}`,
        });
      }
      return {
        document: {
          id: live.document.id,
          kind: live.document.kind,
          slug: live.document.slug,
          title: live.document.title,
          jurisdiction: live.document.jurisdiction,
        },
        version: {
          id: live.version.id,
          version: live.version.version,
          language: live.version.language,
          effectiveFrom: live.version.effectiveFrom,
          bodyMd: live.version.bodyMd,
          bodyHash: live.version.bodyHash,
          status: live.version.status,
        },
      };
    }),

  /**
   * Index of all published legal documents. Useful for footers and the
   * `/legal` index page.
   */
  listDocuments: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [] as Array<never>;
    const docs = await db
      .select()
      .from(legalDocuments)
      .where(eq(legalDocuments.status, "active"));
    const summaries = await Promise.all(
      docs.map(async (doc) => {
        const versions = await db
          .select()
          .from(agreementVersions)
          .where(
            and(
              eq(agreementVersions.documentId, doc.id),
              eq(agreementVersions.status, "published"),
            ),
          )
          .orderBy(desc(agreementVersions.effectiveFrom))
          .limit(1);
        const live = versions[0];
        return {
          id: doc.id,
          kind: doc.kind,
          slug: doc.slug,
          title: doc.title,
          jurisdiction: doc.jurisdiction,
          liveVersion: live?.version ?? null,
          effectiveFrom: live?.effectiveFrom ?? null,
        };
      }),
    );
    return summaries.sort((a, b) => a.title.localeCompare(b.title));
  }),

  /**
   * Record a cookie consent decision. Works for anonymous visitors (subjectKey
   * generated client-side and stored in cookie) and for authenticated users.
   */
  recordCookieConsent: publicProcedure
    .input(
      z.object({
        subjectKey: z.string().min(4).max(128),
        decision: z.enum(["accepted-all", "rejected-all", "custom"]),
        categories: z.object({
          functional: z.boolean(),
          analytics: z.boolean(),
          marketing: z.boolean(),
        }),
        cookiePolicyVersionId: z.number().int().positive().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Functional cookies are always required for the platform to work.
      const sanitised = { ...input.categories, functional: true };
      const recorded = await recordCookieConsent({
        subjectKey: input.subjectKey,
        userId: ctx.user?.id ?? null,
        policyVersionId: input.cookiePolicyVersionId ?? null,
        categories: sanitised,
        decision: input.decision,
        ip: pickIp(ctx),
        userAgent: pickUa(ctx),
      });
      return {
        success: true as const,
        consentId: recorded?.id ?? null,
        categories: sanitised,
      };
    }),

  /**
   * Look up the latest cookie consent for a subject key (anon device or user).
   */
  getCookieConsent: publicProcedure
    .input(z.object({ subjectKey: z.string().min(4).max(128) }))
    .query(async ({ input }) => {
      const row = await getLatestCookieConsent(input.subjectKey);
      if (!row) return null;
      let categories = { functional: true, analytics: false, marketing: false };
      try {
        if (row.categoriesJson) {
          const parsed = JSON.parse(row.categoriesJson) as {
            functional?: boolean;
            analytics?: boolean;
            marketing?: boolean;
          };
          categories = {
            functional: parsed.functional ?? true,
            analytics: parsed.analytics ?? false,
            marketing: parsed.marketing ?? false,
          };
        }
      } catch {
        // ignore malformed json
      }
      return {
        id: row.id,
        decision: row.decision,
        categories,
        acceptedAt: row.acceptedAt,
        policyVersionId: row.policyVersionId,
      };
    }),

  /**
   * Record an authenticated acceptance of a versioned agreement.
   */
  acceptAgreement: protectedProcedure
    .input(
      z.object({
        kind: z.enum(SUPPORTED_KINDS),
        method: z.enum([
          "signup",
          "login-revalidation",
          "ai-scan",
          "booking",
          "proposal",
          "dev-onboarding",
          "manual",
        ]),
        language: z.string().min(2).max(8).optional(),
        organizationId: z.number().int().positive().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const live = await getLiveAgreementVersion(
        input.kind,
        input.language ?? "en",
      );
      if (!live) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No published ${input.kind} version found`,
        });
      }
      const inserted = await recordAgreementAcceptance({
        userId: ctx.user.id,
        organizationId: input.organizationId ?? null,
        versionId: live.version.id,
        documentKind: input.kind,
        ip: pickIp(ctx),
        userAgent: pickUa(ctx),
        method: input.method,
      });
      return {
        success: true as const,
        wasNew: inserted,
        versionId: live.version.id,
        version: live.version.version,
        documentKind: input.kind,
      };
    }),

  /**
   * Record an inline AI Disclaimer acknowledgement (lightweight, before AI Scan
   * submit, recommendation activation, etc).
   */
  acknowledgeAi: publicProcedure
    .input(
      z.object({
        context: z.string().min(2).max(64),
        language: z.string().min(2).max(8).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const live = await getLiveAgreementVersion(
        "ai-disclaimer",
        input.language ?? "en",
      );
      await recordLegalAcknowledgement({
        userId: ctx.user?.id ?? null,
        documentKind: "ai-disclaimer",
        versionId: live?.version.id ?? null,
        context: input.context,
        ip: pickIp(ctx),
      });
      return { success: true as const };
    }),

  /**
   * The current user's acceptance history.
   */
  myAcceptances: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: agreementAcceptances.id,
        versionId: agreementAcceptances.versionId,
        documentKind: agreementAcceptances.documentKind,
        method: agreementAcceptances.method,
        acceptedAt: agreementAcceptances.acceptedAt,
      })
      .from(agreementAcceptances)
      .where(eq(agreementAcceptances.userId, ctx.user.id))
      .orderBy(desc(agreementAcceptances.acceptedAt));
    return rows;
  }),

  /**
   * The currently-required documents the user has *not yet* accepted at
   * their live version. Used by the post-login gate component to decide
   * whether to render the "please re-accept" modal.
   */
  myMissingAcceptances: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const required = ["privacy-policy", "terms-of-service"] as const;
    const missing: Array<{
      kind: string;
      title: string;
      version: string;
      versionId: number;
      effectiveFrom: Date | null;
    }> = [];

    for (const kind of required) {
      const live = await getLiveAgreementVersion(kind, "en");
      if (!live) continue;

      const acceptanceRows = await db
        .select({ id: agreementAcceptances.id })
        .from(agreementAcceptances)
        .where(
          and(
            eq(agreementAcceptances.userId, ctx.user.id),
            eq(agreementAcceptances.versionId, live.version.id),
          ),
        )
        .limit(1);

      if (!acceptanceRows[0]) {
        missing.push({
          kind: live.document.kind,
          title: live.document.title,
          version: live.version.version,
          versionId: live.version.id,
          effectiveFrom: live.version.effectiveFrom,
        });
      }
    }
    return missing;
  }),

  /**
   * Aggregate acceptance counts per document kind. Used by the audit
   * dashboard.
   */
  adminCounts: adminProcedure.query(async () => {
    const counts = await countAcceptancesByKind();
    const db = await getDb();
    if (!db) return counts;

    // Cookie-consent rollup.
    const consents = await db
      .select({
        decision: cookieConsents.decision,
      })
      .from(cookieConsents);
    const consentRollup = consents.reduce(
      (acc, row) => {
        acc[row.decision] = (acc[row.decision] ?? 0) + 1;
        return acc;
      },
      { "accepted-all": 0, "rejected-all": 0, custom: 0 } as Record<
        string,
        number
      >,
    );

    // AI Acknowledgement count.
    const aiAcks = await db
      .select({ id: legalAcknowledgements.id })
      .from(legalAcknowledgements)
      .where(eq(legalAcknowledgements.documentKind, "ai-disclaimer"));

    return {
      acceptances: counts,
      cookieConsents: consentRollup,
      aiAcknowledgements: aiAcks.length,
    };
  }),
});
