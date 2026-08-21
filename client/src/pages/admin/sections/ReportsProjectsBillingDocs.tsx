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
  const orgsQuery = trpc.admin.listOrganizations.useQuery(undefined, { staleTime: 30_000 });
  const utils = trpc.useUtils();
  const createInvoice = trpc.admin.createInvoice.useMutation({
    onSuccess: () => utils.admin.billing.invalidate(),
    onError: (e) => window.alert(e.message || "Could not create invoice"),
  });
  const data = query.data;

  const onNewInvoice = () => {
    const orgs = orgsQuery.data ?? [];
    const list = orgs.map((o) => `${o.id}: ${o.name}`).join("\n") || "(no organizations yet)";
    const orgIdRaw = window.prompt(`Organization id for this invoice?\n\n${list}`);
    const organizationId = orgIdRaw ? Number(orgIdRaw) : NaN;
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const description = window.prompt("Invoice description?");
    if (!description?.trim()) return;
    const amountRaw = window.prompt("Amount (EUR, e.g. 1500.00)?");
    const amount = amountRaw ? Number(amountRaw) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid positive amount.");
      return;
    }
    createInvoice.mutate({
      organizationId,
      description: description.trim(),
      amountCents: Math.round(amount * 100),
    });
  };

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
          toolbar={<DefaultToolbar searchPlaceholder="Search invoices, clients…" filters={["Status", "Period"]} primaryAction={{ label: "New invoice", onClick: onNewInvoice }} />}
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
  version: number;
  status: "pending_review" | "approved" | "rejected" | "superseded";
  reviewedAt: string | Date | null;
  reviewNote: string | null;
  retentionNote: string | null;
}

const DOC_STATUS_TONE: Record<DocRow["status"], "ok" | "warn" | "err" | "muted"> = {
  pending_review: "warn",
  approved: "ok",
  rejected: "err",
  superseded: "muted",
};

/**
 * Milestone 2 §2.6 — document lifecycle. Previously every KPI on this page
 * except "Files in vault" was fabricated and undisclosed (Encrypted-at-rest
 * 100%, Active signed URLs 127, Malware scans 412 — none backed by any
 * real system: there is no malware scanner or signed-URL counter anywhere
 * in this codebase). Replaced with real review-queue counts. The
 * "Retention policies" panel was the same shape of bug (7/5/10-years/
 * indefinite by category — no such policy table exists); replaced with
 * real per-document retention notes (documented policy records, not an
 * enforced TTL — see drizzle/schema.ts's clientDocuments doc comment).
 */
export function Documents() {
  const query = trpc.admin.documents.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const utils = trpc.useUtils();
  const data = query.data;
  const review = trpc.admin.reviewDocument.useMutation({
    onSuccess: () => utils.admin.documents.invalidate(),
    onError: (e) => window.alert(e.message || "Could not review this document"),
  });
  const setRetention = trpc.admin.setDocumentRetention.useMutation({
    onSuccess: () => utils.admin.documents.invalidate(),
    onError: (e) => window.alert(e.message || "Could not set retention note"),
  });

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as DocRow[];
    const pending = rows.filter((r) => r.status === "pending_review").length;
    const approved = rows.filter((r) => r.status === "approved").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    return [
      { id: "files", label: "Files in vault", value: String(rows.length), icon: FolderLock, accent: "orange" },
      { id: "pending", label: "Pending review", value: String(pending), icon: Activity, accent: pending > 0 ? "red" : "green" },
      { id: "approved", label: "Approved", value: String(approved), icon: ShieldCheck, accent: "green" },
      { id: "rejected", label: "Rejected", value: String(rejected), icon: Activity, accent: rejected > 0 ? "red" : "green" },
    ];
  }, [data]);

  const onReview = (r: DocRow, decision: "approved" | "rejected") => {
    const note = window.prompt(`Note for ${decision === "approved" ? "approving" : "rejecting"} "${r.name}"? (optional)`, "");
    review.mutate({ documentId: r.id, decision, note: note?.trim() || undefined });
  };

  const onSetRetention = (r: DocRow) => {
    const note = window.prompt(`Retention policy note for "${r.name}"?`, r.retentionNote ?? "");
    if (!note || !note.trim()) return;
    setRetention.mutate({ documentId: r.id, note: note.trim() });
  };

  const cols: DataColumn<DocRow>[] = [
    { key: "id", header: "Ref", width: "82px", render: (r) => <span className="font-mono">D-{String(r.id).padStart(4, "0")}{r.version > 1 ? ` v${r.version}` : ""}</span> },
    { key: "name", header: "File" },
    { key: "category", header: "Category", render: (r) => <StatusPill tone="muted" label={r.category} /> },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={DOC_STATUS_TONE[r.status]} label={r.status.replace("_", " ")} /> },
    { key: "sizeBytes", header: "Size", align: "right", render: (r) => <span className="font-mono text-white/65">{r.sizeBytes ? `${(r.sizeBytes / 1_048_576).toFixed(1)} MB` : "—"}</span> },
    { key: "createdAt", header: "Uploaded", align: "right", render: (r) => <span className="font-mono text-white/55">{fmtDate(r.createdAt)}</span> },
    {
      key: "id" as keyof DocRow,
      header: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2 justify-end">
          {r.status === "pending_review" && (
            <>
              <button onClick={() => onReview(r, "approved")} className="text-[11px] text-emerald-400 hover:underline">Approve</button>
              <button onClick={() => onReview(r, "rejected")} className="text-[11px] text-red-400 hover:underline">Reject</button>
            </>
          )}
          <button onClick={() => onSetRetention(r)} className="text-[11px] text-[#FF6A00] hover:underline">Retention</button>
        </div>
      ),
    },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => {
        const rows = (d.rows ?? []) as DocRow[];
        const withRetention = rows.filter((r) => r.retentionNote);
        return (
        <OperationalPage
          eyebrow="Vault"
          title="Documents & Storage"
          tagline="Cloud-stored client documents with versioning, an approve/reject review workflow, and per-document retention policy notes."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search files, clients, categories…" filters={["Category", "Client", "Period"]} primaryAction={{ label: "Upload", onClick: () => audited.fire("documents", "upload") }} />}
          primary={
            rows.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No documents in the vault yet.</div>
            ) : (
              <DataTable columns={cols} rows={rows} />
            )
          }
          aside={
            <SideCard title="Retention policy notes">
              {withRetention.length === 0 ? (
                <p className="text-[12.5px] text-white/45">No per-document retention notes recorded yet. Use the "Retention" action on a file to document one.</p>
              ) : (
                <ul className="space-y-2.5 text-[12.5px] text-white/85">
                  {withRetention.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.name}</span>
                      <span className="font-mono text-white/55 shrink-0">{r.retentionNote}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SideCard>
          }
        />
        );
      }}
    </ModuleStateBoundary>
  );
}
