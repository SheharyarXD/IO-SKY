/**
 * IO SKY — AI Scan result page.
 *
 * Polls aiScans.getReport every 2.5s while status is pending/scoring; renders
 * the executive report once status=ready. Tier-aware: roadmap is hidden for
 * the Free tier as per AI_SCAN_TIER_PROFILE.
 */

import { useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useT } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  AI_SCAN_DIMENSION_LABELS,
  type AiScanReportPayload,
  type AiScanDimension,
} from "@shared/aiScanModel";

const POLL_INTERVAL_MS = 2500;

const HORIZONS: Array<"0-30d" | "30-90d" | "90-180d" | "180d+"> = [
  "0-30d",
  "30-90d",
  "90-180d",
  "180d+",
];

const HORIZON_LABEL: Record<string, string> = {
  "0-30d": "First 30 days",
  "30-90d": "30–90 days",
  "90-180d": "90–180 days",
  "180d+": "180 days +",
};

const IMPACT_TONE: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  transformational: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
};

const EFFORT_TONE: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function AIScanResult() {
  const { t } = useT();
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  const query = trpc.aiScans.getReport.useQuery(
    { token },
    {
      enabled: token.length > 16,
      refetchInterval: (q) => {
        const data = q.state.data;
        if (data?.status === "ready" || data?.status === "failed") return false;
        return POLL_INTERVAL_MS;
      },
    },
  );

  const data = query.data;

  if (!token) {
    return (
      <Shell>
        <NotFoundView />
      </Shell>
    );
  }

  if (query.isLoading) {
    return (
      <Shell>
        <LoadingView />
      </Shell>
    );
  }

  if (query.error) {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertDescription>
            {t("aiscan.result.errorGeneric") || query.error.message}
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  if (!data) return <Shell><NotFoundView /></Shell>;

  if (data.status === "failed") {
    return (
      <Shell>
        <Alert variant="destructive">
          <AlertDescription>
            {t("aiscan.result.failed") ||
              "We couldn't generate your report automatically. Our team has been notified and will reach out shortly."}
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  if (data.status !== "ready" || !data.report) {
    return (
      <Shell>
        <ScoringView company={data.company ?? ""} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Report report={data.report} company={data.company ?? ""} token={token} />
    </Shell>
  );
}

// ── Shell ──────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-5xl py-12 md:py-16">{children}</main>
      <Footer />
    </div>
  );
}

// ── States ─────────────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

function NotFoundView() {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-8 text-center">
      <h1 className="text-2xl font-semibold">
        {t("aiscan.result.notFoundTitle") || "Report not found"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t("aiscan.result.notFoundBody") ||
          "This link may have expired. Start a new AI Scan to generate a fresh report."}
      </p>
      <Button asChild className="mt-6 bg-orange-500 hover:bg-orange-600 text-white">
        <Link href="/ai-scan">{t("aiscan.result.startNew") || "Start a new scan"}</Link>
      </Button>
    </div>
  );
}

function ScoringView({ company }: { company: string }) {
  const { t } = useT();
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center">
      <p className="text-xs font-mono tracking-[0.3em] text-orange-400/80 uppercase">
        {t("aiscan.result.workingEyebrow") || "Generating report"}
      </p>
      <h1 className="mt-3 text-2xl md:text-3xl font-semibold">
        {t("aiscan.result.workingTitle") || `Building ${company}'s executive report…`}
      </h1>
      <p className="mt-3 text-muted-foreground max-w-prose mx-auto">
        {t("aiscan.result.workingBody") ||
          "We're scoring your responses and writing the rationale. This page will update automatically — usually within a minute."}
      </p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-orange-400 animate-pulse" />
        {t("aiscan.result.polling") || "Listening for results…"}
      </div>
    </div>
  );
}

