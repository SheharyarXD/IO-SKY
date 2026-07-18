/**
 * IO SKY — AI Scan funnel router.
 *
 * Public procedures:
 *   - aiScans.submitLead          — Lead-only capture (the "unlock" form on /ai-scan).
 *   - aiScans.getQuestionnaire    — Returns the canonical question set for a tier.
 *   - aiScans.submitQuestionnaire — Validates, persists, scores via LLM, returns reportToken.
 *   - aiScans.getReport           — Fetch a scored report by token (read-only, public).
 *
 * Boundary rules (Phase 5 of the Ultra Master Blueprint):
 *   - The Free AI Scan, Paid AI Scan (Growth / Elite), Discovery Call and
 *     Proposal flows are independent. Lead source is always "ai-scan"; the
 *     selected tier is captured separately so the operations team can route
 *     the lead correctly. Submitting the Free tier here MUST NOT auto-
 *     escalate to Growth/Elite and MUST NOT auto-book a discovery call —
 *     those are explicit, separate journeys.
 */

import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  createAiScan,
  createLead,
  getAiScanByToken,
  setAiScanReportPdfKey,
  updateAiScanStatus,
} from "../db";
import { renderAiScanReportPdf } from "../aiScanReportPdf";
import { storagePut, storageGetSignedUrl } from "../storage";
import { notifyOwner } from "../_core/notification";
import { publicProcedure, router } from "../_core/trpc";
import {
  AI_SCAN_QUESTION_BANK,
  findMissingAnswers,
  getQuestionsForTier,
} from "../../shared/aiScanQuestionnaire";
import { scoreAiScan } from "../_core/aiScanScoring";
import type { AiScanReportPayload } from "../../shared/aiScanModel";

export const AI_SCAN_TIERS = ["free", "growth", "elite"] as const;
export type AiScanTier = (typeof AI_SCAN_TIERS)[number];

// ── Rate limiting ───────────────────────────────────────────────────────────
const submissionsByIp = new Map<string, number[]>();
const SUBMISSION_WINDOW_MS = 60_000;
const SUBMISSION_LIMIT_PER_MIN = 6;

export function isAiScanRateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) || []).filter(
    (t) => now - t < SUBMISSION_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > SUBMISSION_LIMIT_PER_MIN;
}

// ── Inputs ──────────────────────────────────────────────────────────────────
const submitLeadInput = z.object({
  tier: z.enum(AI_SCAN_TIERS),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(64).optional().nullable(),
  company: z.string().min(1).max(200),
  acceptedAiDisclaimer: z.boolean().refine((v) => v === true, {
    message: "AI Disclaimer must be accepted",
  }),
  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  website: z.string().max(0).optional().nullable(),
});

export type SubmitLeadInput = z.infer<typeof submitLeadInput>;

const submitQuestionnaireInput = z.object({
  tier: z.enum(AI_SCAN_TIERS),
  fullName: z.string().min(2).max(200),
  email: z.string().email().max(320),
  company: z.string().min(1).max(200),
  locale: z.string().max(8).optional().default("en"),
  acceptedAiDisclaimer: z.boolean().refine((v) => v === true, {
    message: "AI Disclaimer must be accepted",
  }),
  /** Map of questionId → discrete answer value. */
  answers: z.record(z.string(), z.string()),
  contextNote: z.string().max(2000).optional(),
  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(120).optional().nullable(),
  website: z.string().max(0).optional().nullable(),
});

const getReportInput = z.object({
  token: z.string().min(16).max(96),
});

