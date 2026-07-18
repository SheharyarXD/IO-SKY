import { trpc } from "@/lib/trpc";
import { GitBranch, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { GlassCard, EmptyState, PortalSkeleton, SectionHeader, StatusPill } from "../components/PortalUI";

export default function ClientProjects() {
  const projects = trpc.clientPortal.projects.useQuery();
  const list = projects.data ?? [];

  return (
    <>
      <SectionHeader
        eyebrow="Project Progress"
        title="Engagements in flight"
        description="Track milestone status, owner, and target dates for every active project IO SKY is delivering for you."
      />

      {projects.isLoading ? (
        <PortalSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-5 w-5" />}
          title="No active projects"
          body="Once an engagement begins, your milestones and progress will appear here in real time."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {list.map(p => (
            <GlassCard key={p.id} className="p-6" interactive>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">{p.name}</h3>
                  <p className="text-[11px] text-white/45 mt-0.5">{p.phase}</p>
                </div>
                <StatusPill
                  status={p.status.replace("_", " ")}
                  variant={p.status === "completed" ? "good" : p.status === "on_hold" ? "warn" : "info"}
                />
              </div>

              {p.summary && (
                <p className="mt-3 text-sm text-white/65 leading-relaxed">{p.summary}</p>
              )}

              <Progress
                value={p.progress}
                className="mt-4 h-1.5 bg-white/8 [&>div]:bg-orange-400"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
                <span>{p.progress}% complete</span>
                {p.targetMs && (
                  <span>Target {new Date(p.targetMs).toLocaleDateString()}</span>
                )}
              </div>

              {p.milestones && p.milestones.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {p.milestones.slice(0, 5).map((m, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2
                        className={
                          "h-3.5 w-3.5 shrink-0 " +
                          (m.done ? "text-emerald-300" : "text-white/25")
                        }
                      />
                      <span className={m.done ? "text-white/70 line-through" : "text-white/85"}>
                        {m.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}
