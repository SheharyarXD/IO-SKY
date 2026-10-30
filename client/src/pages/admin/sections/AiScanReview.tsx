/*
 * IO SKY — Admin Portal · AI Scan expert review (SRS 9.6, BR-009, BR-016).
 *
 * The engine only ever hands a report to this queue. A person assigns it,
 * approves it or sends it back with a note, and a person publishes it. Nothing
 * is visible to the customer before that.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { REPORT_STATUSES } from "@shared/srsRules";
import { DataTable, StatusPill } from "./_shared/OperationalPage";
import { Panel, SmallButton, shortDateTime } from "./_shared/Forms";

const tone = (s: string) => (s === "published" ? "ok" : s === "revision_required" ? "warn" : s === "approved" ? "info" : s === "archived" ? "muted" : "warn");
const label = (s: string) => s.replace(/_/g, " ");

function VersionsPanel({ scanId }: { scanId: number }) {
  const versions = trpc.adminOps.aiScanVersions.useQuery({ scanId });
  const [from, setFrom] = useState<number | null>(null);
  const [to, setTo] = useState<number | null>(null);
  const cmp = trpc.adminOps.compareAiScanVersions.useQuery({ scanId, from: from ?? 1, to: to ?? 1 }, { enabled: from !== null && to !== null && from !== to });
  const rows = versions.data ?? [];
  const sel = "h-8 rounded-md border border-white/[0.1] bg-transparent px-2 text-[12px]";
  const pick = (value: number | null, set: (v: number | null) => void, label: string) => (
    <select className={sel} aria-label={label} value={value ?? ""} onChange={(e) => set(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{label}</option>
      {rows.map((v) => (
        <option key={v.version} value={v.version}>
          v{v.version}
        </option>
      ))}
    </select>
  );
  const c = cmp.data;
  return (
    <Panel title={`Report versions for SCN-${scanId}`}>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-white/55">No versions are kept for this scan yet. Each report the engine produces from now on is kept here.</p>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-1 text-[12.5px]">
            {rows.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center gap-2">
                <span className="font-mono">v{v.version}</span>
                <span className="text-white/55">{shortDateTime(v.createdAt)}</span>
                {v.overallScore !== null ? <span>score {v.overallScore}</span> : null}
                {v.published ? <StatusPill tone="ok" label="published" /> : null}
                {v.approvals.length > 0 ? <StatusPill tone="info" label={`approved by user #${v.approvals[v.approvals.length - 1].byUserId ?? "?"}`} /> : null}
                {v.revisionRequests.length > 0 ? <StatusPill tone="warn" label="revision requested" /> : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {pick(from, setFrom, "From version")}
            {pick(to, setTo, "To version")}
          </div>
          {c ? (
            <div className="space-y-1 text-[12.5px]">
              {c.identical ? (
                <p>These versions are identical.</p>
              ) : (
                <p className="text-white/65">
                  {c.changes} difference{c.changes === 1 ? "" : "s"}. Score {c.score.from} to {c.score.to} ({c.score.delta >= 0 ? "+" : ""}
                  {c.score.delta}){c.grade.changed ? `, grade ${c.grade.from} to ${c.grade.to}` : ""}.
                </p>
              )}
              {c.dimensions.map((d) => (
                <p key={d.dimension}>
                  {d.dimension}: {d.from ?? "n/a"} to {d.to ?? "n/a"}
                  {d.rationaleChanged ? " (reasoning changed)" : ""}
                </p>
              ))}
              {c.summary.identical ? null : (
                <pre className="max-h-48 overflow-auto rounded border border-white/10 p-2 text-[12px]">
                  {c.summary.ops.map((o, i) => (
                    <div key={i} className={o.type === "added" ? "text-emerald-200" : o.type === "removed" ? "text-red-200" : "text-white/55"}>
                      {o.type === "added" ? "+ " : o.type === "removed" ? "- " : "  "}
                      {o.text}
                    </div>
                  ))}
                </pre>
              )}
              {c.opportunities.added.map((t) => (
                <p key={`a${t}`} className="text-emerald-200">
                  + Opportunity: {t}
                </p>
              ))}
              {c.opportunities.removed.map((t) => (
                <p key={`r${t}`} className="text-red-200">
                  - Opportunity: {t}
                </p>
              ))}
              {c.opportunities.changed.map((o) => (
                <p key={`c${o.title}`}>
                  ~ {o.title}: {o.fields.join(", ")} changed
                </p>
              ))}
              {c.roadmap.map((r) => (
                <p key={r.horizon}>
                  Roadmap {r.horizon}: +{r.added.length} / -{r.removed.length}
                </p>
              ))}
              {c.disclaimersChanged ? <p>Disclaimers changed.</p> : null}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function AiScanReview() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<string>("active");
  const statuses =
    filter === "active"
      ? (["awaiting_expert_review", "revision_required", "approved"] as const)
      : filter === "all"
        ? REPORT_STATUSES
        : ([filter] as unknown as typeof REPORT_STATUSES);
  const q = trpc.adminOps.aiScanReviewQueue.useQuery({ statuses: [...statuses] });
  const [open, setOpen] = useState<number | null>(null);
  const history = trpc.adminOps.aiScanHistory.useQuery({ scanId: open ?? 1 }, { enabled: open !== null });
  const refresh = () => utils.adminOps.aiScanReviewQueue.invalidate();
  const move = trpc.adminOps.moveAiScanReport.useMutation({ onSuccess: refresh });
  const perms = trpc.adminOps.myReportPermissions.useQuery(undefined, { staleTime: 60_000 });
  const canPublish = perms.data?.canPublish === true;
  const assign = trpc.adminOps.assignAiScanReviewer.useMutation({ onSuccess: refresh });
  const regen = trpc.adminOps.regenerateAiScanReport.useMutation({ onSuccess: refresh });

  const go = (scanId: number, to: "approved" | "revision_required" | "published" | "archived") => {
    let note: string | undefined;
    if (to === "revision_required") {
      const n = window.prompt("What needs to change in this report?");
      if (!n?.trim()) return;
      note = n.trim();
    }
    if (to === "published" && !window.confirm("Publish this report? The customer is emailed a link and can read it immediately.")) return;
    move.mutateAsync({ scanId, to, note }).then(() => toast.success(`Report ${label(to)}.`)).catch((e) => toast.error(e.message));
  };

  type Row = NonNullable<typeof q.data>[number];
  return (
    <>
      <Panel
        title="Reports in review"
        action={
          <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)} className="px-2 py-1 rounded-[8px] bg-[#103438] border border-white/[0.08] text-[12px]">
            <option value="active">Needs a decision</option>
            <option value="all">All statuses</option>
            {REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
          </select>
        }
      >
        <DataTable
          columns={[
            { key: "id", header: "Ref", width: "64px", render: (r: Row) => <span className="font-mono text-white/55">SCN-{r.id}</span> },
            { key: "company", header: "Customer", render: (r: Row) => r.company || r.fullName },
            { key: "tier", header: "Tier" },
            { key: "reportStatus", header: "Status", render: (r: Row) => <StatusPill tone={tone(r.reportStatus) as never} label={label(r.reportStatus)} /> },
            { key: "reviewerUserId", header: "Reviewer", render: (r: Row) => (r.reviewerUserId ? `user #${r.reviewerUserId}` : <span className="text-white/40">unassigned</span>) },
            {
              key: "actions",
              header: "",
              render: (r: Row) => (
                <div className="flex flex-wrap gap-1">
                  {user && r.reviewerUserId !== user.id && r.reportStatus === "awaiting_expert_review" && <SmallButton onClick={() => assign.mutateAsync({ scanId: r.id, reviewerUserId: user.id }).then(() => toast.success("Assigned to you."))}>Take</SmallButton>}
                  {r.reportStatus === "awaiting_expert_review" && <SmallButton onClick={() => go(r.id, "approved")}>Approve</SmallButton>}
                  {(r.reportStatus === "awaiting_expert_review" || r.reportStatus === "approved") && <SmallButton tone="danger" onClick={() => go(r.id, "revision_required")}>Request revision</SmallButton>}
                  {r.reportStatus === "revision_required" && <SmallButton onClick={() => regen.mutateAsync({ scanId: r.id }).then(() => toast.success("Regenerating.")).catch((e) => toast.error(e.message))}>Regenerate</SmallButton>}
                  {r.reportStatus === "approved" && (canPublish ? <SmallButton onClick={() => go(r.id, "published")}>Publish</SmallButton> : <span className="text-[11px] text-white/45" title="Ask a super admin to grant you the publish right">Publish needs the publish right</span>)}
                  {r.reportStatus === "published" && <SmallButton onClick={() => go(r.id, "archived")}>Archive</SmallButton>}
                  <SmallButton onClick={() => setOpen(open === r.id ? null : r.id)}>History</SmallButton>
                </div>
              ),
            },
          ]}
          rows={q.data ?? []}
          emptyLabel="No reports in this state."
        />
      </Panel>
      {open !== null ? <VersionsPanel scanId={open} /> : null}
      {open !== null ? (
        <Panel title={`History for SCN-${open}`}>
          <DataTable
            columns={[
              { key: "createdAt", header: "When", render: (r: NonNullable<typeof history.data>[number]) => shortDateTime(r.createdAt) },
              { key: "toStatus", header: "Moved to", render: (r: NonNullable<typeof history.data>[number]) => label(r.toStatus) },
              { key: "actorUserId", header: "By", render: (r: NonNullable<typeof history.data>[number]) => (r.actorUserId ? `user #${r.actorUserId}` : "system") },
              { key: "note", header: "Note" },
            ]}
            rows={history.data ?? []}
            emptyLabel="No history yet."
          />
        </Panel>
      ) : null}
      <p className="text-[11.5px] text-white/45">The engine can only send a report here. Approving, requesting a revision, publishing and archiving are manual steps, and each one is recorded with who did it.</p>
    </>
  );
}