const getQuestionnaireInput = z.object({
  tier: z.enum(AI_SCAN_TIERS),
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function newReportToken(): string {
  return randomBytes(24).toString("hex");
}

function getIpAndUa(ctx: {
  req?: {
    headers: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  };
}): { ip: string | null; userAgent: string | null } {
  const ip =
    ((ctx.req?.headers["x-forwarded-for"] as string | undefined) || "")
      .split(",")[0]
      ?.trim() ||
    ctx.req?.socket?.remoteAddress ||
    null;
  const userAgent = (ctx.req?.headers["user-agent"] as string | undefined) || null;
  return { ip: ip || null, userAgent };
}

// ── Router ──────────────────────────────────────────────────────────────────
export const aiScansRouter = router({
  /**
   * Lightweight lead capture (used by the "Unlock Full Results" dialog on
   * /ai-scan when a visitor has not yet completed the questionnaire).
   */
  submitLead: publicProcedure
    .input(submitLeadInput)
    .mutation(async ({ ctx, input }) => {
      if (input.website && input.website.length > 0) {
        return { success: true as const, tier: input.tier, leadId: null };
      }

      const { ip, userAgent } = getIpAndUa(ctx as never);

      if (isAiScanRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many submissions. Please try again shortly.",
        });
      }

      const lead = await createLead({
        source: "ai-scan",
        sourceId: null,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        company: input.company.trim(),
        phone: input.phone?.trim() || null,
        interest: `ai-scan:${input.tier}`,
        note: `AI Scan funnel · tier=${input.tier}`,
        status: "new",
        utmSource: input.utmSource ?? null,
        utmCampaign: input.utmCampaign ?? null,
        ip,
        userAgent,
      });

      if (!lead) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your request could not be saved. Please try again or contact us directly.",
        });
      }

      try {
        await notifyOwner({
          title: `IO SKY · AI Scan (${input.tier.toUpperCase()})`,
          content: [
            `Tier: ${input.tier}`,
            `Name: ${lead.fullName}`,
            `Email: ${lead.email}`,
            lead.phone ? `Phone: ${lead.phone}` : null,
            `Company: ${lead.company ?? "—"}`,
            input.utmSource ? `UTM source: ${input.utmSource}` : null,
            input.utmCampaign ? `UTM campaign: ${input.utmCampaign}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      } catch (error) {
        console.warn("[aiScans.submitLead] notifyOwner threw:", error);
      }

      return { success: true as const, tier: input.tier, leadId: lead.id };
    }),

  /**
   * Returns the canonical questionnaire for a given tier. UI renders in the
   * order returned. The bank itself lives in shared/ so the same source
   * powers both server validation and the React intake form.
   */
  getQuestionnaire: publicProcedure
    .input(getQuestionnaireInput)
    .query(({ input }) => {
      return {
        tier: input.tier,
        questions: getQuestionsForTier(input.tier),
      };
    }),

  /**
   * Validates the questionnaire, persists the scan, runs the scoring engine,
   * and returns the report token. The scoring engine is awaited inline for
   * the Free tier (small payload, tolerable latency) but launched
   * fire-and-forget for Growth/Elite to keep the UX snappy — the result
   * page polls `getReport` until status=ready.
   */
  submitQuestionnaire: publicProcedure
    .input(submitQuestionnaireInput)
    .mutation(async ({ ctx, input }) => {
      if (input.website && input.website.length > 0) {
        return {
          success: true as const,
          tier: input.tier,
          reportToken: null,
        };
      }

      const { ip, userAgent } = getIpAndUa(ctx as never);
      if (isAiScanRateLimited(ip)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many submissions. Please try again shortly.",
        });
      }

      const missing = findMissingAnswers(input.tier, input.answers);
      if (missing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Missing answers: ${missing.slice(0, 5).join(", ")}${
            missing.length > 5 ? "…" : ""
          }`,
        });
      }

      // Reject answer keys outside of the bank to avoid pollution.
      const knownIds = new Set(AI_SCAN_QUESTION_BANK.map((q) => q.id));
      for (const k of Object.keys(input.answers)) {
        if (!knownIds.has(k)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown question id: ${k}`,
          });
        }
      }

      // 1) Create lead alongside scan so the CRM has a record either way.
      const lead = await createLead({
        source: "ai-scan",
        sourceId: null,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        company: input.company.trim(),
        phone: null,
        interest: `ai-scan:${input.tier}`,
        note: `AI Scan questionnaire · tier=${input.tier} · ${
          Object.keys(input.answers).length
        } answers`,
        status: "new",
        utmSource: input.utmSource ?? null,
        utmCampaign: input.utmCampaign ?? null,
        ip,
        userAgent,
      });

      // 2) Persist scan record in 'pending' state.
      const reportToken = newReportToken();
      const scan = await createAiScan({
        reportToken,
        tier: input.tier,
        leadId: lead?.id ?? null,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        company: input.company.trim(),
        locale: input.locale,
        responses: JSON.stringify({
          answers: input.answers,
          contextNote: input.contextNote ?? null,
        }),
        status: "pending",
        utmSource: input.utmSource ?? null,
        utmCampaign: input.utmCampaign ?? null,
        ip,
        userAgent,
      });

      if (!scan) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Your scan could not be saved. Please try again in a few minutes.",
        });
      }

      // 3) Run scoring. Free tier blocks (small ~7q payload); paid tiers run
      // detached and the result page polls. Fire-and-forget Promise must not
      // surface unhandled rejections to the event loop.
      const runEngine = async () => {
        await updateAiScanStatus(scan.id, { status: "scoring" });
        const result = await scoreAiScan({
          tier: input.tier,
          locale: input.locale,
          fullName: input.fullName,
          company: input.company,
          answers: input.answers,
          contextNote: input.contextNote,
        });
        if (result.ok) {
          await updateAiScanStatus(scan.id, {
            status: "ready",
            reportPayload: JSON.stringify(result.report),
            overallScore: result.report.overallScore,
            scoredAt: new Date(),
          });
          try {
            await notifyOwner({
              title: `IO SKY · AI Scan ready (${input.tier.toUpperCase()})`,
              content: [
                `Tier: ${input.tier}`,
                `Company: ${input.company}`,
                `Email: ${input.email}`,
                `Overall score: ${result.report.overallScore}/100`,
                `Token: ${reportToken}`,
              ].join("\n"),
            });
          } catch (e) {
            console.warn("[aiScans.submitQuestionnaire] notifyOwner threw:", e);
          }
        } else {
          await updateAiScanStatus(scan.id, {
            status: "failed",
            errorMessage: result.error.slice(0, 1000),
          });
          try {
            await notifyOwner({
              title: `IO SKY · AI Scan FAILED (${input.tier.toUpperCase()})`,
              content: [
                `Tier: ${input.tier}`,
                `Company: ${input.company}`,
                `Email: ${input.email}`,
                `Token: ${reportToken}`,
                `Error: ${result.error}`,
              ].join("\n"),
            });
          } catch (e) {
            console.warn("[aiScans.submitQuestionnaire] notifyOwner threw:", e);
          }
        }
      };

      if (input.tier === "free") {
        await runEngine();
      } else {
        // Detached. Always swallow errors — the failure path already updates
        // the scan record and notifies the owner.
        runEngine().catch((e) => {
          console.warn("[aiScans.submitQuestionnaire] engine threw:", e);
        });
      }

      return {
        success: true as const,
        tier: input.tier,
        reportToken,
      };
    }),

  /**
   * Read a scored report by token. Returns the full payload only when
   * status=ready; returns a status snapshot otherwise so the UI can poll.
   */
  getReport: publicProcedure
    .input(getReportInput)
    .query(async ({ input }) => {
      const scan = await getAiScanByToken(input.token);
      if (!scan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found or no longer available.",
        });
      }

      if (scan.status !== "ready" || !scan.reportPayload) {
        return {
          status: scan.status,
          tier: scan.tier as AiScanTier,
          company: scan.company,
          createdAt: scan.createdAt,
          report: null,
        };
      }

      let report: AiScanReportPayload | null = null;
      try {
        report = JSON.parse(scan.reportPayload) as AiScanReportPayload;
      } catch {
        report = null;
      }

      return {
        status: scan.status,
        tier: scan.tier as AiScanTier,
        company: scan.company,
        createdAt: scan.createdAt,
        report,
      };
    }),

  /**
   * Generate (or reuse) a branded executive PDF for a ready report and return
   * a short-lived signed download URL. Token-gated exactly like getReport so
   * the same unguessable link governs access — no extra auth surface.
   */
  getReportPdf: publicProcedure
    .input(getReportInput)
    .mutation(async ({ input }) => {
      const scan = await getAiScanByToken(input.token);
      if (!scan) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report not found or no longer available.",
        });
      }
      if (scan.status !== "ready" || !scan.reportPayload) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This report is not ready for download yet.",
        });
      }

      // A short, human-friendly reference derived from the unguessable token.
      const shortRef = scan.reportToken.slice(0, 10).toUpperCase();

      // Reuse a previously generated PDF when available.
      if (scan.reportPdfKey) {
        try {
          const url = await storageGetSignedUrl(scan.reportPdfKey);
          return { url, filename: pdfFilename(shortRef) };
        } catch {
          // fall through and regenerate if the cached object is unreachable
        }
      }

      let report: AiScanReportPayload;
      try {
        report = JSON.parse(scan.reportPayload) as AiScanReportPayload;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Report payload is corrupted.",
        });
      }

      const pdf = await renderAiScanReportPdf(report, {
        company: scan.company ?? "Your organization",
        tier: scan.tier as AiScanTier,
        publicRef: shortRef,
        createdAt:
          scan.createdAt instanceof Date
            ? scan.createdAt.getTime()
            : Date.now(),
      });

      const key = `ai-scan-reports/${scan.reportToken}.pdf`;
      const { key: storedKey } = await storagePut(key, pdf, "application/pdf");
      await setAiScanReportPdfKey(scan.id, storedKey);

      const url = await storageGetSignedUrl(storedKey);
      return { url, filename: pdfFilename(shortRef) };
    }),
});

function pdfFilename(publicRef: string): string {
  return `IO-SKY-AI-Scan-${publicRef}.pdf`;
}
