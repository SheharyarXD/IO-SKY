/**
 * Platform governance additions: notification templates (OPD-001), document
 * matrix (OPD-003), Technical Operator scopes and AI usage. Super Admin writes,
 * Admin reads. Every write is recorded through recordAdminEvent.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router, superAdminProcedure } from "../_core/trpc";
import { recordAdminEvent } from "./admin";
import { NOTIFICATION_EVENTS } from "../../shared/notificationCatalogue";
import {
  DOCUMENT_CLASSIFICATIONS,
  OPERATOR_SCOPES,
  TEMPLATE_CHANNELS,
  TEMPLATE_LOCALES,
  TEMPLATE_PLACEHOLDERS,
  renderTemplate,
  templateVariantId,
  validateTemplate,
} from "../../shared/platformRules";
import {
  activateTemplate,
  grantOperatorScope,
  listDocumentMatrix,
  listOperatorScopes,
  listTemplates,
  revokeOperatorScope,
  saveTemplateVersion,
  summariseAiUsage,
  updateDocumentMatrixRow,
} from "../db/platformGovernance";

const fail = (code: ConstructorParameters<typeof TRPCError>[0]["code"], message: string): never => {
  throw new TRPCError({ code, message });
};

const eventNames = new Set(NOTIFICATION_EVENTS.map((e: { name: string }) => e.name));

export const adminPlatformRouter = router({
  // ---- Notification templates -------------------------------------------------------------------------------------
  templateEvents: adminProcedure.query(() =>
    NOTIFICATION_EVENTS.map((e: { id: string; name: string; family: string }) => ({ id: e.id, name: e.name, family: e.family })),
  ),
  templatePlaceholders: adminProcedure.query(() => ({ placeholders: [...TEMPLATE_PLACEHOLDERS], channels: [...TEMPLATE_CHANNELS], locales: [...TEMPLATE_LOCALES] })),
  listTemplates: adminProcedure.input(z.object({ eventName: z.string().max(96).optional() }).optional()).query(async ({ input }) => {
    const rows = await listTemplates(input?.eventName);
    return rows.map((r) => ({ ...r, variantId: templateVariantId(r.eventName, r.channel, r.locale, r.version) }));
  }),
  saveTemplate: superAdminProcedure
    .input(
      z.object({
        eventName: z.string().max(96),
        channel: z.enum(TEMPLATE_CHANNELS),
        locale: z.enum(TEMPLATE_LOCALES),
        subject: z.string().trim().max(300),
        body: z.string().max(8000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The catalogue is the only source of event ids. A template never creates an event.
      if (!eventNames.has(input.eventName)) fail("BAD_REQUEST", "Unknown notification event.");
      const v = validateTemplate(input);
      if (!v.ok) fail("BAD_REQUEST", v.reason);
      const row = await saveTemplateVersion({ ...input, userId: ctx.user.id });
      if (!row) fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      await recordAdminEvent({ ctx, reason: `admin.template.save(${templateVariantId(row!.eventName, row!.channel, row!.locale, row!.version)})` });
      return row;
    }),
  activateTemplate: superAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const row = await activateTemplate(input.id);
    if (row === "not_found" || !row) fail("NOT_FOUND", "Template version not found.");
    await recordAdminEvent({ ctx, reason: `admin.template.activate(${input.id})` });
    return row;
  }),
  previewTemplate: adminProcedure
    .input(z.object({ subject: z.string().max(300), body: z.string().max(8000) }))
    .query(({ input }) => {
      const sample = { recipientName: "Alex Example", organizationName: "Example BV", reference: "REF-1042", link: "https://example.invalid/open", date: "1 January 2027", amount: "EUR 1,250.00", projectName: "Example project" };
      return { subject: renderTemplate(input.subject, sample), body: renderTemplate(input.body, sample), valid: validateTemplate(input) };
    }),

  // ---- Document matrix --------------------------------------------------------------------------------------------
  documentMatrix: adminProcedure.query(() => listDocumentMatrix()),
  updateDocumentMatrix: superAdminProcedure
    .input(
      z.object({
        documentType: z.string().max(64),
        authorizedRoles: z.array(z.enum(["super_admin", "admin", "technical_operator", "developer", "client"])).min(1),
        versioned: z.boolean(),
        approvalRequired: z.boolean(),
        // Retention is configurable; no legal duration is built in.
        retentionDays: z.number().int().min(1).max(36500).nullable(),
        archiveOnProjectCompletion: z.boolean(),
        classification: z.enum(DOCUMENT_CLASSIFICATIONS),
        clientVisible: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { documentType, authorizedRoles, ...rest } = input;
      if (!authorizedRoles.includes("super_admin")) fail("BAD_REQUEST", "Super Admin must keep access to every document type.");
      const row = await updateDocumentMatrixRow(documentType, { ...rest, authorizedRoles: JSON.stringify(authorizedRoles) }, ctx.user.id);
      if (!row) fail("NOT_FOUND", "Unknown document type.");
      await recordAdminEvent({ ctx, reason: `admin.document_matrix.update(${documentType})` });
      return row;
    }),

  // ---- Technical Operator scopes ----------------------------------------------------------------------------------
  operatorScopes: adminProcedure.input(z.object({ userId: z.number().int().positive().optional() }).optional()).query(({ input }) => listOperatorScopes(input?.userId)),
  grantOperatorScope: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        scope: z.enum(OPERATOR_SCOPES),
        expiresInDays: z.number().int().min(1).max(365).nullable(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
      const res = await grantOperatorScope({ userId: input.userId, scope: input.scope, expiresAt, note: input.note ?? null, grantedByUserId: ctx.user.id });
      if (res === "unavailable") fail("INTERNAL_SERVER_ERROR", "Database unavailable.");
      if (res === "no_user") fail("NOT_FOUND", "User not found.");
      if (res === "not_operator") fail("BAD_REQUEST", "Scopes can only be granted to a Technical Operator.");
      await recordAdminEvent({ ctx, reason: `admin.operator_scope.grant(user=${input.userId}:${input.scope}:${expiresAt ? expiresAt.toISOString().slice(0, 10) : "no-expiry"})` });
      return res;
    }),
  revokeOperatorScope: superAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    if (!(await revokeOperatorScope(input.id))) fail("NOT_FOUND", "No active grant with that id.");
    await recordAdminEvent({ ctx, reason: `admin.operator_scope.revoke(${input.id})` });
    return { ok: true as const };
  }),

  // ---- AI usage and routing ---------------------------------------------------------------------------------------
  aiUsage: adminProcedure.input(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional()).query(async ({ input }) => {
    const usage = await summariseAiUsage(input?.days ?? 30);
    const env = process.env;
    return {
      ...usage,
      routing: {
        simple: env.LLM_MODEL_SIMPLE || env.LLM_MODEL || "gpt-4o-mini (default)",
        medium: env.LLM_MODEL_MEDIUM || env.LLM_MODEL || "gpt-4o-mini (default)",
        complex: env.LLM_MODEL_COMPLEX || env.LLM_MODEL || "gpt-4o (default)",
        pricesConfigured: Boolean(env.LLM_PRICES_JSON),
      },
    };
  }),
});
