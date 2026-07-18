import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Download, Eye, Loader2, ScanSearch, TrendingDown, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "../components/PortalUI";

/**
 * IO SKY — Client Portal · AI Scans
 * Timeline of every AI Scan run against this organization. Each entry shows
 * score, delta vs. previous, status, and a signed-URL "View Report" action.
 */
export default function ClientAIScan() {
  const reports = trpc.clientPortal.reports.useQuery();
  const requestUrl = trpc.clientPortal.requestReportSignedUrl.useMutation();
  const [openingId, setOpeningId] = useState<number | null>(null);

  // Filter reports down to AI Scan rows only. We sort by createdAt asc for the
  // sparkline (oldest -> newest) and keep a separate desc view for the table.
  const scans = useMemo(() => {
    return (reports.data ?? []).filter(r => r.scanType === "ai-scan");
  }, [reports.data]);

  const sortedAsc = useMemo(() => {
    return [...scans].sort(
      (a, b) =>
        new Date(a.createdAt as unknown as string).getTime() -
        new Date(b.createdAt as unknown as string).getTime(),
    );
  }, [scans]);

  // Build a tiny inline sparkline path (no external chart lib needed).
  const sparkline = useMemo(() => {
    if (sortedAsc.length < 2) return null;
    const w = 320;
    const h = 60;
    const min = Math.min(...sortedAsc.map(s => s.score));
    const max = Math.max(...sortedAsc.map(s => s.score));
    const range = Math.max(1, max - min);
    const stepX = w / (sortedAsc.length - 1);
    const points = sortedAsc.map((s, i) => {
      const x = i * stepX;
      const y = h - ((s.score - min) / range) * (h - 8) - 4;
      return [x, y] as const;
    });
    const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return { d, w, h, latestY: points[points.length - 1][1], latestX: points[points.length - 1][0] };
  }, [sortedAsc]);

  const latest = scans[0];

  const handleView = async (id: number, ref: string) => {
    setOpeningId(id);
    try {
      const out = await requestUrl.mutateAsync({ id });
      window.open(out.url, "_blank", "noopener,noreferrer");
      toast.success("Report opened", { description: `${ref} — link valid 10 min.` });
    } catch (err) {
      toast.error("Could not open report", {
        description: err instanceof Error ? err.message : "Try again later.",
      });
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <>
      <SectionHeader
        eyebrow="AI Scan"
        title="AI Scan history"
        description="Every operational scan run against your environment, with a tracked score over time. New scans automatically appear here."
        action={
          <Link href="/ai-scan">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              <ScanSearch className="h-4 w-4 mr-2" />
              Run new scan
            </Button>
          </Link>
        }
      />

      {/* Score-over-time pane: collapses into the SectionStateSwitch on first load */}
      {!reports.isLoading && scans.length > 1 && sparkline && (
        <GlassCard className="p-5 mb-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Operational Score</p>
              <p className="mt-1 font-display text-3xl text-white">
                {latest?.score}
                <span className="text-base text-white/40">/100</span>
              </p>
              {latest && (
                <p className="mt-1 text-xs flex items-center gap-1.5">
                  {latest.delta > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                  ) : latest.delta < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
                  ) : null}
                  <span
                    className={
                      latest.delta > 0
                        ? "text-emerald-300"
                        : latest.delta < 0
                          ? "text-rose-300"
                          : "text-white/55"
                    }
                  >
                    {latest.delta > 0 ? "+" : ""}
                    {latest.delta} vs previous scan
                  </span>
                </p>
              )}
            </div>
            <svg
              viewBox={`0 0 ${sparkline.w} ${sparkline.h}`}
              className="h-16 w-72"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <linearGradient id="iosky-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(251,146,60,0.45)" />
                  <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                </linearGradient>
              </defs>
              <path
                d={`${sparkline.d} L${sparkline.w},${sparkline.h} L0,${sparkline.h} Z`}
                fill="url(#iosky-spark-fill)"
              />
              <path d={sparkline.d} stroke="#fb923c" strokeWidth="2" fill="none" />
              <circle cx={sparkline.latestX} cy={sparkline.latestY} r="3.5" fill="#fb923c" />
            </svg>
          </div>
        </GlassCard>
      )}

      <SectionStateSwitch
        loading={reports.isLoading}
        error={reports.error}
        onRetry={() => reports.refetch()}
        data={scans}
        isEmpty={d => d.length === 0}
        emptyIcon={<ScanSearch className="h-5 w-5" />}
        emptyTitle="No scans on record"
        emptyBody="Run your first AI Scan to baseline your operational health and unlock trended scoring."
        emptyAction={
          <Link href="/ai-scan">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              Start AI Scan
            </Button>
          </Link>
        }
        skeletonRows={4}
      />

      {!reports.isLoading && !reports.error && scans.length > 0 && (
        <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.18em] text-white/45">
                  <tr>
                    <th className="px-5 py-3 text-left">Reference</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-right">Score</th>
                    <th className="px-5 py-3 text-right">Delta</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {scans.map(r => (
                    <tr key={r.id} className="hover:bg-orange-500/[0.04] transition-colors">
                      <td className="px-5 py-3 text-orange-200 font-mono text-xs">{r.publicRef}</td>
                      <td className="px-5 py-3 text-white/80">
                        {new Date(r.createdAt as unknown as string).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-mono">{r.score}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={
                            r.delta > 0
                              ? "text-emerald-300"
                              : r.delta < 0
                                ? "text-rose-300"
                                : "text-white/55"
                          }
                        >
                          {r.delta > 0 ? "+" : ""}
                          {r.delta}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          status={r.status}
                          variant={r.status === "delivered" ? "good" : "info"}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/10 bg-white/[0.04] hover:bg-orange-500/10 hover:border-orange-500/30 text-white"
                          disabled={!r.pdfKey || openingId === r.id}
                          onClick={() => handleView(r.id, r.publicRef)}
                        >
                          {openingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : r.pdfKey ? (
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                          ) : (
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {r.pdfKey ? "View report" : "Awaiting"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
      </GlassCard>
      )}
    </>
  );
}
