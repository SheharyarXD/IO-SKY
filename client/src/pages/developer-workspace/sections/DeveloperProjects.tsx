/*
 * IO SKY — Developer Workspace · Assigned Projects.
 *
 * Read-only directory of every project the developer has an active
 * assignment on. Per master spec they only see their own assignments;
 * the server enforces this via developerProcedure + assignment lookup.
 */
import { trpc } from "@/lib/trpc";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "@/pages/client-portal/components/PortalUI";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FolderKanban } from "lucide-react";

function statusVariant(status: string): "neutral" | "good" | "warn" | "info" | "danger" {
  switch (status) {
    case "active":
      return "good";
    case "paused":
      return "warn";
    case "archived":
      return "neutral";
    case "delivered":
      return "info";
    default:
      return "neutral";
  }
}

export default function DeveloperProjects() {
  const projectsQuery = trpc.developer.listProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Delivery"
        title="Assigned projects"
        description="Every project you're staffed on. You see your own assignments only — never the full client portfolio."
      />

      <SectionStateSwitch
        loading={projectsQuery.isLoading}
        error={projectsQuery.error}
        onRetry={() => projectsQuery.refetch()}
        data={projectsQuery.data ?? []}
        isEmpty={(d) => (d?.length ?? 0) === 0}
        emptyIcon={<FolderKanban className="h-5 w-5" />}
        emptyTitle="No active assignments"
        emptyBody="Once the engineering desk staffs you onto a project it'll appear here with its scope, code, and current status."
        skeletonRows={3}
      />

      {projectsQuery.data && projectsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectsQuery.data.map((project) => (
            <GlassCard key={project.id} className="p-5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="border-orange-500/30 bg-orange-500/10 text-orange-200 text-[10px] uppercase tracking-wider font-semibold"
                >
                  {project.code}
                </Badge>
                <StatusPill
                  status={project.status}
                  variant={statusVariant(project.status)}
                />
              </div>
              <h3 className="mt-3 text-base font-semibold text-white truncate">
                {project.name}
              </h3>
              {project.brief && (
                <p className="mt-1 text-sm text-white/60 line-clamp-3">
                  {project.brief}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex justify-between border-b border-white/[0.06] pb-1">
                  <span className="text-white/45">Started</span>
                  <span className="text-white/80">
                    {project.startMs ? formatDate(project.startMs) : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.06] pb-1">
                  <span className="text-white/45">Target</span>
                  <span className="text-white/80">
                    {project.targetMs ? formatDate(project.targetMs) : "—"}
                  </span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
