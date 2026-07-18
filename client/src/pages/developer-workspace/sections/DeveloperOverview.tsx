/*
 * IO SKY — Developer Workspace · Overview.
 *
 * Renders the four KPI tiles (Assigned Projects, Active Tasks, Pending
 * Submissions, Unread Messages), an Agreements progress card, the most
 * recent admin messages, and the latest submissions. The page is only
 * mounted when `WorkspaceGate` confirms every gate has passed, so we can
 * safely call `developer.dashboard` here.
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  GlassCard,
  PortalSkeleton,
  ErrorState,
  SectionHeader,
} from "@/pages/client-portal/components/PortalUI";
import {
  FolderKanban,
  ListTodo,
  GitCommit,
  MessageSquare,
  ScrollText,
  ArrowRight,
} from "lucide-react";

function KpiCard({
  icon: Icon,
  label,
  value,
  href,
  hint,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number | string;
  href: string;
  hint?: string;
}) {
  return (
    <Link href={href}>
      <GlassCard
        interactive
        className="p-5 cursor-pointer group h-full transition-transform duration-200 hover:-translate-y-0.5"
      >
        <div className="flex items-center justify-between">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
            <Icon className="h-4 w-4" />
          </div>
          <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-orange-300 transition-colors" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {label}
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-white tabular-nums">
          {value}
        </p>
        {hint && (
          <p className="mt-1 text-[11px] text-white/45">{hint}</p>
        )}
      </GlassCard>
    </Link>
  );
}

export default function DeveloperOverview({
  fullName,
}: {
  fullName: string;
}) {
  const dashboard = trpc.developer.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (dashboard.isLoading) {
    return (
      <div>
        <SectionHeader
          eyebrow="Workspace"
          title={`Welcome back, ${fullName.split(" ")[0]}`}
          description="Loading your assignments, tasks and engineering signals."
        />
        <PortalSkeleton rows={6} />
      </div>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <ErrorState
        body={dashboard.error?.message ?? "Unable to load workspace overview."}
        onRetry={() => dashboard.refetch()}
      />
    );
  }

  const d = dashboard.data;
  const agreementsComplete = d.signedAgreementCount >= d.requiredAgreementCount;

  return (
    <div>
      <SectionHeader
        eyebrow="Workspace"
        title={`Welcome back, ${fullName.split(" ")[0]}`}
        description="Your engineering workspace is calm by design — only what's assigned to you, only what's actionable today."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={FolderKanban}
          label="Assigned Projects"
          value={d.assignedProjectCount}
          href="/developer-workspace/projects"
          hint="Active assignments"
        />
        <KpiCard
          icon={ListTodo}
          label="Active Tasks"
          value={d.activeTaskCount}
          href="/developer-workspace/tasks"
          hint="In progress, planned or blocked"
        />
        <KpiCard
          icon={GitCommit}
          label="Pending Submissions"
          value={d.pendingSubmissionCount}
          href="/developer-workspace/submissions"
          hint="Awaiting review"
        />
        <KpiCard
          icon={MessageSquare}
          label="Unread Messages"
          value={d.unreadMessageCount}
          href="/developer-workspace/messages"
          hint="From the engineering desk"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agreements card */}
        <GlassCard className="p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
              <ScrollText className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Engineering agreements
            </h3>
          </div>
          <p className="mt-3 text-sm text-white/60">
            {agreementsComplete
              ? "All required engineering agreements are signed and on file."
              : "Some required agreements are still pending your signature."}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-semibold tabular-nums text-white">
              {d.signedAgreementCount}
              <span className="text-white/35"> / {d.requiredAgreementCount}</span>
            </span>
            <Link
              href="/developer-workspace/agreements"
              className="text-xs font-medium text-orange-300 hover:text-orange-200"
            >
              {agreementsComplete ? "Review" : "Sign now"} →
            </Link>
          </div>
        </GlassCard>

        {/* Recent inbound messages */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Latest engineering messages
            </h3>
            <Link
              href="/developer-workspace/messages"
              className="text-xs font-medium text-orange-300 hover:text-orange-200"
            >
              Open inbox →
            </Link>
          </div>
          {d.latestMessages.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">
              No recent messages. The engineering desk hasn't sent anything new.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.latestMessages.map((msg) => (
                <li
                  key={msg.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-sm text-white/85 line-clamp-2">{msg.body}</p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent submissions */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Recent submissions
            </h3>
            <Link
              href="/developer-workspace/submissions"
              className="text-xs font-medium text-orange-300 hover:text-orange-200"
            >
              View all →
            </Link>
          </div>
          {d.recentSubmissions.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">
              You haven't submitted anything yet. Use the Submissions tab to deliver
              code, commits, or written updates.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.recentSubmissions.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/85 truncate">{s.title}</p>
                    <span className="text-[11px] uppercase tracking-wide text-white/45">
                      {s.kind} · {s.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Notifications */}
        <GlassCard className="p-6">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            Recent activity
          </h3>
          {d.notifications.length === 0 ? (
            <p className="mt-4 text-sm text-white/50">
              No recent activity. As assignments, agreements, and submissions move
              along you'll see signals here.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {d.notifications.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-sm text-white/85">{n.title}</p>
                  {n.body && (
                    <p className="mt-1 text-xs text-white/55 line-clamp-2">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-white/40">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
