/*
 * IO SKY — Admin Portal · AI Scans (live).
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
import { ScanSearch, Cpu, Activity, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ScanRow {
  id: string;
  target: string;
  operator: string;
  score: number;
  status: string;
  durationSec: number;
  createdAtMs: number;
}

const tone = (s: string) =>
  s === "completed" ? "ok" : s === "in_progress" ? "info" : s === "review" ? "warn" : "muted";

function relTime(ms: number) {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function AiScans() {
  const query = trpc.admin.aiScans.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const data = query.data;

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as ScanRow[];
    const running = rows.filter((r) => r.status === "in_progress").length;
    const completed = rows.filter((r) => r.status === "completed");
    const avg = completed.length === 0 ? 0 : Math.round(completed.reduce((a, r) => a + r.score, 0) / completed.length);
    const timed = completed.filter((r) => r.durationSec > 0);
    const avgRt = timed.length === 0 ? 0 : Math.round(timed.reduce((a, r) => a + r.durationSec, 0) / timed.length);
    return [
      { id: "total", label: "Total scans", value: String(rows.length), icon: ScanSearch, accent: "orange" },
      { id: "running", label: "Running now", value: String(running), icon: Activity, accent: "blue" },
      { id: "score", label: "Avg. score", value: avg ? String(avg) : "—", icon: Cpu, accent: "violet" },
      { id: "rt", label: "Avg. runtime", value: avgRt ? `${Math.floor(avgRt / 60)}m ${avgRt % 60}s` : "—", icon: Clock, accent: "green" },
    ];
  }, [data]);

  const COLUMNS: DataColumn<ScanRow>[] = [
    { key: "id", header: "Ref", width: "82px", render: (r) => <span className="font-mono">{r.id}</span> },
    { key: "target", header: "Organisation" },
    { key: "operator", header: "Operator" },
    { key: "score", header: "Score", align: "right", render: (r) => (
      <span className={r.score >= 85 ? "text-emerald-400" : r.score >= 70 ? "text-[#FF6A00]" : "text-red-400"}>{r.score}</span>
    )},
    { key: "status", header: "Status", render: (r) => <StatusPill tone={tone(r.status) as any} label={r.status.replace("_", " ")} /> },
    { key: "createdAtMs", header: "Started", align: "right", render: (r) => <span className="font-mono text-white/55">{relTime(r.createdAtMs)}</span> },
  ];

  return (
    <ModuleStateBoundary
      isLoading={query.isLoading}
      error={query.error as any}
      data={data}
      onRetry={() => query.refetch()}
    >
      {(d) => (
        <OperationalPage
          eyebrow="AI engine"
          title="AI Scans"
          tagline="Live operational view across the AI Scan engine — sessions, scoring, top recommendations and report-release pipeline."
          kpis={kpis}
          toolbar={
            <DefaultToolbar
              searchPlaceholder="Search scans, organisations…"
              filters={["Type", "Status", "Score"]}
              primaryAction={{ label: "Trigger scan", onClick: () => audited.fire("ai-scans", "trigger-scan") }}
            />
          }
          primary={
            (d.rows ?? []).length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">
                No AI Scans yet. Completed questionnaire submissions from the public funnel will appear here with their maturity scores.
              </div>
            ) : (
              <DataTable columns={COLUMNS} rows={d.rows as ScanRow[]} />
            )
          }
          aside={
            <>
              <SideCard title="Dimensions scored">
                <ul className="space-y-2 text-[12.5px] text-white/80">
                  <li>Operational maturity</li>
                  <li>Automation readiness</li>
                  <li>Infrastructure maturity</li>
                  <li>Scalability readiness</li>
                  <li>AI opportunity potential</li>
                </ul>
              </SideCard>
              <SideCard title="Scan tiers">
                <div className="text-[12.5px] text-white/85 space-y-2">
                  <div className="flex justify-between"><span>Free</span><span className="font-mono text-white/65">7 questions</span></div>
                  <div className="flex justify-between"><span>Growth</span><span className="font-mono text-white/65">18 questions</span></div>
                  <div className="flex justify-between"><span>Elite</span><span className="font-mono text-white/65">35 questions</span></div>
                </div>
              </SideCard>
            </>
          }
        />
      )}
    </ModuleStateBoundary>
  );
}
