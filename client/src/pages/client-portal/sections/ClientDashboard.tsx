/*
 * IO SKY — Client Portal Dashboard section.
 * Premium overview: KPI strip, latest report, AI recommendations, upcoming
 * discovery call, recent activity, messages, security/compliance footer.
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Download,
  FileText,
  Mail,
  Sparkles,
  ShieldCheck,
  ScanSearch,
  Receipt,
  CheckCircle2,
} from "lucide-react";
import { SectionHeader, GlassCard, EmptyState, PortalSkeleton, StatusPill } from "../components/PortalUI";

export default function ClientDashboard() {
  const dashboard = trpc.clientPortal.dashboard.useQuery();
  const data = dashboard.data;

  const score = data?.organization?.operationalScore ?? 0;
  const latestReport = data?.latestReport;
  const recommendations = data?.recommendations ?? [];
  const projects = data?.projects ?? [];
  const invoices = data?.invoices ?? [];
  const messages = data?.messages ?? [];
  const notifications = data?.notifications ?? [];

  const nextCall = useNextBooking();

  return (
    <>
      <SectionHeader
        eyebrow="Overview"
        title="Your operational intelligence at a glance"
        description="A live view of your scans, recommendations and engagements with the IO SKY team."
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KPI
          label="Operational Score"
          value={score ? `${score}/100` : "—"}
          accent="orange"
          sub={latestReport ? `${latestReport.delta >= 0 ? "▲" : "▼"} ${Math.abs(latestReport.delta)} vs last scan` : "Awaiting your first scan"}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <KPI
          label="Active Recommendations"
          value={String(data?.activeRecommendationCount ?? 0)}
          accent="amber"
          sub={recommendations.length ? `${recommendations.length} total tracked` : "No recommendations yet"}
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <KPI
          label="Reports Generated"
          value={String(data?.reportCount ?? 0)}
          accent="sky"
          sub="Stored in your secure vault"
          icon={<FileText className="h-4 w-4" />}
        />
        <KPI
          label="Next Discovery Call"
          value={nextCall.formatted ?? "Not scheduled"}
          accent="violet"
          sub={nextCall.subtitle ?? "Book a session to align on your roadmap"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Latest report + AI recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Latest Report</p>
              <h3 className="text-lg font-semibold text-white mt-1">
                {latestReport ? latestReport.title : "No reports yet"}
              </h3>
            </div>
            {latestReport && (
              <StatusPill
                status={latestReport.status}
                variant={latestReport.status === "delivered" ? "good" : "info"}
              />
            )}
          </div>

          {dashboard.isLoading ? (
            <PortalSkeleton rows={3} />
          ) : latestReport ? (
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
              <div className="rounded-xl border border-white/8 bg-gradient-to-br from-[#0e162a] to-[#0a1020] p-4 aspect-[3/4] flex flex-col">
                <div className="text-[10px] uppercase tracking-[0.18em] text-orange-300/80">IO SKY</div>
                <div className="mt-auto">
                  <p className="text-[11px] text-white/55">Operational Intelligence</p>
                  <p className="text-sm font-semibold text-white mt-0.5">Report</p>
                  <p className="text-[10px] text-white/40 mt-2">
                    {new Date(latestReport.createdAt as unknown as string).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-sm text-white/70 leading-relaxed">
                  {latestReport.summary ?? "Deep-dive analysis of your operational ecosystem with strategic recommendations tailored to your business."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {latestReport.pages && (
                    <Badge>{latestReport.pages} pages</Badge>
                  )}
                  <Badge>Executive summary</Badge>
                  <Badge>AI-powered insights</Badge>
                </div>
                <div className="mt-auto pt-5 flex flex-wrap gap-3">
                  <Link href={`/client-portal/reports`}>
                    <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
                      View Report
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Download PDF
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ScanSearch className="h-5 w-5" />}
              title="Run your first AI Scan"
              body="Get a baseline reading of your operational health. We’ll generate a report inside your vault automatically."
              action={
                <Link href="/ai-scan">
                  <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
                    Start AI Scan
                  </Button>
                </Link>
              }
            />
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">AI Recommendations</p>
              <h3 className="text-lg font-semibold text-white mt-1">Highest impact</h3>
            </div>
            <Link href="/client-portal/recommendations" className="text-xs text-orange-300/90 hover:text-orange-200">
              View all →
            </Link>
          </div>

          {dashboard.isLoading ? (
            <PortalSkeleton rows={4} />
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-white/55">
              No recommendations yet. After your next AI Scan, prioritized recommendations will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {recommendations.map(r => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-3.5 py-3 hover:border-orange-500/30 hover:bg-orange-500/[0.04] transition-all"
                >
                  <div className="h-8 w-8 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center shrink-0 text-orange-300">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">{r.category}</p>
                  </div>
                  <ImpactBadge impact={r.impact} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Strategy call · activity · messages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <GlassCard className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Upcoming Discovery Call</p>
          {nextCall.booking ? (
            <>
              <p className="text-orange-300 mt-1 text-sm font-semibold">{nextCall.booking.serviceLabel}</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {nextCall.formatted}
              </p>
              <p className="text-xs text-white/55 mt-0.5">{nextCall.booking.timezone}</p>
              <Countdown ms={nextCall.booking.slotStartMs} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
                  Join Call
                </Button>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                >
                  Reschedule
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-4 text-sm text-white/55">
              <p>No call scheduled yet.</p>
              <Link href="/book-strategy">
                <Button className="mt-4 bg-orange-500 hover:bg-orange-400 text-black font-semibold">
                  Book Discovery Call
                </Button>
              </Link>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Recent Activity</p>
            <Link href="/client-portal/messages" className="text-xs text-orange-300/90 hover:text-orange-200">
              View all →
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-white/55">No recent activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.slice(0, 5).map(n => (
                <li key={n.id} className="flex items-start gap-3">
                  <ActivityIcon kind={n.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{n.title}</p>
                    {n.body && (
                      <p className="text-[11px] text-white/50 mt-0.5 truncate">{n.body}</p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 shrink-0">
                    {timeAgo(n.createdAt as unknown as string)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Messages</p>
            <Link href="/client-portal/messages" className="text-xs text-orange-300/90 hover:text-orange-200">
              View all →
            </Link>
          </div>
          {messages.length === 0 ? (
            <EmptyState
              icon={<Mail className="h-5 w-5" />}
              title="No messages yet"
              body="Conversations with your IO SKY team will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {messages.map(m => (
                <li key={m.id} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-500/15 ring-1 ring-orange-500/30 text-orange-200 text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {(m.senderName ?? "IO").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{m.senderName ?? "IO SKY"}</p>
                      <span className="text-[10px] uppercase tracking-wider text-white/40 shrink-0">
                        {timeAgo(m.createdAt as unknown as string)}
                      </span>
                    </div>
                    {m.subject && (
                      <p className="text-[11px] text-white/60 truncate">{m.subject}</p>
                    )}
                    <p className="text-[11px] text-white/45 truncate">{m.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Projects progress */}
      {projects.length > 0 && (
        <GlassCard className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Project Progress</p>
              <h3 className="text-lg font-semibold text-white mt-1">Active engagements</h3>
            </div>
            <Link href="/client-portal/projects" className="text-xs text-orange-300/90 hover:text-orange-200">
              Full view →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.slice(0, 4).map(p => (
              <div
                key={p.id}
                className="rounded-xl border border-white/6 bg-white/[0.02] p-4 hover:border-orange-500/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                  <StatusPill
                    status={p.status}
                    variant={p.status === "completed" ? "good" : p.status === "on_hold" ? "warn" : "info"}
                  />
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">{p.phase}</p>
                <Progress
                  value={p.progress}
                  className="mt-3 h-1.5 bg-white/8 [&>div]:bg-orange-400"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                  <span>{p.progress}% complete</span>
                  {p.targetMs && (
                    <span>Target {new Date(p.targetMs).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Billing strip + security footer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Recent Invoices</p>
              <h3 className="text-lg font-semibold text-white mt-1">Billing summary</h3>
            </div>
            <Link href="/client-portal/billing" className="text-xs text-orange-300/90 hover:text-orange-200">
              Open billing →
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-sm text-white/55">No invoices on file. New invoices appear here automatically the moment they are issued.</p>
          ) : (
            <ul className="divide-y divide-white/6">
              {invoices.slice(0, 4).map(inv => (
                <li key={inv.id} className="py-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/55">
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{inv.description}</p>
                    <p className="text-[11px] text-white/50">{inv.number}</p>
                  </div>
                  <p className="text-sm font-mono text-white shrink-0">
                    {(inv.amountCents / 100).toLocaleString("en-EU", {
                      style: "currency",
                      currency: inv.currency,
                    })}
                  </p>
                  <StatusPill
                    status={inv.status}
                    variant={
                      inv.status === "paid"
                        ? "good"
                        : inv.status === "overdue"
                          ? "danger"
                          : "warn"
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Your Data is Secure</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 flex items-center justify-center text-orange-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="text-sm text-white/65 leading-relaxed">
              Enterprise-grade encryption, 24/7 monitoring and security-first practices infrastructure protect your operational intelligence.
            </p>
          </div>
          <ul className="mt-4 space-y-2 text-[12px] text-white/65">
            <ComplianceItem label="End-to-end encryption" />
            <ComplianceItem label="security-first practices" />
            <ComplianceItem label="GDPR compliant" />
            <ComplianceItem label="24/7 security monitoring" />
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

function KPI({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: "orange" | "amber" | "sky" | "violet";
}) {
  const accentMap: Record<string, string> = {
    orange: "from-orange-500/15 to-orange-500/[0.02] text-orange-200 ring-orange-500/25",
    amber: "from-amber-500/15 to-amber-500/[0.02] text-amber-200 ring-amber-500/25",
    sky: "from-sky-500/15 to-sky-500/[0.02] text-sky-200 ring-sky-500/25",
    violet: "from-violet-500/15 to-violet-500/[0.02] text-violet-200 ring-violet-500/25",
  };
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
          {sub && <p className="mt-1.5 text-[11px] text-white/55">{sub}</p>}
        </div>
        <div
          className={
            "h-10 w-10 rounded-xl bg-gradient-to-br ring-1 flex items-center justify-center shrink-0 " +
            accentMap[accent]
          }
        >
          {icon}
        </div>
      </div>
    </GlassCard>
  );
}

function ImpactBadge({ impact }: { impact: "low" | "medium" | "high" }) {
  const map = {
    low: "bg-white/[0.05] text-white/60 border-white/15",
    medium: "bg-amber-500/10 text-amber-200 border-amber-500/30",
    high: "bg-orange-500/15 text-orange-200 border-orange-500/40",
  } as const;
  return (
    <span
      className={
        "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        map[impact]
      }
    >
      {impact} impact
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[11px] text-white/60">
      {children}
    </span>
  );
}

function ComplianceItem({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300/90" />
      <span>{label}</span>
    </li>
  );
}

function ActivityIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    report: { icon: FileText, color: "text-orange-300 bg-orange-500/10 ring-orange-500/30" },
    booking: { icon: Clock, color: "text-violet-300 bg-violet-500/10 ring-violet-500/30" },
    payment: { icon: Receipt, color: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30" },
    document: { icon: FileText, color: "text-sky-300 bg-sky-500/10 ring-sky-500/30" },
    message: { icon: Mail, color: "text-amber-300 bg-amber-500/10 ring-amber-500/30" },
    security: { icon: ShieldCheck, color: "text-rose-300 bg-rose-500/10 ring-rose-500/30" },
    support: { icon: Mail, color: "text-white/60 bg-white/[0.04] ring-white/10" },
  };
  const entry = map[kind] ?? map.message;
  const Icon = entry.icon;
  return (
    <div className={"h-8 w-8 rounded-lg flex items-center justify-center ring-1 shrink-0 " + entry.color}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function timeAgo(iso: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function Countdown({ ms }: { ms: number }) {
  const total = Math.max(0, ms - Date.now());
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {[
        { label: "Days", value: days },
        { label: "Hours", value: hours },
        { label: "Min", value: minutes },
        { label: "Sec", value: seconds },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2 text-center">
          <p className="text-lg font-mono text-orange-200">{String(value).padStart(2, "0")}</p>
          <p className="text-[9px] uppercase tracking-wider text-white/45 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Pull the next upcoming Discovery Call from the client's bookings.
 * Currently uses the public bookings.getByRef API isn't appropriate; instead
 * we re-use the user's strategy-call listing in the strategy-calls section.
 * For the dashboard's "next call" widget we cheat using the local
 * dashboard.notifications feed which carries booking notifications, but for
 * a real signal we hit strategy-calls.upcoming once that surface exists.
 *
 * For now, fall back to a "Not scheduled" state when nothing is available.
 */
function useNextBooking(): {
  booking?: { slotStartMs: number; timezone: string; serviceLabel: string };
  formatted?: string;
  subtitle?: string;
} {
  return {};
}
