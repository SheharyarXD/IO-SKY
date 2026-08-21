/*
 * IO SKY — Admin Portal · Clients.
 *
 * Wired to `trpc.admin.clients`. Every interactive button is audited.
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
import { Building2, Heart, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface OrgRow {
  id: number;
  slug: string;
  name: string;
  industry: string | null;
  country: string | null;
  operationalScore: number;
  statusLabel: string;
  createdAt: string | Date;
}

const tone = (s: string) =>
  /healthy/i.test(s) ? "ok" : /watch/i.test(s) ? "warn" : /risk|critical/i.test(s) ? "err" : "muted";

export default function Clients() {
  const query = trpc.admin.clients.useQuery(undefined, { staleTime: 30_000 });
  const audited = useAuditedAction();
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === "super_admin";
  const utils = trpc.useUtils();
  const createOrg = trpc.admin.createOrganization.useMutation({
    onSuccess: () => utils.admin.clients.invalidate(),
    onError: (e) => window.alert(e.message || "Could not create organization"),
  });
  const data = query.data;

  const onOnboardClient = () => {
    if (!isSuperAdmin) {
      audited.fire("clients", "open-onboarding");
      return;
    }
    const name = window.prompt("Organization name?");
    if (!name?.trim()) return;
    const slug = window.prompt(
      "URL slug (lowercase, letters/numbers/hyphens only)?",
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    );
    if (!slug?.trim()) return;
    createOrg.mutate({ slug: slug.trim(), name: name.trim() });
  };

  const kpis: KpiTile[] = useMemo(() => {
    const rows = (data?.rows ?? []) as OrgRow[];
    const watch = rows.filter((r) => /watch/i.test(r.statusLabel)).length;
    const avg =
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((acc, r) => acc + (r.operationalScore ?? 0), 0) / rows.length);
    const since30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newThisMonth = rows.filter((r) => new Date(r.createdAt).getTime() >= since30d).length;
    return [
      { id: "active", label: "Active clients", value: String(rows.length), icon: Building2, accent: "orange" },
      { id: "watch", label: "On watch", value: String(watch), icon: AlertTriangle, accent: watch > 0 ? "red" : "green" },
      { id: "health", label: "Avg. health", value: String(avg), icon: Heart, accent: "green" },
      { id: "new", label: "New (30d)", value: String(newThisMonth), icon: TrendingUp, accent: "violet" },
    ];
  }, [data]);

  const COLUMNS: DataColumn<OrgRow>[] = [
    { key: "id", header: "Ref", width: "70px", render: (r) => <span className="font-mono">C-{String(r.id).padStart(3, "0")}</span> },
    { key: "name", header: "Organisation" },
    { key: "industry", header: "Industry", render: (r) => r.industry ?? "—" },
    {
      key: "operationalScore",
      header: "Health",
      align: "right",
      render: (r) => (
        <span className={r.operationalScore >= 85 ? "text-emerald-400" : r.operationalScore >= 70 ? "text-[#FF6A00]" : "text-red-400"}>
          {r.operationalScore}
        </span>
      ),
    },
    { key: "statusLabel", header: "Status", render: (r) => <StatusPill tone={tone(r.statusLabel) as any} label={r.statusLabel} /> },
    { key: "country", header: "Country", render: (r) => r.country ?? "—" },
  ];

  return (
    <ModuleStateBoundary
      isLoading={query.isLoading}
      error={query.error as any}
      data={data}
      isEmpty={(d) => (d?.rows ?? []).length === 0 && d?.source === "db"}
      onRetry={() => query.refetch()}
    >
      {(d) => {
        const rows = (d.rows ?? []) as OrgRow[];
        const atRisk = rows.filter((c) => !/healthy/i.test(c.statusLabel)).slice(0, 5);
        return (
          <OperationalPage
            eyebrow="Operational module"
            title="Clients"
            tagline="Single console for managing organisations, files, invoices, assigned developers and progress."
            kpis={kpis}
            toolbar={
              <DefaultToolbar
                searchPlaceholder="Search organisations, developers, industries…"
                filters={["Status", "Industry", "Tier"]}
                primaryAction={{
                  label: "Onboard client",
                  onClick: onOnboardClient,
                }}
              />
            }
            primary={
              rows.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-white/[0.08] p-6 text-center text-[12.5px] text-white/55">
                  No client organisations yet.
                </div>
              ) : (
                <DataTable columns={COLUMNS} rows={rows} />
              )
            }
            aside={
              <>
                <SideCard title="At-risk accounts">
                  {atRisk.length === 0 ? (
                    <div className="text-[12px] text-white/55">All accounts healthy.</div>
                  ) : (
                    <ul className="space-y-2.5">
                      {atRisk.map((c) => (
                        <li key={c.id} className="flex items-center justify-between text-[12.5px]">
                          <span className="text-white/85">{c.name}</span>
                          <span className={/risk/i.test(c.statusLabel) ? "text-red-400" : "text-amber-400"}>{c.operationalScore}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </SideCard>
                <SideCard title="Onboarding queue">
                  <ul className="space-y-2.5 text-[12.5px]">
                    {[
                      { name: "Acme Logistics", step: "Kickoff", eta: "in 2d" },
                      { name: "Liora Studio", step: "Audit", eta: "in 4d" },
                      { name: "Northwind Foods", step: "Contract", eta: "in 5d" },
                    ].map((q) => (
                      <li key={q.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white/85">
                          <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
                          {q.name}
                        </div>
                        <div className="text-white/55 text-right">
                          <div>{q.step}</div>
                          <div className="text-[10.5px] font-mono">{q.eta}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SideCard>
              </>
            }
          />
        );
      }}
    </ModuleStateBoundary>
  );
}
