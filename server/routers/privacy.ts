/**
 * Data Subject Rights administration (GDPR Articles 15 to 21).
 *
 * Implements the record and the workflow the client specified. Three things
 * about the shape of this router are deliberate and worth reading before
 * changing anything here.
 *
 * AUTHORISATION IS NOT A ROLE. Every procedure below is a
 * `privacyOfficerProcedure`, which consults an explicit per-user grant and
 * never `user.role`. A Super Admin without a grant is refused exactly as an
 * anonymous caller is. The only exception is grant management itself, which
 * is `superAdminProcedure`: somebody has to be able to appoint the first
 * privacy officer, and that is an organisational decision rather than a
 * privacy-handling one.
 *
 * NOTHING COMPLETES ITSELF. The client required that the system "must not
 * autonomously make final decisions without authorised human review". So
 * `prepareAction` gathers evidence and writes a proposal, and it stops. A
 * separate `approveAction` call by a named authorised person is what carries
 * anything out. The two are recorded separately so "who decided" and "who
 * prepared" never collapse into one name.
 *
 * ERASURE IS NOT IMPLEMENTED. Deliberately, and it is not an oversight. Which
 * tables may be deleted outright and which must be anonymised is a legal
 * decision per table: an invoice carries statutory retention, and a failed
 * sign-in record in `login_audit` is itself a security control. Until that
 * decision exists, `prepareAction` will describe exactly what an erasure
 * would touch and refuse to stage it. Returning a confident "done" for a
 * deletion that did not happen would be the worst possible failure here.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  appendPrivacyRequestEvent,
  createPrivacyRequest,
  getPrivacyRequestById,
  getUserByEmail,
  grantPrivacyOfficer,
  listPrivacyOfficerGrants,
  listPrivacyRequestEvents,
  listPrivacyRequests,
  locatePersonalData,
  revokePrivacyOfficer,
  updatePrivacyRequest,
  PERSONAL_DATA_SOURCES,
} from "../db";
import { getRequestMeta } from "../_core/requestMeta";
import { generatePublicRef } from "../_core/publicRef";
import { privacyOfficerProcedure, router, superAdminProcedure } from "../_core/trpc";

/**
 * GDPR Articles 15 to 21, in the order the regulation lists them.
 *
 * `restrict` and `object` are included even though they are handled by
 * recording a decision rather than by changing data, because a request the
 * system cannot represent is a request that gets handled in somebody's inbox
 * instead, which is the outcome this whole router exists to prevent.
 */
const REQUEST_TYPES = [
  "access",
  "rectification",
  "erasure",
  "restrict",
  "portability",
  "object",
] as const;

/** Statutory response window: one calendar month from receipt. */
const RESPONSE_WINDOW_DAYS = 30;

/**
 * Actions the system is allowed to carry out today.
 *
 * `erasure` is absent for the reason in the file header. Keeping it out of
 * this list rather than letting it through with a warning means the refusal
 * is structural instead of advisory.
 */
const EXECUTABLE_ACTIONS = ["access", "portability", "rectification", "restrict", "object"] as const;

/**
 * Render located rows as CSV.
 *
 * One file would need a single column set across tables with different
 * shapes, so this emits one block per table with its own header, separated by
 * a blank line. Values are quoted unconditionally and embedded quotes are
 * doubled, which is the RFC 4180 rule and also what stops a value containing
 * a comma from silently shifting every later column.
 */
