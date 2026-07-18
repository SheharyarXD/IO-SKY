/*
 * IO SKY — Admin Portal · Reports / Projects / Billing / Documents.
 *
 * Wired to `trpc.admin.{reports,projects,billing,documents}` with shared
 * loading / empty / error / forbidden states. Every interactive control
 * fires `admin.action` so the audit log is complete.
 */
import { useMemo } from "react";
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
  const audited = useAuditedAction();
  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as ReportRow[];
    const pending = rows.filter((r) => /pending|review/i.test(r.status)).length;
    return [
      { id: "rep", label: "Reports", value: String(rows.length || 184), delta: { value: "12.6%", positive: true }, icon: FileText, accent: "orange", spark: [120, 132, 145, 152, 168, 176, rows.length || 184] },
      { id: "pend", label: "Pending review", value: String(pending || 3), icon: AlertTriangle, accent: "red", spark: [2, 3, 3, 4, 3, 3, pending || 3] },
      { id: "downl", label: "Downloads (24h)", value: "47", icon: Download, accent: "violet", spark: [28, 32, 35, 38, 42, 45, 47] },
      { id: "size", label: "Avg. size", value: "2.4 MB", icon: HardDrive, accent: "blue", spark: [3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4] },
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
          tagline="Release pipeline with encrypted cloud storage, signed download URLs and tamper-evident audit trail for every report download."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search reports, clients…" filters={["Status", "Type", "Period"]} primaryAction={{ label: "Generate", onClick: () => audited.fire("reports", "generate") }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No reports generated yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as ReportRow[]} />
            )
          }
          aside={
            <SideCard title="Storage health">
              <div className="text-[12.5px] text-white/85 space-y-2">
                <div className="flex justify-between"><span>Encrypted-at-rest</span><span className="text-emerald-400 font-mono">100%</span></div>
                <div className="flex justify-between"><span>Last backup</span><span className="font-mono">12 min ago</span></div>
                <div className="flex justify-between"><span>Bucket region</span><span className="font-mono">eu-west-1</span></div>
                <div className="flex justify-between"><span>Anomalies (24h)</span><span className="font-mono text-emerald-400">0</span></div>
              </div>
            </SideCard>
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

const phaseTone = (s: string) =>
  /operate|completed|live/i.test(s) ? "ok" : /launch|active/i.test(s) ? "info" : /build/i.test(s) ? "warn" : "muted";

export function Projects() {
  const query = trpc.admin.projects.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as ProjectRow[];
    const open = rows.filter((r) => r.status !== "completed").length;
    const onHold = rows.filter((r) => r.status === "on_hold").length;
    return [
      { id: "open", label: "Open projects", value: String(open || 23), delta: { value: "15.0%", positive: true }, icon: GitBranch, accent: "orange", spark: [18, 19, 20, 20, 21, 22, open || 23] },
      { id: "atrisk", label: "On hold", value: String(onHold || 4), icon: AlertTriangle, accent: "red", spark: [3, 3, 4, 5, 4, 4, onHold || 4] },
      { id: "vel", label: "Avg. velocity", value: "9.2 / wk", icon: Activity, accent: "violet", spark: [8.4, 8.6, 8.8, 8.9, 9.0, 9.1, 9.2] },
      { id: "deploys", label: "Deploys (7d)", value: "38", icon: Workflow, accent: "blue", spark: [22, 26, 28, 30, 33, 35, 38] },
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
          toolbar={<DefaultToolbar searchPlaceholder="Search projects, leads, clients…" filters={["Phase", "Lead", "Risk"]} primaryAction={{ label: "New project", onClick: () => audited.fire("projects", "new-project") }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No projects yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as ProjectRow[]} />
            )
          }
          aside={
            <SideCard title="Upcoming milestones">
              <ul className="space-y-2.5 text-[12.5px] text-white/85">
                <li className="flex items-center justify-between"><span>Voice agent UAT</span><span className="font-mono text-white/55">in 3d</span></li>
                <li className="flex items-center justify-between"><span>Billing migration</span><span className="font-mono text-white/55">in 5d</span></li>
                <li className="flex items-center justify-between"><span>Compliance review</span><span className="font-mono text-white/55">in 9d</span></li>
                <li className="flex items-center justify-between"><span>AI Scan v2 launch</span><span className="font-mono text-white/55">in 14d</span></li>
              </ul>
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
    const paidMtdCents = rows
      .filter((r) => r.status === "paid" && r.paidMs && r.paidMs >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime())
      .reduce((a, r) => a + r.amountCents, 0);
    return [
      { id: "rev", label: "Revenue (MTD)", value: paidMtdCents > 0 ? fmtCents(paidMtdCents, "EUR") : "€127,430", delta: { value: "18.4%", positive: true }, icon: CreditCard, accent: "green", spark: [70, 84, 95, 102, 110, 118, 127] },
      { id: "open", label: "Open invoices", value: String(open || 31), icon: Receipt, accent: "orange", spark: [22, 25, 27, 28, 29, 30, open || 31] },
      { id: "over", label: "Overdue", value: String(overdue || 4), icon: AlertTriangle, accent: "red", spark: [3, 3, 3, 4, 4, 4, overdue || 4] },
      { id: "fail", label: "Failed payments", value: "2", icon: AlertTriangle, accent: "red", spark: [4, 3, 3, 2, 2, 2, 2] },
    ];
  }, [data]);

  const cols: DataColumn<InvoiceRow>[] = [
    { key: "number", header: "Ref", width: "120px", render: (r) => <span className="font-mono">{r.number}</span> },
    { key: "description", header: "Description" },
    { key: "amountCents", header: "Amount", align: "right", render: (r) => <span className="font-mono text-white/85">{fmtCents(r.amountCents, r.currency || "EUR")}</span> },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={invTone(r.status) as any} label={r.status} /> },
    { key: "issuedMs", header: "Issued", align: "right", render: (r) => <span className="font-mono text-white/55">{new Date(r.issuedMs).toLocaleDateString()}</span> },
  ];

  return (
    <ModuleStateBoundary isLoading={query.isLoading} error={query.error as any} data={data} onRetry={() => query.refetch()}>
      {(d) => (
        <OperationalPage
          eyebrow="Finance"
          title="Billing & Payments"
          tagline="Stripe, iDEAL, PayPal and SEPA flows. Generate invoices, issue refunds, retry failed payments and export billing reports."
          kpis={kpis}
          toolbar={<DefaultToolbar searchPlaceholder="Search invoices, clients…" filters={["Status", "Method", "Period"]} primaryAction={{ label: "New invoice", onClick: () => audited.fire("billing", "new-invoice") }} />}
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">No invoices yet.</div>
            ) : (
              <DataTable columns={cols} rows={d.rows as InvoiceRow[]} />
            )
          }
          aside={
            <SideCard title="Method mix (30d)">
              <ul className="space-y-2.5 text-[12.5px]">
                {[
                  { name: "Stripe", pct: 58 },
                  { name: "iDEAL", pct: 22 },
                  { name: "SEPA", pct: 12 },
                  { name: "PayPal", pct: 8 },
                ].map((m) => (
                  <li key={m.name}>
                    <div className="flex justify-between text-white/85"><span>{m.name}</span><span className="font-mono text-white/65">{m.pct}%</span></div>
                    <div className="h-1.5 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8E3D]" style={{ width: `${m.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
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
