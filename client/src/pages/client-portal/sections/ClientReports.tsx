import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Download, FileText, ScanSearch, Search, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "../components/PortalUI";

/**
 * IO SKY — Client Portal · Reports
 * Encrypted, audit-logged report library.
 *
 * State coverage:
 *   - loading   → SectionStateSwitch renders PortalSkeleton
 *   - error     → SectionStateSwitch renders ErrorState with retry
 *   - empty     → SectionStateSwitch renders EmptyState w/ CTA to AI Scan
 *   - permission denied → handled by ClientPortal shell at the route level
 *
 * Every download goes through `requestReportSignedUrl` which:
 *   1) verifies the report belongs to ctx.organizationId (tenant scoped)
 *   2) returns a short-lived signed URL
 *   3) writes a `report-download:{publicRef}` row into login_audit
 *   4) notifies IO SKY ops (best effort)
 */
export default function ClientReports() {
  const reports = trpc.clientPortal.reports.useQuery();
  const requestUrl = trpc.clientPortal.requestReportSignedUrl.useMutation();
  const [query, setQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const list = reports.data ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.publicRef.toLowerCase().includes(q) ||
        (r.summary?.toLowerCase().includes(q) ?? false),
    );
  }, [reports.data, query]);

  const handleDownload = async (reportId: number, title: string) => {
    setDownloadingId(reportId);
    try {
      const res = await requestUrl.mutateAsync({ id: reportId });
      window.open(res.url, "_blank", "noopener,noreferrer");
      toast.success("Download ready", {
        description: `${title} — link valid for ${Math.round(res.expiresInSec / 60)} min.`,
      });
    } catch (err) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <SectionHeader
        eyebrow="Reports"
        title="Operational Intelligence Library"
        description="Every report we generate for your organization is stored here, encrypted and access-controlled. Downloads are signed and audit-logged."
        action={
          <Link href="/ai-scan">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              <ScanSearch className="h-4 w-4 mr-2" />
              Run new AI Scan
            </Button>
          </Link>
        }
      />

      {/* Search bar — always visible above results so users have orientation
          while data loads. Hidden on permission-denied (state switch will
          render the deny card and consume the entire viewport). */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="Search by title, summary or reference"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-orange-400/40"
          />
        </div>
      </div>

      {(() => {
        const placeholder = (
          <SectionStateSwitch
            loading={reports.isLoading}
            error={reports.error}
            onRetry={() => reports.refetch()}
            data={filtered}
            isEmpty={d => d.length === 0 && !query}
            emptyIcon={<FileText className="h-5 w-5" />}
            emptyTitle="No reports yet"
            emptyBody="When you finish your first AI Scan, a branded PDF report will appear in this vault."
            emptyAction={
              <Link href="/ai-scan">
                <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
                  Start AI Scan
                </Button>
              </Link>
            }
            skeletonRows={5}
          />
        );
        if (placeholder) return placeholder;

        // Filtered-but-empty (data exists, just no matches for current query).
        if (filtered.length === 0) {
          return (
            <GlassCard className="p-10 text-center">
              <p className="text-sm text-white/55">
                No reports match <span className="text-white">"{query}"</span>.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 text-xs font-medium text-orange-300 hover:text-orange-200"
              >
                Clear filter
              </button>
            </GlassCard>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(r => (
              <GlassCard key={r.id} className="p-5" interactive>
                <div className="flex items-center justify-between">
                  <StatusPill
                    status={r.status}
                    variant={r.status === "delivered" ? "good" : "info"}
                  />
                  <span className="text-[11px] text-white/40 font-mono">{r.publicRef}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">{r.title}</h3>
                <p className="mt-1 text-[11px] text-white/45">
                  Generated {new Date(r.createdAt as unknown as string).toLocaleString()}
                </p>
                {r.summary && (
                  <p className="mt-3 text-sm text-white/65 line-clamp-3">{r.summary}</p>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                    disabled={!r.pdfKey || downloadingId === r.id}
                    onClick={() => handleDownload(r.id, r.title)}
                  >
                    {downloadingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {r.pdfKey ? "Download PDF" : "Awaiting upload"}
                  </Button>
                  <span className="ml-auto text-xs font-mono text-orange-200">
                    {r.score}/100
                  </span>
                </div>
              </GlassCard>
            ))}
          </div>
        );
      })()}
    </>
  );
}
