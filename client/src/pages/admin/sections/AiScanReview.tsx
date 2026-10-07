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
                  {r.reportStatus === "approved" && <SmallButton onClick={() => go(r.id, "published")}>Publish</SmallButton>}
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
