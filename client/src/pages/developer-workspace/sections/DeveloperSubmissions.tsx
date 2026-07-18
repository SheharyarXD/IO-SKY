/*
 * IO SKY — Developer Workspace · Submissions.
 *
 * Combines the Submissions and Commits master-spec surfaces into one
 * tabbed view (sidebar locks 11 items so commits live here as a tab).
 *
 * Two flows ship here:
 *   1. Create a written submission for an assigned project, with optional
 *      pre-uploaded fileKey.
 *   2. Record a commit (repository + sha + branch + commit url).
 *
 * The server validates project assignment, audits the row, posts a
 * developer notification, and pings the IO SKY engineering desk.
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitCommit,
  ClipboardList,
  Loader2,
  ArrowUpRight,
} from "lucide-react";

function statusVariant(status: string): "neutral" | "good" | "warn" | "info" | "danger" {
  switch (status) {
    case "accepted":
      return "good";
    case "rejected":
      return "danger";
    case "changes_requested":
      return "warn";
    case "in_review":
      return "info";
    default:
      return "neutral";
  }
}

export default function DeveloperSubmissions() {
  const utils = trpc.useUtils();
  const submissionsQuery = trpc.developer.listSubmissions.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  const projectsQuery = trpc.developer.listProjects.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [tab, setTab] = useState<"submissions" | "commits">("submissions");

  // Submission form state.
  const [subProjectId, setSubProjectId] = useState<string>("");
  const [subTitle, setSubTitle] = useState("");
  const [subBody, setSubBody] = useState("");
  const [subFileKey, setSubFileKey] = useState("");

  // Commit form state.
  const [comProjectId, setComProjectId] = useState<string>("");
  const [comTitle, setComTitle] = useState("");
  const [comRepo, setComRepo] = useState("");
  const [comSha, setComSha] = useState("");
  const [comBranch, setComBranch] = useState("");
  const [comBody, setComBody] = useState("");

  const create = trpc.developer.createSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submitted to engineering desk");
      utils.developer.listSubmissions.invalidate();
      utils.developer.dashboard.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not submit");
    },
  });

  const projectOptions = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const submissionRows = useMemo(
    () =>
      (submissionsQuery.data ?? []).filter((s) => s.kind === "submission"),
    [submissionsQuery.data],
  );
  const commitRows = useMemo(
    () => (submissionsQuery.data ?? []).filter((s) => s.kind === "commit"),
    [submissionsQuery.data],
  );

  const submissionFormReady =
    subProjectId !== "" && subTitle.trim().length >= 3;
  const commitFormReady =
    comProjectId !== "" &&
    comTitle.trim().length >= 3 &&
    comRepo.trim().length > 0 &&
    comSha.trim().length > 0;

  return (
    <div>
      <SectionHeader
        eyebrow="Delivery"
        title="Submissions & commits"
        description="Hand off written updates, documents, and code commits to the engineering desk. Each submission is audited and queued for review."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-white/[0.04] border border-white/10">
          <TabsTrigger value="submissions" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-200">
            <ClipboardList className="h-3.5 w-3.5 mr-2" />
            Submissions
          </TabsTrigger>
          <TabsTrigger value="commits" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-200">
            <GitCommit className="h-3.5 w-3.5 mr-2" />
            Commits
          </TabsTrigger>
        </TabsList>

        {/* SUBMISSIONS TAB */}
        <TabsContent value="submissions" className="mt-5 space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Create a submission
            </h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Project
                </label>
                <Select value={subProjectId} onValueChange={setSubProjectId}>
                  <SelectTrigger className="mt-1 bg-white/[0.02] border-white/10 text-white/85">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1020] border-white/10">
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-white/85">
                        {p.code} · {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Title
                </label>
                <Input
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  placeholder="Concise headline (3+ chars)"
                  maxLength={200}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Body (optional)
                </label>
                <Textarea
                  value={subBody}
                  onChange={(e) => setSubBody(e.target.value)}
                  placeholder="Describe the deliverable, what's changed, and what you'd like reviewed."
                  maxLength={5000}
                  rows={4}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  File key (optional)
                </label>
                <Input
                  value={subFileKey}
                  onChange={(e) => setSubFileKey(e.target.value)}
                  placeholder="storage key returned from a prior upload (leave blank for text-only)"
                  maxLength={512}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90 font-mono text-xs"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                disabled={!submissionFormReady || create.isPending}
                onClick={() =>
                  create.mutate({
                    projectId: Number(subProjectId),
                    kind: "submission",
                    title: subTitle.trim(),
                    body: subBody.trim() || undefined,
                    fileKey: subFileKey.trim() || undefined,
                  })
                }
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_28px_-10px_rgba(255,134,46,0.7)]"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className={create.isPending ? "ml-2" : ""}>Submit</span>
              </Button>
            </div>
          </GlassCard>

          <SectionStateSwitch
            loading={submissionsQuery.isLoading}
            error={submissionsQuery.error}
            onRetry={() => submissionsQuery.refetch()}
            data={submissionRows}
            isEmpty={(d) => (d?.length ?? 0) === 0}
            emptyIcon={<ClipboardList className="h-5 w-5" />}
            emptyTitle="No submissions yet"
            emptyBody="Use the form above to deliver written updates and documents to the engineering desk."
            skeletonRows={3}
          />

          {submissionRows.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {submissionRows.map((row) => (
                <GlassCard key={row.id} className="p-4 md:p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="border-white/10 bg-white/[0.02] text-white/60 text-[10px] uppercase tracking-wider"
                        >
                          Project #{row.projectId}
                        </Badge>
                        <StatusPill status={row.status.replace("_", " ")} variant={statusVariant(row.status)} />
                      </div>
                      <h3 className="mt-2 text-sm md:text-base font-semibold text-white truncate">
                        {row.title}
                      </h3>
                      {row.body && (
                        <p className="mt-1 text-sm text-white/60 line-clamp-2">{row.body}</p>
                      )}
                      <p className="mt-1 text-[11px] text-white/40">
                        {new Date(row.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COMMITS TAB */}
        <TabsContent value="commits" className="mt-5 space-y-5">
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Record a commit
            </h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Project
                </label>
                <Select value={comProjectId} onValueChange={setComProjectId}>
                  <SelectTrigger className="mt-1 bg-white/[0.02] border-white/10 text-white/85">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a1020] border-white/10">
                    {projectOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)} className="text-white/85">
                        {p.code} · {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Title
                </label>
                <Input
                  value={comTitle}
                  onChange={(e) => setComTitle(e.target.value)}
                  placeholder="Short commit headline (3+ chars)"
                  maxLength={200}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
                />
              </div>
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Repository
                </label>
                <Input
                  value={comRepo}
                  onChange={(e) => setComRepo(e.target.value)}
                  placeholder="org/repo or full URL"
                  maxLength={320}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90 font-mono text-xs"
                />
              </div>
              <div className="md:col-span-1">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Branch
                </label>
                <Input
                  value={comBranch}
                  onChange={(e) => setComBranch(e.target.value)}
                  placeholder="main / feature/…"
                  maxLength={200}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90 font-mono text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Commit SHA
                </label>
                <Input
                  value={comSha}
                  onChange={(e) => setComSha(e.target.value)}
                  placeholder="full or short sha"
                  maxLength={64}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90 font-mono text-xs"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                  Body (optional)
                </label>
                <Textarea
                  value={comBody}
                  onChange={(e) => setComBody(e.target.value)}
                  placeholder="Optional notes, e.g. linked tasks, breaking changes, review focus"
                  maxLength={5000}
                  rows={3}
                  className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                disabled={!commitFormReady || create.isPending}
                onClick={() =>
                  create.mutate({
                    projectId: Number(comProjectId),
                    kind: "commit",
                    title: comTitle.trim(),
                    body: comBody.trim() || undefined,
                    repository: comRepo.trim(),
                    sha: comSha.trim(),
                    branch: comBranch.trim() || undefined,
                  })
                }
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_28px_-10px_rgba(255,134,46,0.7)]"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className={create.isPending ? "ml-2" : ""}>Record commit</span>
              </Button>
            </div>
          </GlassCard>

          <SectionStateSwitch
            loading={submissionsQuery.isLoading}
            error={submissionsQuery.error}
            onRetry={() => submissionsQuery.refetch()}
            data={commitRows}
            isEmpty={(d) => (d?.length ?? 0) === 0}
            emptyIcon={<GitCommit className="h-5 w-5" />}
            emptyTitle="No commits reported yet"
            emptyBody="Record commit metadata for any assigned project so the engineering desk can trace your work."
            skeletonRows={3}
          />

          {commitRows.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {commitRows.map((row) => (
                <GlassCard key={row.id} className="p-4 md:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="border-white/10 bg-white/[0.02] text-white/60 text-[10px] uppercase tracking-wider"
                      >
                        Project #{row.projectId}
                      </Badge>
                      <StatusPill status={row.status.replace("_", " ")} variant={statusVariant(row.status)} />
                      {row.repository && (
                        <a
                          href={row.repository.startsWith("http") ? row.repository : `https://github.com/${row.repository}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-orange-200 hover:text-orange-100"
                        >
                          {row.repository}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm md:text-base font-semibold text-white truncate">
                      {row.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-white/45 font-mono">
                      {row.branch ? `${row.branch} · ` : ""}
                      {row.sha?.slice(0, 12)}
                    </p>
                    {row.body && (
                      <p className="mt-2 text-sm text-white/60 line-clamp-2">{row.body}</p>
                    )}
                    <p className="mt-1 text-[11px] text-white/40">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