function toCsv(located: { table: string; rows: Record<string, unknown>[] }[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  return located
    .map(({ table, rows }) => {
      if (rows.length === 0) return `# ${table}\n(no rows)`;
      const columns = Object.keys(rows[0]);
      const header = columns.map(cell).join(",");
      const body = rows.map((r) => columns.map((c) => cell(r[c])).join(",")).join("\n");
      return `# ${table}\n${header}\n${body}`;
    })
    .join("\n\n");
}

export const privacyRouter = router({
  // -------------------------------------------------------------------------
  // Grant management — super admin only, because appointing a privacy officer
  // is an organisational decision, not a privacy-handling one.
  // -------------------------------------------------------------------------

  listOfficers: superAdminProcedure.query(async () => {
    const grants = await listPrivacyOfficerGrants();
    return grants.map((g) => ({
      ...g,
      active: g.revokedAt === null,
    }));
  }),

  grantOfficer: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        // Required, and required to be substantive. "Who was allowed to read
        // the personal data, and why" is exactly what an audit asks.
        reason: z.string().trim().min(8).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const grant = await grantPrivacyOfficer({
        userId: input.userId,
        grantedByUserId: ctx.user.id,
        reason: input.reason,
      });
      if (!grant) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not record the grant.",
        });
      }
      return grant;
    }),

  revokeOfficer: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        reason: z.string().trim().min(8).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await revokePrivacyOfficer({
        userId: input.userId,
        revokedByUserId: ctx.user.id,
        reason: input.reason,
      });
      return { ok: true as const };
    }),

  // -------------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------------

  list: privacyOfficerProcedure
    .input(z.object({ status: z.string().max(32).optional() }).optional())
    .query(async ({ input }) => listPrivacyRequests({ status: input?.status })),

  get: privacyOfficerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }
      const events = await listPrivacyRequestEvents(input.id);
      return { request, events };
    }),

  create: privacyOfficerProcedure
    .input(
      z.object({
        requestType: z.enum(REQUEST_TYPES),
        subjectEmail: z.string().email().max(320),
        subjectName: z.string().trim().max(200).optional(),
        receivedAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.subjectEmail.trim().toLowerCase();

      // Link to an account when one exists, but do not require it: a contact
      // form submitter or a booking attendee is a data subject who never held
      // an account, and refusing their request would be the wrong answer.
      const account = await getUserByEmail(email);

      const receivedAt = input.receivedAt ?? new Date();
      const dueAt = new Date(receivedAt.getTime() + RESPONSE_WINDOW_DAYS * 86_400_000);

      const request = await createPrivacyRequest({
        publicRef: generatePublicRef("DSR"),
        requestType: input.requestType,
        subjectUserId: account?.id ?? null,
        subjectEmail: email,
        subjectName: input.subjectName ?? account?.name ?? null,
        receivedAt,
        dueAt,
        status: "received",
      });

      if (!request) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not record the request.",
        });
      }

      await appendPrivacyRequestEvent({
        requestId: request.id,
        actorUserId: ctx.user.id,
        event: "request_received",
        detail: `type=${input.requestType} subject=${email} linkedAccount=${account?.id ?? "none"}`,
        ...getRequestMeta(ctx.req),
      });

      return request;
    }),

  /**
   * Record the outcome of verifying that the requester is who they claim.
   *
   * Separate from every other status change because acting on an unverified
   * request is the classic way a subject access request becomes a data
   * breach: someone asks for "their" data using somebody else's address.
   */
  setIdentityVerification: privacyOfficerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["unverified", "pending", "verified", "failed"]),
        note: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }

      const updated = await updatePrivacyRequest(input.id, {
        identityVerificationStatus: input.status,
        identityVerificationNote: input.note ?? null,
        identityVerifiedAt: input.status === "verified" ? new Date() : null,
        identityVerifiedByUserId: input.status === "verified" ? ctx.user.id : null,
      });

      await appendPrivacyRequestEvent({
        requestId: input.id,
        actorUserId: ctx.user.id,
        event: "identity_verification_updated",
        detail: `status=${input.status}${input.note ? ` note=${input.note}` : ""}`,
        ...getRequestMeta(ctx.req),
      });

      return updated;
    }),

  /**
   * Find everything held about the subject, across every table that can hold
   * personal data.
   *
   * Gated on verified identity. Returning a person's data to an unverified
   * requester is the exact failure this control exists to prevent, so the
   * refusal is here rather than left to the operator's judgement.
   */
  locate: privacyOfficerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }
      if (request.identityVerificationStatus !== "verified") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "The subject's identity must be verified before their data can be located.",
        });
      }

      const located = await locatePersonalData({
        userId: request.subjectUserId,
        email: request.subjectEmail,
      });

      const summary = located.map((l) => ({
        table: l.table,
        matchedBy: l.matchedBy,
        rowCount: l.rows.length,
      }));

      await updatePrivacyRequest(input.id, {
        status: "locating",
        affectedSystemsJson: JSON.stringify({
          searchedAt: new Date().toISOString(),
          // Recording what was searched, not only what was found, is what
          // makes a nil return meaningful later.
          tablesSearched: PERSONAL_DATA_SOURCES.map((s) => s.table),
          found: summary,
        }),
      });

      await appendPrivacyRequestEvent({
        requestId: input.id,
        actorUserId: ctx.user.id,
        event: "data_located",
        detail: `tables=${summary.length} rows=${summary.reduce((a, s) => a + s.rowCount, 0)}`,
        ...getRequestMeta(ctx.req),
      });

      return { summary, located };
    }),

  /**
   * Produce the subject's data as JSON or CSV.
   *
   * Returns the payload as a string rather than writing it to storage: the
   * file is personal data about to leave the system, and where it goes next
   * is the authorised person's decision, not an automatic one.
   */
  export: privacyOfficerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        format: z.enum(["json", "csv"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }
      if (request.identityVerificationStatus !== "verified") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The subject's identity must be verified before an export can be produced.",
        });
      }

      const located = await locatePersonalData({
        userId: request.subjectUserId,
        email: request.subjectEmail,
      });

      const content =
        input.format === "json"
          ? JSON.stringify(
              {
                request: {
                  reference: request.publicRef,
                  type: request.requestType,
                  subject: { email: request.subjectEmail, name: request.subjectName },
                  producedAt: new Date().toISOString(),
                },
                data: located,
              },
              null,
              2,
            )
          : toCsv(located);

      await appendPrivacyRequestEvent({
        requestId: input.id,
        actorUserId: ctx.user.id,
        event: "data_exported",
        detail: `format=${input.format} tables=${located.length} bytes=${content.length}`,
        ...getRequestMeta(ctx.req),
      });

      return {
        filename: `${request.publicRef}.${input.format}`,
        contentType: input.format === "json" ? "application/json" : "text/csv",
        content,
      };
    }),

  /**
   * Stage an action for human approval. Carries nothing out.
   *
   * This is the half of the workflow that satisfies "must not autonomously
   * make final decisions without authorised human review": the system does
   * the gathering and the describing, and then stops and waits for a named
   * person.
   */
  prepareAction: privacyOfficerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        proposal: z.string().trim().min(10).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }

      if (!(EXECUTABLE_ACTIONS as readonly string[]).includes(request.requestType)) {
        // Erasure lands here. See the file header: which tables may be
        // deleted and which must be anonymised is an unmade legal decision,
        // and staging an erasure the system cannot honestly carry out would
        // be worse than refusing.
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message:
            "Erasure and anonymisation are not yet implemented. The per-table decision (delete versus anonymise, and which rows carry statutory retention) has not been made, and this request cannot be staged until it is.",
        });
      }

      const updated = await updatePrivacyRequest(input.id, {
        status: "awaiting_approval",
        actionsTakenJson: JSON.stringify({
          proposedAt: new Date().toISOString(),
          proposedByUserId: ctx.user.id,
          proposal: input.proposal,
          approved: false,
        }),
      });

      await appendPrivacyRequestEvent({
        requestId: input.id,
        actorUserId: ctx.user.id,
        event: "action_proposed",
        detail: input.proposal,
        ...getRequestMeta(ctx.req),
      });

      return updated;
    }),

  /**
   * A named authorised person approves or rejects a staged action.
   *
   * The approver is recorded separately from the proposer so the two never
   * collapse into one name. Self-approval is refused: an approval step that
   * the same person can satisfy alone is not a review.
   */
  approveAction: privacyOfficerProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().trim().min(4).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await getPrivacyRequestById(input.id);
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
      }
      if (request.status !== "awaiting_approval") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "There is no staged action awaiting approval on this request.",
        });
      }

      const staged = JSON.parse(request.actionsTakenJson ?? "{}") as {
        proposedByUserId?: number;
        proposal?: string;
      };

      if (staged.proposedByUserId === ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "A staged action must be approved by a different authorised person than the one who proposed it.",
        });
      }

      const approved = input.decision === "approve";

      const updated = await updatePrivacyRequest(input.id, {
        status: approved ? "completed" : "rejected",
        decision: input.note,
        completedAt: new Date(),
        actionsTakenJson: JSON.stringify({
          ...staged,
          approved,
          decidedAt: new Date().toISOString(),
          decidedByUserId: ctx.user.id,
          decisionNote: input.note,
        }),
      });

      await appendPrivacyRequestEvent({
        requestId: input.id,
        actorUserId: ctx.user.id,
        event: approved ? "action_approved" : "action_rejected",
        detail: input.note,
        ...getRequestMeta(ctx.req),
      });

      return updated;
    }),
});
