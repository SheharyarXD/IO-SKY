/*
 * IO SKY — Admin Portal · CRM & Leads.
 *
 * Wired to `trpc.admin.crm` for live data. Uses the shared
 * ModuleStateBoundary for loading / empty / error / forbidden states and
 * routes every interactive button through `useAuditedAction` so the
 * audit trail captures every operator gesture.
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
import { Users, ScanSearch, Target, Wallet, Sparkles, ArrowRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LeadRow {
  id: number;
  fullName: string;
  email: string;
  company: string | null;
  source: string;
  status: string;
  interest: string | null;
  createdAt: string | Date;
}

const stageTone = (s: string) =>
  s === "won" ? "ok" : s === "lost" ? "err" : s === "engaged" ? "info" : s === "qualified" ? "warn" : "muted";

function ageInDays(d: string | Date) {
  const ms = typeof d === "string" ? new Date(d).getTime() : d.getTime();
  return Math.max(0, Math.round((Date.now() - ms) / (24 * 3600 * 1000)));
}

export default function CrmLeads() {
  const query = trpc.admin.crm.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();

  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as LeadRow[];
    const last7 = rows.filter((r) => ageInDays(r.createdAt) <= 7);
    const qualified = rows.filter((r) => r.status === "qualified" || r.status === "engaged" || r.status === "won").length;
    const won = rows.filter((r) => r.status === "won").length;
    const conv = rows.length === 0 ? 0 : Math.round((won / rows.length) * 1000) / 10;
    return [
      {
        id: "new",
        label: "New leads (7d)",
        value: String(last7.length),
        icon: Users,
        accent: "orange",
      },
      {
        id: "qualified",
        label: "Qualified",
        value: String(qualified),
        icon: Target,
        accent: "blue",
      },
      {
        id: "conv",
        label: "Conversion",
        value: `${conv}%`,
        icon: ScanSearch,
        accent: "violet",
      },
      {
        id: "pipeline",
        label: "Total leads",
        value: String((data?.total ?? rows.length) || 0),
        icon: Wallet,
        accent: "green",
      },
    ];
  }, [data]);

  const COLUMNS: DataColumn<LeadRow>[] = [
    { key: "id", header: "Ref", width: "80px", render: (r) => <span className="font-mono">L-{r.id}</span> },
    { key: "fullName", header: "Lead" },
    { key: "company", header: "Company", render: (r) => r.company ?? "—" },
    { key: "source", header: "Source", render: (r) => <span className="font-mono text-[11.5px] text-white/75 uppercase">{r.source}</span> },
    { key: "status", header: "Stage", render: (r) => <StatusPill tone={stageTone(r.status) as any} label={r.status} /> },
    {
      key: "createdAt",
      header: "Age",
      align: "right",
      render: (r) => <span className="text-white/55">{ageInDays(r.createdAt)}d</span>,
    },
  ];

  return (
    <ModuleStateBoundary
      isLoading={query.isLoading}
      error={query.error as any}
      data={data}
      isEmpty={(d) => (d?.rows ?? []).length === 0 && d?.source === "db"}
      onRetry={() => query.refetch()}
    >
      {(d) => (
        <OperationalPage
          eyebrow="CRM module"
          title="CRM & Leads"
          tagline="Lead qualification queue powered by AI Scan signals, contact submissions and inbound discovery calls."
          kpis={kpis}
          toolbar={
            <DefaultToolbar
              searchPlaceholder="Search leads, companies, owners…"
              filters={["Stage", "Source", "Owner"]}
              primaryAction={{
                label: "New lead",
                onClick: () => audited.fire("crm", "open-new-lead"),
              }}
            />
          }
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">
                No leads yet. New AI Scan submissions and contact form replies will appear here.
              </div>
            ) : (
              <DataTable columns={COLUMNS} rows={(d.rows as unknown as LeadRow[])} />
            )
          }
          aside={
            <>
              <SideCard title="Top sources">
                {(() => {
                  const rows = (d.rows ?? []) as unknown as LeadRow[];
                  if (rows.length === 0) {
                    return <p className="text-[12px] text-white/55">No lead sources yet.</p>;
                  }
                  const counts = new Map<string, number>();
                  rows.forEach((r) => {
                    const key = (r.source || "other").replace(/_/g, " ");
                    counts.set(key, (counts.get(key) ?? 0) + 1);
                  });
                  const sorted = Array.from(counts.entries())
                    .map(([name, n]) => ({ name, pct: Math.round((n / rows.length) * 100) }))
                    .sort((a, b) => b.pct - a.pct)
                    .slice(0, 4);
                  return (
                    <ul className="space-y-2.5">
                      {sorted.map((s) => (
                        <li key={s.name} className="text-[12.5px]">
                          <div className="flex justify-between text-white/85">
                            <span className="capitalize">{s.name}</span>
                            <span className="font-mono text-white/65">{s.pct}%</span>
                          </div>
                          <div className="h-1.5 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-[#FF6A00] to-[#FF8E3D]" style={{ width: `${s.pct}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </SideCard>
              <SideCard title="AI Scan leads">
                {(() => {
                  const scanLeads = ((d.rows ?? []) as unknown as LeadRow[]).filter(
                    (r) => (r.interest ?? "").startsWith("ai-scan"),
                  );
                  if (scanLeads.length === 0) {
                    return (
                      <p className="text-[12px] text-white/55">
                        Leads created from AI Scan submissions will be highlighted here.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {scanLeads.slice(0, 4).map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
                            <span className="text-[12.5px] text-white/85">{c.company || c.fullName}</span>
                          </div>
                          <span className="font-mono text-[11px] text-white/60 uppercase">
                            {(c.interest ?? "").replace("ai-scan:", "")}
                          </span>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => audited.fire("crm", "open-ai-scan-pipeline")}
                        className="w-full mt-1 inline-flex items-center justify-between px-2.5 py-1.5 rounded-[8px] border border-white/[0.08] text-[11.5px] text-white/75 hover:bg-white/[0.04] transition-colors"
                      >
                        View AI Scan pipeline <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })()}
              </SideCard>
            </>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}
