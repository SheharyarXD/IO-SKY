/*
 * IO SKY — Admin Portal · Platform governance (OPD-001, OPD-003, SRS 15.4, 19.24).
 *
 * Notification templates with versions, the document matrix, Technical Operator
 * scopes with expiry, and AI model routing with usage. Reads are open to admins;
 * writes need a super admin and are enforced on the server.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DataTable, StatusPill } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, TabBar, shortDateTime } from "./_shared/Forms";

type Sub = "templates" | "matrix" | "scopes" | "aiusage";
const SUBS: Array<{ id: Sub; label: string }> = [
  { id: "templates", label: "Notification templates" },
  { id: "matrix", label: "Document matrix" },
  { id: "scopes", label: "Operator scopes" },
  { id: "aiusage", label: "AI routing and usage" },
];

export function PlatformGovernance() {
  const [sub, setSub] = useState<Sub>("templates");
  return (
    <div className="space-y-4">
      <TabBar tabs={SUBS} value={sub} onChange={setSub} />
      {sub === "templates" && <Templates />}
      {sub === "matrix" && <Matrix />}
      {sub === "scopes" && <Scopes />}
      {sub === "aiusage" && <AiUsage />}
    </div>
  );
}

function Templates() {
  const utils = trpc.useUtils();
  const events = trpc.adminPlatform.templateEvents.useQuery();
  const meta = trpc.adminPlatform.templatePlaceholders.useQuery();
  const list = trpc.adminPlatform.listTemplates.useQuery();
  const save = trpc.adminPlatform.saveTemplate.useMutation({ onSuccess: () => utils.adminPlatform.listTemplates.invalidate() });
  const activate = trpc.adminPlatform.activateTemplate.useMutation({ onSuccess: () => utils.adminPlatform.listTemplates.invalidate() });
  type Row = NonNullable<typeof list.data>[number];
  return (
    <>
      <Panel title="Template versions">
        <DataTable
          columns={[
            { key: "variantId", header: "Variant" },
            { key: "subject", header: "Subject" },
            { key: "status", header: "Status", render: (r: Row) => <StatusPill tone={(r.status === "active" ? "ok" : r.status === "draft" ? "info" : "muted") as never} label={r.status} /> },
            { key: "createdAt", header: "Saved", render: (r: Row) => shortDateTime(r.createdAt) },
            {
              key: "actions",
              header: "",
              render: (r: Row) =>
                r.status !== "active" ? (
                  <SmallButton onClick={() => activate.mutateAsync({ id: r.id }).then(() => toast.success("Version activated.")).catch((e) => toast.error(e.message))}>
                    Activate
                  </SmallButton>
                ) : null,
            },
          ]}
          rows={list.data ?? []}
          emptyLabel="No templates yet. Notifications use the built in wording until a version is activated."
        />
      </Panel>
      <FormCard
        title="New template version"
        submitLabel="Save as draft"
        successMessage="Saved as a new draft version. Activate it to use it."
        columns={2}
        fields={[
          { name: "eventName", label: "Event", type: "select", required: true, options: (events.data ?? []).map((e) => ({ value: e.name, label: `${e.id}  ${e.name}` })) },
          { name: "channel", label: "Channel", type: "select", required: true, initial: "in_app", options: (meta.data?.channels ?? []).map((c) => ({ value: c, label: c })) },
          { name: "locale", label: "Language", type: "select", required: true, initial: "en", options: (meta.data?.locales ?? []).map((l) => ({ value: l, label: l.toUpperCase() })) },
          { name: "subject", label: "Subject or title", required: true },
          { name: "body", label: "Body", type: "textarea", required: true, hint: `Placeholders: ${(meta.data?.placeholders ?? []).map((p) => `{{${p}}}`).join(" ")}` },
        ]}
        onSubmit={(v) => save.mutateAsync({ eventName: v.eventName, channel: v.channel as "in_app" | "email", locale: v.locale as "en" | "nl", subject: v.subject, body: v.body })}
      />
    </>
  );
}

function Matrix() {
  const utils = trpc.useUtils();
  const q = trpc.adminPlatform.documentMatrix.useQuery();
  const update = trpc.adminPlatform.updateDocumentMatrix.useMutation({ onSuccess: () => utils.adminPlatform.documentMatrix.invalidate() });
  const rows = (q.data ?? []).map((r) => ({ ...r, id: r.documentType }));
  type Row = (typeof rows)[number];
  const roles = (r: Row) => {
    try {
      return (JSON.parse(r.authorizedRoles) as string[]).join(", ");
    } catch {
      return r.authorizedRoles;
    }
  };
  return (
    <>
      <Panel title="Document matrix">
        <DataTable
          columns={[
            { key: "label", header: "Document type" },
            { key: "owningEntity", header: "Owner" },
            { key: "roles", header: "Authorized roles", render: (r: Row) => roles(r) },
            { key: "approvalRequired", header: "Approval", render: (r: Row) => (r.approvalRequired ? "required" : "no") },
            { key: "classification", header: "Class" },
            { key: "retentionDays", header: "Retention", render: (r: Row) => (r.retentionDays ? `${r.retentionDays} days` : "not set") },
            { key: "provisional", header: "State", render: (r: Row) => <StatusPill tone={(r.provisional ? "warn" : "ok") as never} label={r.provisional ? "provisional" : "confirmed"} /> },
          ]}
          rows={rows}
          emptyLabel="No document types."
        />
        <p className="mt-3 text-[12px] text-white/50">Retention is configurable and empty until legal advice sets a duration. Archive moves a document out of active views and never deletes it.</p>
      </Panel>
      <FormCard
        title="Confirm or change a document type"
        submitLabel="Save"
        columns={3}
        fields={[
          { name: "documentType", label: "Type", type: "select", required: true, options: (q.data ?? []).map((r) => ({ value: r.documentType, label: r.label })) },
          { name: "roles", label: "Roles (comma separated)", required: true, placeholder: "super_admin, admin, client" },
          { name: "classification", label: "Classification", type: "select", required: true, initial: "confidential", options: ["public", "internal", "confidential", "restricted"].map((c) => ({ value: c, label: c })) },
          { name: "approvalRequired", label: "Approval required", type: "select", required: true, initial: "no", options: [{ value: "yes", label: "yes" }, { value: "no", label: "no" }] },
          { name: "clientVisible", label: "Visible to the client", type: "select", required: true, initial: "no", options: [{ value: "yes", label: "yes" }, { value: "no", label: "no" }] },
          { name: "retentionDays", label: "Retention (days)", type: "number", hint: "Leave empty until a duration is decided." },
        ]}
        onSubmit={(v) => {
          const row = (q.data ?? []).find((r) => r.documentType === v.documentType);
          return update.mutateAsync({
            documentType: v.documentType,
            authorizedRoles: v.roles.split(",").map((s) => s.trim()).filter(Boolean) as never,
            versioned: row?.versioned ?? true,
            approvalRequired: v.approvalRequired === "yes",
            retentionDays: v.retentionDays ? Number(v.retentionDays) : null,
            archiveOnProjectCompletion: row?.archiveOnProjectCompletion ?? true,
            classification: v.classification as never,
            clientVisible: v.clientVisible === "yes",
          });
        }}
      />
    </>
  );
}

function Scopes() {
  const utils = trpc.useUtils();
  const q = trpc.adminPlatform.operatorScopes.useQuery();
  const grant = trpc.adminPlatform.grantOperatorScope.useMutation({ onSuccess: () => utils.adminPlatform.operatorScopes.invalidate() });
  const revoke = trpc.adminPlatform.revokeOperatorScope.useMutation({ onSuccess: () => utils.adminPlatform.operatorScopes.invalidate() });
  type Row = NonNullable<typeof q.data>[number];
  const state = (r: Row) => (r.revokedAt ? "revoked" : r.expiresAt && new Date(r.expiresAt).getTime() <= Date.now() ? "expired" : "active");
  return (
    <>
      <Panel title="Technical Operator scopes">
        <DataTable
          columns={[
            { key: "email", header: "Operator" },
            { key: "scope", header: "Scope", render: (r: Row) => r.scope.replace(/_/g, " ") },
            { key: "state", header: "State", render: (r: Row) => <StatusPill tone={(state(r) === "active" ? "ok" : "muted") as never} label={state(r)} /> },
            { key: "expiresAt", header: "Expires", render: (r: Row) => (r.expiresAt ? shortDateTime(r.expiresAt) : "no expiry") },
            {
              key: "actions",
              header: "",
              render: (r: Row) =>
                state(r) === "active" ? (
                  <SmallButton tone="danger" onClick={() => revoke.mutateAsync({ id: r.id }).then(() => toast.success("Scope revoked.")).catch((e) => toast.error(e.message))}>
                    Revoke
                  </SmallButton>
                ) : null,
            },
          ]}
          rows={q.data ?? []}
          emptyLabel="No scopes granted. A Technical Operator sees only what is explicitly authorized."
        />
      </Panel>
      <FormCard
        title="Grant a scope"
        submitLabel="Grant"
        columns={3}
        fields={[
          { name: "userId", label: "Operator user id", type: "number", required: true },
          { name: "scope", label: "Scope", type: "select", required: true, initial: "backend", options: ["frontend", "backend", "full_stack", "ui_ux", "infrastructure", "security", "database"].map((s) => ({ value: s, label: s.replace(/_/g, " ") })), hint: "The security scope is what opens the Security Center." },
          { name: "days", label: "Expires in (days)", type: "number", hint: "Leave empty for no expiry." },
        ]}
        onSubmit={(v) => grant.mutateAsync({ userId: Number(v.userId), scope: v.scope as never, expiresInDays: v.days ? Number(v.days) : null })}
      />
    </>
  );
}

function AiUsage() {
  const q = trpc.adminPlatform.aiUsage.useQuery({ days: 30 });
  const d = q.data;
  const usageRows = (d?.byModel ?? []).map((r) => ({ ...r, id: `${r.model}:${r.complexity}` }));
  type Row = (typeof usageRows)[number];
  return (
    <>
      <Panel title="Model routing">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[13px] text-white/85">
          <div>Simple: <strong>{d?.routing.simple ?? "..."}</strong></div>
          <div>Medium: <strong>{d?.routing.medium ?? "..."}</strong></div>
          <div>Complex: <strong>{d?.routing.complex ?? "..."}</strong></div>
        </div>
        <p className="mt-2 text-[12px] text-white/50">Each AI call declares its complexity and the matching model is used. Models are set by configuration, not code.{d && !d.routing.pricesConfigured ? " Prices are not configured, so cost shows as not priced." : ""}</p>
      </Panel>
      <Panel title="Usage, last 30 days">
        <DataTable
          columns={[
            { key: "model", header: "Model" },
            { key: "complexity", header: "Class" },
            { key: "calls", header: "Calls" },
            { key: "promptTokens", header: "Prompt tokens" },
            { key: "completionTokens", header: "Completion tokens" },
            { key: "costMicros", header: "Cost (USD)", render: (r: Row) => (r.unpriced === r.calls ? "not priced" : `$${(r.costMicros / 1_000_000).toFixed(4)}`) },
          ]}
          rows={usageRows}
          emptyLabel="No AI calls recorded yet."
        />
      </Panel>
    </>
  );
}