// ── Report ─────────────────────────────────────────────────────────────────
function Report({
  report,
  company,
  token,
}: {
  report: AiScanReportPayload;
  company: string;
  token: string;
}) {
  const { t } = useT();

  const pdfMutation = trpc.aiScans.getReportPdf.useMutation();
  const handleDownloadPdf = async () => {
    try {
      const { url, filename } = await pdfMutation.mutateAsync({ token });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(
        t("aiscan.result.pdfReady") || "Your report PDF is ready.",
      );
    } catch {
      toast.error(
        t("aiscan.result.pdfError") ||
          "We could not generate the PDF right now. Please try again.",
      );
    }
  };

  const radarData = useMemo(
    () =>
      report.dimensions.map((d) => ({
        dim: AI_SCAN_DIMENSION_LABELS[d.dimension as AiScanDimension] ?? d.dimension,
        score: d.score,
      })),
    [report.dimensions],
  );

  return (
    <div className="space-y-12">
      <header>
        <p className="text-xs font-mono tracking-[0.3em] text-orange-400/80 uppercase">
          {t("aiscan.result.eyebrow") || "AI Scan Report"} ·{" "}
          {report.tier.toUpperCase()}
        </p>
        <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
          {company}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            {t("aiscan.result.scored") || "Scored"}{" "}
            {new Date(report.scoredAt).toLocaleString()}
          </span>
          <span aria-hidden>·</span>
          <span>
            {t("aiscan.result.overallScore") || "Overall score"}:{" "}
            <span className="text-foreground font-semibold">
              {report.overallScore}/100
            </span>{" "}
            ({report.overallGrade})
          </span>
        </div>
      </header>

      {/* Executive summary + radar */}
      <section className="grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3 rounded-xl border border-border/60 bg-card/40 p-6 md:p-8">
          <h2 className="text-lg font-semibold">
            {t("aiscan.result.execSummary") || "Executive summary"}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </div>
        <div className="md:col-span-2 rounded-xl border border-border/60 bg-card/40 p-6 md:p-8">
          <h2 className="text-lg font-semibold">
            {t("aiscan.result.maturityRadar") || "Maturity radar"}
          </h2>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="dim"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Radar
                  dataKey="score"
                  stroke="rgb(249 115 22)"
                  fill="rgb(249 115 22)"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Dimension breakdown */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          {t("aiscan.result.dimensions") || "Dimension breakdown"}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {report.dimensions.map((d) => (
            <div
              key={d.dimension}
              className="rounded-xl border border-border/60 bg-card/40 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  {AI_SCAN_DIMENSION_LABELS[d.dimension as AiScanDimension] ??
                    d.dimension}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-orange-500/40 text-orange-300">
                    {d.grade}
                  </Badge>
                  <span className="text-sm font-semibold">{d.score}/100</span>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-600"
                  style={{ width: `${Math.max(0, Math.min(100, d.score))}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {d.rationale}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Opportunities */}
      {report.opportunities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {t("aiscan.result.opportunities") || "Highest-leverage opportunities"}
          </h2>
          <ol className="space-y-3">
            {report.opportunities.map((op, idx) => (
              <li
                key={op.id}
                className="rounded-xl border border-border/60 bg-card/40 p-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-orange-500/15 text-orange-300 text-xs font-mono">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold flex-1">{op.title}</h3>
                  <Badge variant="outline" className={IMPACT_TONE[op.impact] ?? ""}>
                    Impact: {op.impact}
                  </Badge>
                  <Badge variant="outline" className={EFFORT_TONE[op.effort] ?? ""}>
                    Effort: {op.effort}
                  </Badge>
                  <Badge variant="outline">Horizon: {op.horizon}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {op.summary}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Roadmap (hidden on Free tier — payload omits it) */}
      {report.roadmap.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {t("aiscan.result.roadmap") || "Operational roadmap"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {HORIZONS.map((h) => {
              const row = report.roadmap.find((r) => r.horizon === h);
              if (!row || row.items.length === 0) return null;
              return (
                <div
                  key={h}
                  className="rounded-xl border border-border/60 bg-card/40 p-5"
                >
                  <p className="text-xs font-mono tracking-[0.2em] text-orange-400/80 uppercase">
                    {HORIZON_LABEL[h]}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {row.items.map((it, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-orange-400">›</span>
                        <span className="leading-snug">{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Disclaimers + CTA */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-6">
        <h3 className="text-sm font-semibold">
          {t("aiscan.result.disclaimersTitle") || "About this report"}
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
          {report.disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={handleDownloadPdf}
            disabled={pdfMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {pdfMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {pdfMutation.isPending
              ? t("aiscan.result.pdfPreparing") || "Preparing PDF…"
              : t("aiscan.result.downloadPdf") || "Download report (PDF)"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/book-strategy">
              {t("aiscan.result.bookCall") || "Discuss this report on a discovery call"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/solutions">
              {t("aiscan.result.viewSolutions") || "Explore IO SKY solutions"}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
