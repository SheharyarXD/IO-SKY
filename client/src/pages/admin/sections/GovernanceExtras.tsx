/*
 * IO SKY — Admin Portal · Governance tabs for audit search and platform health
 * (SRS 13.9, 16.12, 18.12, 25.11).
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DataTable, StatusPill } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, shortDateTime } from "./_shared/Forms";

type Outcome = "success" | "failed" | "blocked" | "mfa_required";

export function AuditSearch() {
  const [filters, setFilters] = useState<{ q?: string; outcome?: Outcome; fromMs?: number; toMs?: number }>({});
  const [page, setPage] = useState(0);
  const PAGE = 50;
  const q = trpc.adminOps.auditSearch.useQuery({ ...filters, limit: PAGE, offset: page * PAGE });
  const exportCsv = trpc.adminOps.auditExport.useMutation();
  const [docQ, setDocQ] = useState("");
  const docRes = trpc.adminOps.searchDocuments.useQuery({ q: docQ }, { enabled: docQ.trim().length >= 2 });

  const download = async () => {
    try {
      const r = await exportCsv.mutateAsync(filters);
      const blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(r.truncated ? `Exported the newest ${r.rows} rows (the export is capped).` : `Exported ${r.rows} rows.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  type Row = NonNullable<typeof q.data>["rows"][number];
  type DocRow = NonNullable<typeof docRes.data>[number];
  const total = q.data?.total ?? 0;
  return (
    <>
      <FormCard
        title="Search the audit log"
        submitLabel="Search"
        successMessage="Filters applied."
        columns={3}
        fields={[
          { name: "q", label: "Text", placeholder: "email, reason or IP" },
          { name: "outcome", label: "Outcome", type: "select", options: ["success", "failed", "blocked", "mfa_required"].map((v) => ({ value: v, label: v })) },
          { name: "fromDate", label: "From", type: "date" },
          { name: "toDate", label: "To", type: "date" },
        ]}
        onSubmit={async (v) => {
          setPage(0);
          setFilters({
            q: v.q || undefined,
            outcome: (v.outcome || undefined) as Outcome | undefined,
            fromMs: v.fromDate ? new Date(`${v.fromDate}T00:00:00`).getTime() : undefined,
            toMs: v.toDate ? new Date(`${v.toDate}T23:59:59`).getTime() : undefined,
          });
        }}
      />
      <Panel title={`Audit log, ${total} matching`} action={<SmallButton onClick={download}>Export CSV</SmallButton>}>
        <DataTable
          columns={[
            { key: "createdAt", header: "When", render: (r: Row) => shortDateTime(r.createdAt) },
            { key: "provider", header: "Source" },
            { key: "identifier", header: "Who" },
            { key: "outcome", header: "Outcome", render: (r: Row) => <StatusPill tone={r.outcome === "success" ? "ok" : r.outcome === "blocked" ? "err" : "warn"} label={r.outcome} /> },
            { key: "reason", header: "Detail" },
            { key: "ip", header: "IP", render: (r: Row) => <span className="font-mono text-white/60">{r.ip ?? "n/a"}</span> },
          ]}
          rows={q.data?.rows ?? []}
          emptyLabel="No audit rows match."
        />
        <div className="mt-3 flex items-center gap-2 text-[12px] text-white/55">
          <SmallButton disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</SmallButton>
          <span>Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE))}</span>
          <SmallButton disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next</SmallButton>
        </div>
      </Panel>
      <FormCard
        title="Search documents across all clients"
        submitLabel="Search"
        successMessage="Searched."
        columns={1}
        fields={[{ name: "q", label: "Name, category or uploader", required: true, hint: "At least two characters." }]}
        onSubmit={async (v) => setDocQ(v.q)}
      />
      {docQ.trim().length >= 2 ? (
        <Panel title="Document results">
          <DataTable
            columns={[
              { key: "name", header: "Document" },
              { key: "organizationId", header: "Org", render: (r: DocRow) => `#${r.organizationId}` },
              { key: "category", header: "Category" },
              { key: "version", header: "Version", render: (r: DocRow) => `v${r.version}` },
              { key: "status", header: "Status" },
            ]}
            rows={docRes.data ?? []}
            emptyLabel="No documents match."
          />
        </Panel>
      ) : null}
    </>
  );
}

function KeyValues({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-[10px] border border-white/[0.06] px-3 py-2">
          <dt className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/50">{k}</dt>
          <dd className="mt-1 text-[13px] text-white/90">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Health() {
  const q = trpc.adminOps.platformHealth.useQuery(undefined, { refetchInterval: 30_000 });
  const h = q.data;
  if (!h) return <div className="text-[12.5px] text-white/55">{q.isLoading ? "Loading…" : "Health data is unavailable."}</div>;
  type Hook = (typeof h.integrations.webhooks)[number];
  const hours = Math.floor(h.capacity.uptimeSeconds / 3600);
  const minutes = Math.floor((h.capacity.uptimeSeconds % 3600) / 60);
  return (
    <>
      <Panel title="Release">
        <KeyValues
          rows={[
            ["Commit", h.release.commit ? h.release.commit.slice(0, 10) : "not provided by the host"],
            ["Environment", h.release.environment],
            ["Process started", shortDateTime(h.release.startedAt)],
            ["Node", h.release.nodeVersion],
          ]}
        />
      </Panel>
      <Panel title="Capacity">
        <KeyValues
          rows={[
            ["Uptime", `${hours}h ${minutes}m`],
            ["Memory (resident)", `${h.capacity.rssMb} MB`],
            ["Heap used", `${h.capacity.heapUsedMb} of ${h.capacity.heapTotalMb} MB`],
            ["Database size", h.capacity.databaseSizeMb === null ? "not readable" : `${h.capacity.databaseSizeMb} MB`],
            ...Object.entries(h.capacity.tableRows).map(([t, n]): [string, string] => [`Rows in ${t}`, n.toLocaleString()]),
          ]}
        />
      </Panel>
      <Panel title="Integrations">
        <ul className="space-y-1.5 text-[13px]">
          {h.integrations.providers.map((p) => (
            <li key={p.name} className="flex items-center justify-between">
              <span>{p.name}</span>
              <StatusPill tone={p.configured ? "ok" : "muted"} label={p.configured ? "configured" : "not configured"} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] text-white/65">
          Email in the last 24 hours: {h.integrations.email24h.sent} sent, {h.integrations.email24h.failed} failed.
        </p>
        <div className="mt-3">
          <DataTable
            columns={[
              { key: "name", header: "Webhook" },
              { key: "enabled", header: "State", render: (r: Hook) => <StatusPill tone={r.enabled ? "ok" : "muted"} label={r.enabled ? "on" : "off"} /> },
              { key: "attempts24h", header: "Attempts, 24h", align: "right" },
              { key: "failures24h", header: "Failures", align: "right", render: (r: Hook) => <span className={r.failures24h > 0 ? "text-red-300" : ""}>{r.failures24h}</span> },
              { key: "lastSuccessAt", header: "Last success", render: (r: Hook) => shortDateTime(r.lastSuccessAt) },
            ]}
            rows={h.integrations.webhooks}
            emptyLabel="No webhooks registered."
          />
        </div>
      </Panel>
      <Panel title="Open incidents">
        <KeyValues rows={[["Security", String(h.openIncidents.security)], ["Operational", String(h.openIncidents.operational)]]} />
      </Panel>
    </>
  );
}
