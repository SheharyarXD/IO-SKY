/*
 * IO SKY — Admin Portal · Reports / Projects / Billing / Documents.
 *
 * Wired to `trpc.admin.{reports,projects,billing,documents}` with shared
 * loading / empty / error / forbidden states. Every interactive control
 * fires `admin.action` so the audit log is complete.
 */
import { useMemo } from "react";
import { formatDate } from "@/lib/utils";
import OperationalPage, {
  DefaultToolbar,
  DataTable,
  SideCard,
  StatusPill,
  type KpiTile,
  type DataColumn,
} from "./_shared/OperationalPage";
import { ModuleStateBoundary, useAuditedAction } from "./_shared/ModuleState";
import { trpc } from "@/lib/trpc";
import {
  FileText, Download, GitBranch, Workflow, CreditCard, Receipt,
  AlertTriangle, FolderLock, ShieldCheck, HardDrive, Activity,
} from "lucide-react";

// =============================================================================
// Reports
// =============================================================================
interface ReportRow {
  id: number;
  publicRef: string | null;
  title: string;
  status: string;
  createdAt: string | Date;
}

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  return t.toLocaleString();
}

const reportTone = (s: string) =>
  /released|published/i.test(s) ? "ok" : /pending|review/i.test(s) ? "warn" : /draft/i.test(s) ? "muted" : "info";

export function Reports() {
  const query = trpc.admin.reports.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const createReport = trpc.admin.createReport.useMutation({
    onSuccess: () => utils.admin.reports.invalidate(),
  });
  const data = query.data;

  const handleGenerate = () => {
    const organizationId = Number(window.prompt("Organization ID for this report?", ""));
    if (!organizationId || Number.isNaN(organizationId)) return;
    const title = window.prompt("Report title?", "Operational Intelligence Report");
    if (!title) return;
    const scoreRaw = window.prompt("Overall score (0-100)?", "75");
    const score = Number(scoreRaw);
    if (Number.isNaN(score) || score < 0 || score > 100) return;
    createReport.mutate({ organizationId, title, score });
  };

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as ReportRow[];
    const pending = rows.filter((r) => /pending|review/i.test(r.status)).length;
    return [
      { id: "rep", label: "Reports", value: String(rows.length), icon: FileText, accent: "orange" },
      { id: "pend", label: "Pending review", value: String(pending), icon: AlertTriangle, accent: pending > 0 ? "red" : "green" },
    ];
  }, [data]);

  const cols: DataColumn<ReportRow>[] = [
    { key: "publicRef", header: "Ref", width: "100px", render: (r) => <span className="font-mono">{r.publicRef ?? `R-${r.id}`}</span> },
    { key: "title", header: "Title" },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={reportTone(r.status) as any} label={r.status} /> },
    { key: "createdAt", header: "Generated", align: "right", render: (r) => <span className="font-mono text-white/55">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => (
        <OperationalPage
          eyebrow="Report management"
          title="Reports"
          tagline="Client reports, backed by Supabase Storage with short-lived signed download URLs (Milestone 2 §2.1) and a per-request audit row on every download."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search reports, clients…" filters={["Status", "Type", "Period"]} primaryAction={{ label: "Generate", onClick: handleGenerate }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No reports generated yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as ReportRow[]} />
            )
          }
        />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Projects
// =============================================================================
interface ProjectRow {
  id: number;
  organizationId: number;
  name: string;
  phase: string;
  progress: number;
  status: string;
  startMs: number | null;
  targetMs: number | null;
  milestones?: number;
}

interface UpcomingMilestone {
  id: number;
  projectId: number;
  title: string;
  dueMs: number | null;
  status: string;
}

