/*
 * IO SKY — Admin Portal · Governance and Operations (SRS 13, 19, 20, 21, 24, 25).
 *
 * Incident register, alert rules, AI agent registry with versioned prompts and
 * execution history, configuration history with maintenance mode, and
 * scheduled reports. Super admin only actions are enforced on the server; the
 * forms stay visible so an admin can see what exists.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OperationalPage, { DataTable, StatusPill, type DataColumn } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, TabBar, shortDateTime } from "./_shared/Forms";
import { AuditSearch, CommunicationHistory, Compliance, Health } from "./GovernanceExtras";
import { AiScanReview } from "./AiScanReview";
import { Invitations } from "./Invitations";
import { PlatformGovernance } from "./PlatformGovernance";

type Tab = "incidents" | "alerts" | "ai" | "config" | "reports" | "audit" | "health" | "scanreview" | "comms" | "compliance" | "invites" | "platform";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "scanreview", label: "AI Scan review" },
  { id: "incidents", label: "Incidents" },
  { id: "alerts", label: "Alert rules" },
  { id: "ai", label: "AI agents" },
  { id: "config", label: "Configuration" },
  { id: "reports", label: "Scheduled reports" },
  { id: "audit", label: "Audit search" },
  { id: "health", label: "Platform health" },
  { id: "comms", label: "Communication history" },
  { id: "compliance", label: "Compliance" },
  { id: "invites", label: "Invitations" },
  { id: "platform", label: "Templates, matrix and scopes" },
];

const sevTone = (s: string) => (s === "critical" ? "err" : s === "high" ? "warn" : s === "medium" ? "info" : "muted");

export function Governance() {
  const [tab, setTab] = useState<Tab>("scanreview");
  return (
    <OperationalPage
      eyebrow="Governance"
      title="Governance & Operations"
      tagline="Register and close incidents, tune alert thresholds, govern AI agents and prompts, review configuration changes, and schedule reports."
      primary={
        <div className="space-y-4">
          <TabBar tabs={TABS} value={tab} onChange={setTab} />
          {tab === "scanreview" && <AiScanReview />}
          {tab === "incidents" && <Incidents />}
          {tab === "alerts" && <Alerts />}
          {tab === "ai" && <AiGovernance />}
          {tab === "config" && <Configuration />}
          {tab === "reports" && <Reports />}
          {tab === "audit" && <AuditSearch />}
          {tab === "health" && <Health />}
          {tab === "comms" && <CommunicationHistory />}
          {tab === "compliance" && <Compliance />}
          {tab === "invites" && <Invitations />}
          {tab === "platform" && <PlatformGovernance />}
        </div>
      }
    />
  );
}

function Incidents() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.incidents.useQuery({});
  const create = trpc.adminOps.createIncident.useMutation({ onSuccess: () => utils.adminOps.incidents.invalidate() });
  const update = trpc.adminOps.updateIncident.useMutation({ onSuccess: () => utils.adminOps.incidents.invalidate() });
  const act = (id: number, status: "investigating" | "resolved" | "closed") => {
    let resolution: string | undefined;
    if (status !== "investigating") {
      const r = window.prompt("What was the resolution?");
      if (!r?.trim()) return;
      resolution = r.trim();
    }
    update.mutateAsync({ id, status, resolution }).then(() => toast.success(`Incident ${status}.`)).catch((e) => toast.error(e.message));
  };
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "id", header: "Ref", width: "64px", render: (r) => <span className="font-mono text-white/55">INC-{r.id}</span> },
    { key: "category", header: "Type" },
    { key: "title", header: "Incident" },
    { key: "severity", header: "Severity", render: (r) => <StatusPill tone={sevTone(r.severity) as never} label={r.severity} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "closed" || r.status === "resolved" ? "ok" : "warn"} label={r.status} /> },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "closed" ? null : (
          <div className="flex gap-1">
            {r.status === "open" && <SmallButton onClick={() => act(r.id, "investigating")}>Investigate</SmallButton>}
            {r.status !== "resolved" && <SmallButton onClick={() => act(r.id, "resolved")}>Resolve</SmallButton>}
            <SmallButton onClick={() => act(r.id, "closed")}>Close</SmallButton>
          </div>
        ),
    },
  ];
  return (
    <>
      <Panel title="Incident register">
        <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No incidents on record." />
      </Panel>
      <FormCard
        title="Register an incident"
        submitLabel="Register"
        fields={[
          { name: "category", label: "Type", type: "select", required: true, initial: "security", options: [{ value: "security", label: "Security" }, { value: "operational", label: "Operational" }] },
          { name: "severity", label: "Severity", type: "select", required: true, initial: "medium", options: ["low", "medium", "high", "critical"].map((v) => ({ value: v, label: v })) },
          { name: "title", label: "Title", required: true },
          { name: "description", label: "What happened", type: "textarea" },
        ]}
        onSubmit={(v) => create.mutateAsync({ category: v.category as "security", severity: v.severity as "medium", title: v.title, description: v.description || undefined })}
      />
    </>
  );
}

function Alerts() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.alertRules.useQuery();
  const update = trpc.adminOps.updateAlertRule.useMutation({ onSuccess: () => utils.adminOps.alertRules.invalidate() });
  const evaluate = trpc.adminOps.evaluateAlerts.useMutation({ onSuccess: () => utils.adminOps.alertRules.invalidate() });
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "title", header: "Rule" },
    { key: "metric", header: "Metric" },
    { key: "threshold", header: "Fires at", align: "right", render: (r) => `${r.threshold} in ${r.windowMinutes} min` },
    { key: "lastFiredAt", header: "Last fired", render: (r) => shortDateTime(r.lastFiredAt) },
    { key: "enabled", header: "State", render: (r) => <StatusPill tone={r.enabled ? "ok" : "muted"} label={r.enabled ? "on" : "off"} /> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-1">
          <SmallButton onClick={() => update.mutateAsync({ id: r.id, enabled: !r.enabled }).catch((e) => toast.error(e.message))}>{r.enabled ? "Turn off" : "Turn on"}</SmallButton>
          <SmallButton
            onClick={() => {
              const v = window.prompt("Fire when the count reaches?", String(r.threshold));
              const n = Number(v);
              if (v && Number.isInteger(n) && n > 0) update.mutateAsync({ id: r.id, threshold: n }).catch((e) => toast.error(e.message));
            }}
          >
            Threshold
          </SmallButton>
        </div>
      ),
    },
  ];
  return (
    <Panel
      title="Alert rules"
      action={
        <SmallButton
          onClick={() =>
            evaluate
              .mutateAsync()
              .then((r) => toast.success(`Checked ${r.length} rules, ${r.filter((x) => x.fired).length} fired.`))
              .catch((e) => toast.error(e.message))
          }
        >
          Check now
        </SmallButton>
      }
    >
      <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No alert rules." />
      <p className="mt-3 text-[11.5px] text-white/45">Rules are also checked every five minutes. A firing raises an admin notification and, for failed sign ins, registers a security incident.</p>
    </Panel>
  );
}

function AiGovernance() {
  const utils = trpc.useUtils();
  const agents = trpc.adminOps.aiAgents.useQuery();
  const execs = trpc.adminOps.aiExecutions.useQuery({});
  const upsert = trpc.adminOps.upsertAiAgent.useMutation({ onSuccess: () => utils.adminOps.aiAgents.invalidate() });
  const addPrompt = trpc.adminOps.addPromptVersion.useMutation({ onSuccess: () => utils.adminOps.aiAgents.invalidate() });
  const decide = trpc.adminOps.decideAiExecution.useMutation({ onSuccess: () => utils.adminOps.aiExecutions.invalidate() });
  const decidedRefs = new Set((execs.data ?? []).map((e) => e.subjectRef).filter((s): s is string => !!s?.startsWith("execution:")));
  const awaiting = (execs.data ?? []).filter((e) => e.outcome === "awaiting_approval" && !decidedRefs.has(`execution:${e.id}`));

  return (
    <>
      <Panel title="Agent registry">
        <DataTable
          columns={[
            { key: "key", header: "Agent", render: (r: NonNullable<typeof agents.data>[number]) => <span className="font-mono">{r.key}</span> },
            { key: "name", header: "Name" },
            { key: "permissions", header: "Permitted actions", render: (r: NonNullable<typeof agents.data>[number]) => (r.permissions.length ? r.permissions.join(", ") : <span className="text-white/40">none</span>) },
            { key: "activePromptVersion", header: "Prompt", render: (r: NonNullable<typeof agents.data>[number]) => (r.activePromptVersion ? `v${r.activePromptVersion}` : <span className="text-white/40">none</span>) },
            { key: "requiresHumanApproval", header: "Human approval", render: (r: NonNullable<typeof agents.data>[number]) => (r.requiresHumanApproval ? "required" : "not required") },
            { key: "status", header: "Status", render: (r: NonNullable<typeof agents.data>[number]) => <StatusPill tone={r.status === "active" ? "ok" : "muted"} label={r.status} /> },
          ]}
          rows={agents.data ?? []}
          emptyLabel="No AI agents are registered. An agent can only act once it is registered with explicit permissions."
        />
      </Panel>
      <Panel title="Registry details (SRS 19.17)">
        <DataTable
          columns={[
            { key: "key", header: "Agent", render: (r: NonNullable<typeof agents.data>[number]) => <span className="font-mono">{r.key}</span> },
            { key: "businessFunction", header: "Business function", render: (r: NonNullable<typeof agents.data>[number]) => r.businessFunction ?? <span className="text-white/40">not set</span> },
            { key: "supportedModules", header: "Modules", render: (r: NonNullable<typeof agents.data>[number]) => (r.supportedModules.length ? r.supportedModules.join(", ") : <span className="text-white/40">none</span>) },
            { key: "tools", header: "Tools", render: (r: NonNullable<typeof agents.data>[number]) => (r.tools.length ? r.tools.join(", ") : <span className="text-white/40">none</span>) },
            { key: "knowledgeSources", header: "Knowledge sources", render: (r: NonNullable<typeof agents.data>[number]) => (r.knowledgeSources.length ? r.knowledgeSources.join(", ") : <span className="text-white/40">none</span>) },
            { key: "maxAuthority", header: "Max authority", render: (r: NonNullable<typeof agents.data>[number]) => r.maxAuthority.replace(/_/g, " ") },
            { key: "responsibleAdmin", header: "Responsible admin", render: (r: NonNullable<typeof agents.data>[number]) => (r.responsibleAdmin ? r.responsibleAdmin.name ?? r.responsibleAdmin.email ?? `user ${r.responsibleAdmin.id}` : <span className="text-white/40">unassigned</span>) },
            { key: "registryVersion", header: "Registry", render: (r: NonNullable<typeof agents.data>[number]) => `v${r.registryVersion}` },
            { key: "missingFields", header: "Complete?", render: (r: NonNullable<typeof agents.data>[number]) => (r.missingFields.length === 0 ? <StatusPill tone="ok" label="complete" /> : <span className="text-[11.5px] text-amber-300/90" title={r.missingFields.join(", ")}>missing {r.missingFields.length}: {r.missingFields.join(", ")}</span>) },
          ]}
          rows={agents.data ?? []}
          emptyLabel="No AI agents are registered."
        />
        <p className="mt-3 text-[11.5px] text-white/45">An agent that names a tool or knowledge source it does not need to list is fine to leave empty. Missing fields are the SRS 19.17 minimum that nobody has filled in yet.</p>
      </Panel>
      <Panel title="Waiting for a human decision">
        <DataTable
          columns={[
            { key: "agentKey", header: "Agent" },
            { key: "action", header: "Action" },
            { key: "createdAt", header: "When", render: (r: NonNullable<typeof execs.data>[number]) => shortDateTime(r.createdAt) },
            {
              key: "actions",
              header: "",
              render: (r: NonNullable<typeof execs.data>[number]) => (
                <div className="flex gap-1">
                  <SmallButton onClick={() => decide.mutateAsync({ executionId: r.id, approve: true }).then(() => toast.success("Approved.")).catch((e) => toast.error(e.message))}>Approve</SmallButton>
                  <SmallButton tone="danger" onClick={() => decide.mutateAsync({ executionId: r.id, approve: false }).then(() => toast.success("Rejected.")).catch((e) => toast.error(e.message))}>Reject</SmallButton>
                </div>
              ),
            },
          ]}
          rows={awaiting}
          emptyLabel="Nothing is waiting for approval."
        />
      </Panel>
      <Panel title="Execution history (append only)">
        <DataTable
          columns={[
            { key: "createdAt", header: "When", render: (r: NonNullable<typeof execs.data>[number]) => shortDateTime(r.createdAt) },
            { key: "agentKey", header: "Agent" },
            { key: "action", header: "Action" },
            { key: "promptVersion", header: "Prompt", render: (r: NonNullable<typeof execs.data>[number]) => (r.promptVersion ? `v${r.promptVersion}` : "n/a") },
            { key: "outcome", header: "Outcome", render: (r: NonNullable<typeof execs.data>[number]) => <StatusPill tone={r.outcome === "blocked_by_permission" || r.outcome === "failed" || r.outcome === "rejected" ? "err" : r.outcome === "awaiting_approval" ? "warn" : "ok"} label={r.outcome.replace(/_/g, " ")} /> },
          ]}
          rows={execs.data ?? []}
          emptyLabel="No AI activity has been recorded yet."
        />
      </Panel>
      <FormCard
        title="Register or update an agent (super admin)"
        submitLabel="Save agent"
        fields={[
          { name: "key", label: "Key", required: true, placeholder: "support_scribe", hint: "Lower case, digits, underscores." },
          { name: "name", label: "Name", required: true },
          { name: "permissions", label: "Permitted actions", placeholder: "draft_reply, summarise_ticket", hint: "Comma separated. Anything not listed is refused and recorded." },
          { name: "requiresHumanApproval", label: "Human approval", type: "select", required: true, initial: "yes", options: [{ value: "yes", label: "Required" }, { value: "no", label: "Not required" }] },
          { name: "status", label: "Status", type: "select", required: true, initial: "active", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }] },
          { name: "purpose", label: "Purpose", type: "textarea" },
          { name: "businessFunction", label: "Business function", placeholder: "AI Scan report drafting", hint: "Leave a registry field blank to keep its current value." },
          { name: "supportedModules", label: "Supported modules", placeholder: "ai_scan, crm", hint: "Comma separated: lower case, digits, underscores." },
          { name: "capabilities", label: "Authorized capabilities", placeholder: "draft_scan_report" },
          { name: "tools", label: "Available tools", placeholder: "search_documents", hint: "Comma separated. The agent runtime refuses a tool that is not listed." },
          { name: "knowledgeSources", label: "Knowledge sources", placeholder: "ai_scan_reports, business_rules", hint: "From: ai_scan_reports, client_documentation, project_documentation, technical_documentation, internal_procedures, knowledge_base_articles, product_documentation, business_rules, operational_data, platform_configuration." },
          { name: "maxAuthority", label: "Maximum authority", type: "select", initial: "", options: [{ value: "", label: "(unchanged)" }, { value: "read_only", label: "Read only" }, { value: "draft_only", label: "Draft only" }, { value: "act_with_approval", label: "Act with approval" }, { value: "act_autonomously", label: "Act autonomously" }] },
          { name: "responsibleAdminUserId", label: "Responsible admin (user id)", placeholder: "12", hint: "Must be an admin or super admin." },
          { name: "escalationRules", label: "Escalation rules", type: "textarea", hint: "When the agent must hand over to a person, and to whom." },
        ]}
        onSubmit={(v) => {
          const list = (x: string | undefined) => (x && x.trim() ? x.split(",").map((s) => s.trim()).filter(Boolean) : undefined);
          return upsert.mutateAsync({
            key: v.key,
            name: v.name,
            purpose: v.purpose || undefined,
            permissions: v.permissions.split(",").map((s) => s.trim()).filter(Boolean),
            requiresHumanApproval: v.requiresHumanApproval === "yes",
            status: v.status as "active",
            businessFunction: v.businessFunction?.trim() || undefined,
            supportedModules: list(v.supportedModules),
            capabilities: list(v.capabilities),
            tools: list(v.tools),
            knowledgeSources: list(v.knowledgeSources),
            maxAuthority: v.maxAuthority || undefined,
            responsibleAdminUserId: v.responsibleAdminUserId?.trim() ? Number(v.responsibleAdminUserId) : undefined,
            escalationRules: v.escalationRules?.trim() || undefined,
          });
        }}
      />
      <PromptTools agents={agents.data ?? []} />
      <FormCard
        title="Add a prompt version (super admin)"
        submitLabel="Save as new version"
        columns={1}
        fields={[
          { name: "agentKey", label: "Agent", type: "select", required: true, options: (agents.data ?? []).map((a) => ({ value: a.key, label: `${a.name} (${a.key})` })) },
          { name: "body", label: "Prompt", type: "textarea", required: true, hint: "Saved as a new version. Earlier versions are kept so any output can be traced to its prompt." },
          { name: "changeNote", label: "What changed" },
          { name: "activate", label: "Make it the active prompt", type: "select", required: true, initial: "yes", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No, save as draft" }] },
        ]}
        onSubmit={(v) => addPrompt.mutateAsync({ agentKey: v.agentKey, body: v.body, changeNote: v.changeNote || undefined, activate: v.activate === "yes" })}
      />
    </>
  );
}

function BackupPolicyPanel() {
  const q = trpc.admin.backupPolicy.useQuery(undefined, { staleTime: 30_000 });
  const d = q.data;
  const tone = d?.status === "declared" ? "ok" : d?.status === "attention" ? "err" : "warn";
  const row = (label: string, value: string | number | boolean | null) => (
    <div className="flex justify-between gap-4 border-b border-border/50 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value === null || value === undefined ? "Not declared" : typeof value === "boolean" ? (value ? "On" : "Off") : String(value)}</span>
    </div>
  );
  return (
    <Panel title="Backup policy (declared, not verified)">
      {!d ? (
        <p className="text-sm text-muted-foreground">{q.isLoading ? "Loading." : "The backup policy could not be read."}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusPill tone={tone} label={d.status.replace(/_/g, " ")} />
            {d.rehearsalDue ? <StatusPill tone="warn" label="restore rehearsal due" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">{d.disclosure}</p>
          <div>
            {row("Acceptable data loss (hours)", d.declared.rpoHours)}
            {row("Target recovery time (hours)", d.declared.rtoHours)}
            {row("Retention (days)", d.declared.retentionDays)}
            {row("Point in time recovery", d.declared.pitr)}
            {row("Uploaded files", d.declared.storageProcedure)}
            {row("Last restore rehearsal", d.declared.rehearsedNever ? "Never" : d.declared.lastRehearsalDate)}
            {row("Last rehearsal result", d.declared.lastRehearsalResult)}
            {row("Responsible", d.declared.owner)}
          </div>
          {d.findings.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {d.findings.map((f) => (
                <li key={f.code} className="flex gap-2">
                  <StatusPill tone={f.severity === "high" ? "err" : "warn"} label={f.severity} />
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">To change a value, use "Change a setting" below (super admin). Every change is validated and kept in the history.</p>
        </div>
      )}
    </Panel>
  );
}

function PromptTools({ agents }: { agents: Array<{ key: string; name: string }> }) {
  const [agentKey, setAgentKey] = useState("");
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [samplesText, setSamplesText] = useState("");
  const versions = trpc.adminOps.aiPromptVersions.useQuery({ agentKey }, { enabled: agentKey !== "" });
  const list = versions.data ?? [];
  const compare = trpc.adminOps.comparePromptVersions.useQuery({ agentKey, from: from ?? 1, to: to ?? 1 }, { enabled: agentKey !== "" && from !== null && to !== null });
  // sample values: one "name=value" per line
  const samples = Object.fromEntries(
    samplesText
      .split("\n")
      .map((l) => l.split("="))
      .filter((p) => p.length >= 2 && p[0].trim())
      .map((p) => [p[0].trim(), p.slice(1).join("=").trim()]),
  );
  const preview = trpc.adminOps.previewPrompt.useQuery(
    draft.trim() ? { body: draft, samples } : { agentKey, version: to ?? from ?? 1, samples },
    { enabled: draft.trim() !== "" || (agentKey !== "" && (to !== null || from !== null)) },
  );
  const sel = "h-8 rounded-md border border-white/[0.1] bg-transparent px-2 text-[12px]";
  const versionSelect = (value: number | null, set: (v: number | null) => void, label: string) => (
    <select className={sel} aria-label={label} value={value ?? ""} onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{label}</option>
      {list.map((v) => (
        <option key={v.version} value={v.version}>
          v{v.version}
          {v.isActive ? " (active)" : ""}
        </option>
      ))}
    </select>
  );
  return (
    <Panel title="Compare and preview prompts (no model is called)">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} aria-label="Agent" value={agentKey} onChange={(e) => { setAgentKey(e.target.value); setFrom(null); setTo(null); }}>
            <option value="">Choose an agent</option>
            {agents.map((a) => (
              <option key={a.key} value={a.key}>
                {a.name}
              </option>
            ))}
          </select>
          {versionSelect(from, setFrom, "From version")}
          {versionSelect(to, setTo, "To version")}
        </div>
        {compare.data ? (
          <div>
            <p className="mb-1 text-[12px] text-white/65">
              {compare.data.identical ? "These versions are identical." : `${compare.data.added} line${compare.data.added === 1 ? "" : "s"} added, ${compare.data.removed} removed, ${compare.data.unchanged} unchanged.`}
              {compare.data.truncated ? " Only the first 2000 lines were compared." : ""}
            </p>
            <pre className="max-h-72 overflow-auto rounded border border-white/10 p-2 text-[12px] leading-5">
              {compare.data.ops.map((o, i) => (
                <div key={i} className={o.type === "added" ? "bg-emerald-500/10 text-emerald-200" : o.type === "removed" ? "bg-red-500/10 text-red-200" : "text-white/60"}>
                  {o.type === "added" ? "+ " : o.type === "removed" ? "- " : "  "}
                  {o.text}
                </div>
              ))}
            </pre>
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-[12px] text-white/65">
            Draft text to preview (optional: leave empty to preview the chosen version)
            <textarea className="mt-1 h-28 w-full rounded border border-white/10 bg-transparent p-2 text-[12px]" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <label className="text-[12px] text-white/65">
            Sample values, one name=value per line, for placeholders such as {"{{customer_name}}"}
            <textarea className="mt-1 h-28 w-full rounded border border-white/10 bg-transparent p-2 text-[12px]" value={samplesText} onChange={(e) => setSamplesText(e.target.value)} />
          </label>
        </div>
        {preview.data ? (
          <div>
            <p className="mb-1 text-[12px] text-white/65">
              About {preview.data.estimatedTokens} tokens (an estimate).
              {preview.data.unresolved.length ? ` No sample value for: ${preview.data.unresolved.join(", ")}.` : ""}
              {preview.data.warnings.includes("very_long") ? " This prompt is very long." : ""}
              {preview.data.warnings.includes("unclosed_placeholder") ? " A placeholder looks unfinished." : ""}
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-white/10 p-2 text-[12px] leading-5">{preview.data.rendered}</pre>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Configuration() {
  const utils = trpc.useUtils();
  const history = trpc.adminOps.configHistory.useQuery({});
  const settings = trpc.admin.settings.useQuery();
  const update = trpc.admin.updateSetting.useMutation({ onSuccess: () => { utils.adminOps.configHistory.invalidate(); utils.admin.settings.invalidate(); } });
  const keys = (settings.data?.sections ?? []).map((s) => ({ value: s.key, label: `${s.title} (${s.key})` }));
  if (!keys.some((k) => k.value === "operations.maintenance_mode")) keys.push({ value: "operations.maintenance_mode", label: "Maintenance mode (operations.maintenance_mode)" });
  return (
    <>
      <BackupPolicyPanel />
      <FormCard
        title="Change a setting (super admin)"
        submitLabel="Apply change"
        successMessage="Setting applied and recorded in the history."
        fields={[
          { name: "key", label: "Setting", type: "select", required: true, options: keys },
          { name: "value", label: "New value", required: true, hint: 'The value is validated first. Maintenance mode accepts "on" or "off".' },
        ]}
        onSubmit={(v) => update.mutateAsync({ key: v.key, value: v.value })}
      />
      <Panel title="Configuration history (append only)">
        <DataTable
          columns={[
            { key: "createdAt", header: "When", render: (r: NonNullable<typeof history.data>[number]) => shortDateTime(r.createdAt) },
            { key: "settingKey", header: "Setting", render: (r: NonNullable<typeof history.data>[number]) => <span className="font-mono">{r.settingKey}</span> },
            { key: "oldValue", header: "From" },
            { key: "newValue", header: "To" },
            { key: "outcome", header: "Result", render: (r: NonNullable<typeof history.data>[number]) => <StatusPill tone={r.outcome === "applied" ? "ok" : "err"} label={r.outcome} /> },
            { key: "reason", header: "Reason" },
          ]}
          rows={history.data ?? []}
          emptyLabel="No configuration changes recorded yet."
        />
      </Panel>
    </>
  );
}

function Reports() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.scheduledReports.useQuery();
  const create = trpc.adminOps.createScheduledReport.useMutation({ onSuccess: () => utils.adminOps.scheduledReports.invalidate() });
  const toggle = trpc.adminOps.setScheduledReportEnabled.useMutation({ onSuccess: () => utils.adminOps.scheduledReports.invalidate() });
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "name", header: "Report" },
    { key: "reportKind", header: "Kind" },
    { key: "cadence", header: "Cadence" },
    { key: "nextRunAt", header: "Next run", render: (r) => shortDateTime(r.nextRunAt) },
    { key: "lastStatus", header: "Last result", render: (r) => (r.lastStatus ? <StatusPill tone={r.lastStatus === "sent" ? "ok" : "err"} label={r.lastStatus} /> : "n/a") },
    { key: "enabled", header: "", render: (r) => <SmallButton onClick={() => toggle.mutateAsync({ id: r.id, enabled: !r.enabled })}>{r.enabled ? "Pause" : "Resume"}</SmallButton> },
  ];
  return (
    <>
      <Panel title="Scheduled reports">
        <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No reports are scheduled." />
      </Panel>
      <FormCard
        title="Schedule a report"
        submitLabel="Schedule"
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "reportKind", label: "Report", type: "select", required: true, initial: "pipeline", options: ["pipeline", "billing", "delivery", "security"].map((v) => ({ value: v, label: v })) },
          { name: "cadence", label: "Cadence", type: "select", required: true, initial: "weekly", options: ["daily", "weekly", "monthly"].map((v) => ({ value: v, label: v })) },
          { name: "firstRunAt", label: "First run", type: "datetime-local", required: true },
          { name: "recipients", label: "Recipients", required: true, placeholder: "a@example.com, b@example.com", hint: "Comma separated email addresses." },
        ]}
        onSubmit={(v) =>
          create.mutateAsync({
            name: v.name,
            reportKind: v.reportKind as "pipeline",
            cadence: v.cadence as "weekly",
            firstRunAt: new Date(v.firstRunAt).getTime(),
            recipients: v.recipients.split(",").map((s) => s.trim()).filter(Boolean),
          })
        }
      />
    </>
  );
}
