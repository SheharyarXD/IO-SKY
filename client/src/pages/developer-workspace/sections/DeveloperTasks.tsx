/*
 * IO SKY — Developer Workspace · Tasks.
 *
 * Personal task list across every assigned project. Each row shows the
 * project code + name, task title, current status, due date (if any),
 * and an inline status select that calls `developer.setTaskStatus`.
 * Status changes are audited server-side and notify the engineering
 * coordinator, so we just need an optimistic UI + toast feedback.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "@/pages/client-portal/components/PortalUI";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ListTodo, ChevronRight } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "in_review", label: "In review" },
  { value: "done", label: "Done" },
] as const;

type TaskStatus = (typeof STATUS_OPTIONS)[number]["value"];

function statusVariant(status: string): "neutral" | "good" | "warn" | "info" | "danger" {
  switch (status) {
    case "done":
      return "good";
    case "in_review":
      return "info";
    case "blocked":
      return "danger";
    case "in_progress":
      return "warn";
    default:
      return "neutral";
  }
}

export default function DeveloperTasks() {
  const utils = trpc.useUtils();
  const tasksQuery = trpc.developer.listTasks.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Filter UI — defaults to "Mine + active" because that matches what a
  // developer cares about on a Tuesday morning.
  const [filter, setFilter] = useState<
    "all" | "mine" | "active" | "blocked" | "review" | "done"
  >("active");

  const setStatus = trpc.developer.setTaskStatus.useMutation({
    onSuccess: () => {
      utils.developer.listTasks.invalidate();
      utils.developer.dashboard.invalidate();
      toast.success("Task status updated");
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not update task status");
    },
  });

  const filtered = useMemo(() => {
    const data = tasksQuery.data ?? [];
    switch (filter) {
      case "mine":
        return data.filter((t) => t.mine);
      case "active":
        return data.filter(
          (t) =>
            t.mine &&
            ["planned", "in_progress", "blocked", "in_review"].includes(t.status),
        );
      case "blocked":
        return data.filter((t) => t.status === "blocked");
      case "review":
        return data.filter((t) => t.status === "in_review");
      case "done":
        return data.filter((t) => t.status === "done");
      default:
        return data;
    }
  }, [tasksQuery.data, filter]);

  const counts = useMemo(() => {
    const data = tasksQuery.data ?? [];
    return {
      mine: data.filter((t) => t.mine).length,
      active: data.filter(
        (t) =>
          t.mine &&
          ["planned", "in_progress", "blocked", "in_review"].includes(t.status),
      ).length,
      blocked: data.filter((t) => t.status === "blocked").length,
      review: data.filter((t) => t.status === "in_review").length,
      done: data.filter((t) => t.status === "done").length,
    };
  }, [tasksQuery.data]);

  const filterChip = (
    key: typeof filter,
    label: string,
    count: number,
  ) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        filter === key
          ? "border-orange-400/40 bg-orange-500/10 text-orange-200"
          : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white/85",
      ].join(" ")}
    >
      {label}
      <span className="text-[10px] tabular-nums opacity-80">{count}</span>
    </button>
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Delivery"
        title="Tasks"
        description="Your personal task list across every assigned project. Status changes are audited and the engineering coordinator is notified automatically."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {filterChip("active", "Active", counts.active)}
        {filterChip("mine", "Mine (all)", counts.mine)}
        {filterChip("blocked", "Blocked", counts.blocked)}
        {filterChip("review", "In review", counts.review)}
        {filterChip("done", "Done", counts.done)}
        {filterChip("all", "All visible", tasksQuery.data?.length ?? 0)}
      </div>

      <SectionStateSwitch
        loading={tasksQuery.isLoading}
        error={tasksQuery.error}
        onRetry={() => tasksQuery.refetch()}
        data={filtered}
        isEmpty={(d) => (d?.length ?? 0) === 0}
        emptyIcon={<ListTodo className="h-5 w-5" />}
        emptyTitle="No tasks for this filter"
        emptyBody={
          filter === "active"
            ? "Nothing is actively assigned to you right now. Try the 'Mine (all)' or 'All visible' filter."
            : "Tasks will appear here when assignments include actionable work."
        }
        skeletonRows={6}
      />

      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((task) => {
            const isMine = !!task.mine;
            return (
              <GlassCard
                key={task.id}
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:gap-5 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.02] text-white/65 text-[10px] uppercase tracking-wider font-semibold"
                    >
                      {task.projectCode}
                    </Badge>
                    {!isMine && (
                      <Badge
                        variant="outline"
                        className="border-amber-400/30 bg-amber-500/10 text-amber-200 text-[10px] uppercase tracking-wider"
                      >
                        Read-only
                      </Badge>
                    )}
                    <StatusPill
                      status={task.status.replace("_", " ")}
                      variant={statusVariant(task.status)}
                    />
                    {task.priority && task.priority !== "normal" && (
                      <Badge
                        variant="outline"
                        className={[
                          "text-[10px] uppercase tracking-wider",
                          task.priority === "high"
                            ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
                            : "border-white/10 bg-white/[0.02] text-white/55",
                        ].join(" ")}
                      >
                        {task.priority}
                      </Badge>
                    )}
                  </div>

                  <h3 className="mt-2 text-sm md:text-base font-semibold text-white truncate">
                    {task.title}
                  </h3>
                  {task.body && (
                    <p className="mt-1 text-xs md:text-sm text-white/55 line-clamp-2">
                      {task.body}
                    </p>
                  )}
                  {task.dueMs && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-white/45">
                      <ChevronRight className="h-3 w-3 opacity-60" />
                      Due {new Date(task.dueMs).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="md:w-[180px] shrink-0">
                  {isMine ? (
                    <Select
                      value={task.status}
                      onValueChange={(value) =>
                        setStatus.mutate({
                          taskId: task.id,
                          status: value as TaskStatus,
                        })
                      }
                      disabled={setStatus.isPending}
                    >
                      <SelectTrigger className="w-full bg-white/[0.02] border-white/10 text-white/85 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a1020] border-white/10">
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-white/85"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[11px] text-white/40">
                      Assigned to another engineer
                    </p>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