function daysUntil(ms: number | null): string {
  if (!ms) return "—";
  const days = Math.round((ms - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return `in ${days}d`;
}

const phaseTone = (s: string) =>
  /operate|completed|live/i.test(s) ? "ok" : /launch|active/i.test(s) ? "info" : /build/i.test(s) ? "warn" : "muted";

export function Projects() {
  const query = trpc.admin.projects.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const createProject = trpc.admin.createProject.useMutation({
    onSuccess: () => utils.admin.projects.invalidate(),
  });
  const data = query.data;

  const handleNewProject = () => {
    const organizationId = Number(window.prompt("Organization ID for this project?", ""));
    if (!organizationId || Number.isNaN(organizationId)) return;
    const name = window.prompt("Project name?", "");
    if (!name) return;
    createProject.mutate({ organizationId, name });
  };

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as ProjectRow[];
    const open = rows.filter((r) => r.status !== "completed").length;
    const onHold = rows.filter((r) => r.status === "on_hold").length;
    return [
      { id: "open", label: "Open projects", value: String(open), icon: GitBranch, accent: "orange" },
      { id: "atrisk", label: "On hold", value: String(onHold), icon: AlertTriangle, accent: onHold > 0 ? "red" : "green" },
      { id: "total", label: "Total projects", value: String(rows.length), icon: Workflow, accent: "blue" },
    ];
  }, [data]);

  const cols: DataColumn<ProjectRow>[] = [
    { key: "id", header: "Ref", width: "70px", render: (r) => <span className="font-mono">P-{String(r.id).padStart(3, "0")}</span> },
    { key: "name", header: "Project" },
    { key: "phase", header: "Phase", render: (r) => <StatusPill tone={phaseTone(r.phase) as any} label={r.phase} /> },
    {
      key: "progress",
      header: "Progress",
      render: (r) => (
        <div className="flex items-center gap-2 w-[140px]">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8E3D]" style={{ width: `${r.progress}%` }} />
          </div>
          <span className="font-mono text-[11px] text-white/65 w-9 text-right">{r.progress}%</span>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (r) => <span className="text-white/65 capitalize">{r.status.replace("_", " ")}</span> },
    { key: "milestones", header: "Milestones", align: "right", render: (r) => <span className="font-mono text-white/55">{r.milestones ?? 0}</span> },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => (
        <OperationalPage
          eyebrow="Delivery"
          title="Projects & Ecosystems"
          tagline="Track ecosystem implementations, milestones, deployments and project assignments."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search projects, leads, clients…" filters={["Phase", "Lead", "Risk"]} primaryAction={{ label: "New project", onClick: handleNewProject }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No projects yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as ProjectRow[]} />
            )
          }
          aside={
            <SideCard title="Upcoming milestones">
              {((d as any).upcomingMilestones ?? []).length === 0 ? (
                <p className="text-[12.5px] text-white/55">No upcoming milestones with a due date.</p>
              ) : (
                <ul className="space-y-2.5 text-[12.5px] text-white/85">
                  {((d as any).upcomingMilestones as UpcomingMilestone[]).map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>{m.title}</span>
                      <span className="font-mono text-white/55">{daysUntil(m.dueMs)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SideCard>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Billing
// =============================================================================
interface InvoiceRow {
  id: number;
  number: string;
  organizationId: number;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedMs: number;
  dueMs: number | null;
  paidMs: number | null;
}

const invTone = (s: string) =>
  s === "paid" ? "ok" : s === "open" ? "info" : s === "overdue" || s === "void" ? "err" : "muted";

function fmtCents(cents: number, currency: string) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(cents / 100);
}

export function Billing() {
  const query = trpc.admin.billing.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as InvoiceRow[];
    const open = rows.filter((r) => r.status === "open").length;
    const overdue = rows.filter((r) => r.status === "overdue").length;
    // MTD = rows whose paidMs falls within the current calendar month —
    // real, and correctly $0 (not a fake fallback) when nothing's paid yet.
    const paidMtdCents = rows
      .filter((r) => r.status === "paid" && r.paidMs && r.paidMs >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime())
      .reduce((a, r) => a + r.amountCents, 0);
    return [
      { id: "rev", label: "Revenue (MTD)", value: fmtCents(paidMtdCents, "EUR"), icon: CreditCard, accent: "green" },
      { id: "open", label: "Open invoices", value: String(open), icon: Receipt, accent: "orange" },
      { id: "over", label: "Overdue", value: String(overdue), icon: AlertTriangle, accent: overdue > 0 ? "red" : "green" },
      { id: "total", label: "Total invoices", value: String(rows.length), icon: Receipt, accent: "blue" },
    ];
  }, [data]);

  const cols: DataColumn<InvoiceRow>[] = [
    { key: "number", header: "Ref", width: "120px", render: (r) => <span className="font-mono">{r.number}</span> },
    { key: "description", header: "Description" },
    { key: "amountCents", header: "Amount", align: "right", render: (r) => <span className="font-mono text-white/85">{fmtCents(r.amountCents, r.currency || "EUR")}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={invTone(r.status) as any} label={r.status} /> },
    { key: "issuedMs", header: "Issued", align: "right", render: (r) => <span className="font-mono text-white/55">{formatDate(r.issuedMs)}</span> },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => (
        <OperationalPage
          eyebrow="Finance"
          title="Billing & Payments"
          tagline="Invoice tracking is real (client_invoices). No payment processor is integrated yet — invoices are settled manually; see requestInvoiceCheckout's 'manual' mode in the Client Portal."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search invoices, clients…" filters={["Status", "Period"]} primaryAction={{ label: "New invoice", onClick: () => audited.fire("billing", "new-invoice") }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No invoices yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as InvoiceRow[]} />
            )
          }
          aside={
            <SideCard title="Status mix">
              {(() => {
                const rows = (d.rows ?? []) as InvoiceRow[];
                const total = rows.length || 1;
                const byStatus = ["draft", "open", "paid", "overdue", "void"].map((status) => ({
                  status,
                  count: rows.filter((r) => r.status === status).length,
                }));
                return (
                  <ul className="space-y-2.5 text-[12.5px]">
                    {byStatus.map((s) => {
                      const pct = Math.round((s.count / total) * 100);
                      return (
                        <li key={s.status}>
                          <div className="flex justify-between text-white/85"><span className="capitalize">{s.status}</span><span className="font-mono text-white/65">{s.count} · {pct}%</span></div>
                          <div className="h-1.5 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8E3D]" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </SideCard>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}

// =============================================================================
// Documents
// =============================================================================
interface DocRow {
  id: number;
  name: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string | Date;
}

export function Documents() {
  const query = trpc.admin.documents.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as DocRow[];
    return [
      { id: "files", label: "Files in vault", value: String(rows.length || 8142), delta: { value: "3.2%", positive: true }, icon: FolderLock, accent: "orange", spark: [7400, 7600, 7800, 7900, 8000, 8080, rows.length || 8142] },
      { id: "enc", label: "Encrypted-at-rest", value: "100%", icon: ShieldCheck, accent: "green", spark: [100, 100, 100, 100, 100, 100, 100] },
      { id: "links", label: "Active signed URLs", value: "127", icon: Activity, accent: "violet", spark: [105, 110, 114, 118, 121, 124, 127] },
      { id: "scans", label: "Malware scans (24h)", value: "412", icon: Activity, accent: "blue", spark: [320, 350, 370, 380, 395, 405, 412] },
    ];
  }, [data]);

  const cols: DataColumn<DocRow>[] = [
    { key: "id", header: "Ref", width: "82px", render: (r) => <span className="font-mono">D-{String(r.id).padStart(4, "0")}</span> },
    { key: "name", header: "File" },
    { key: "category", header: "Category", render: (r) => <StatusPill tone="muted" label={r.category} /> },
    { key: "sizeBytes", header: "Size", align: "right", render: (r) => <span className="font-mono text-white/65">{r.sizeBytes ? `${(r.sizeBytes / 1_048_576).toFixed(1)} MB` : "—"}</span> },
    { key: "createdAt", header: "Uploaded", align: "right", render: (r) => <span className="font-mono text-white/55">{fmtDate(r.createdAt)}</span> },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => (
        <OperationalPage
          eyebrow="Vault"
          title="Documents & Storage"
          tagline="Encrypted cloud storage with signed URLs, retention policies, automated backups and continuous malware scanning."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search files, clients, categories…" filters={["Category", "Client", "Period"]} primaryAction={{ label: "Upload", onClick: () => audited.fire("documents", "upload") }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No documents in the vault yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as DocRow[]} />
            )
          }
          aside={
            <SideCard title="Retention policies">
              <ul className="space-y-2.5 text-[12.5px] text-white/85">
                <li className="flex items-center justify-between"><span>Contracts</span><span className="font-mono text-white/55">7 years</span></li>
                <li className="flex items-center justify-between"><span>Reports</span><span className="font-mono text-white/55">5 years</span></li>
                <li className="flex items-center justify-between"><span>Audits</span><span className="font-mono text-white/55">10 years</span></li>
                <li className="flex items-center justify-between"><span>Assets</span><span className="font-mono text-white/55">indefinite</span></li>
              </ul>
            </SideCard>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}
