/*
 * IO SKY — Client Portal · Approvals (BR-019, SRS 15.13).
 *
 * A project phase or milestone that needs the customer's sign off before work
 * continues. Rejecting requires saying what needs to change.
 */
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, GlassCard, PortalSkeleton, SectionHeader, StatusPill } from "../components/PortalUI";

const variant = (s: string) => (s === "approved" ? "good" : s === "rejected" ? "danger" : "warn");

export default function ClientApprovals() {
  const utils = trpc.useUtils();
  const q = trpc.clientPortal.approvals.useQuery();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const decide = trpc.clientPortal.decideApproval.useMutation({
    onSuccess: () => {
      utils.clientPortal.approvals.invalidate();
      toast.success("Your decision has been recorded.");
    },
    onError: (e) => toast.error(e.message || "Could not record your decision."),
  });
  const list = q.data ?? [];
  const pending = list.filter((a) => a.status === "pending");
  const decided = list.filter((a) => a.status !== "pending");

  return (
    <>
      <SectionHeader eyebrow="Projects" title="Approvals" description="Some project phases need your sign off before we continue. Review each request and approve it, or tell us what to change." />
      {q.isLoading ? (
        <PortalSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Nothing needs your approval" body="When a phase is ready for your sign off it will appear here." />
      ) : (
        <div className="space-y-4">
          {pending.map((a) => (
            <GlassCard key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/50">{a.projectName}</div>
                  <h3 className="mt-0.5 text-[15px] font-medium text-white">{a.title}</h3>
                  {a.description ? <p className="mt-1 text-[13px] text-white/65 whitespace-pre-wrap">{a.description}</p> : null}
                </div>
                <StatusPill status="awaiting you" variant="warn" />
              </div>
              <label htmlFor={`n-${a.id}`} className="mt-4 block text-[11px] uppercase tracking-wider text-white/55">Note (required if you reject)</label>
              <Textarea id={`n-${a.id}`} value={notes[a.id] ?? ""} maxLength={1000} onChange={(e) => setNotes((s) => ({ ...s, [a.id]: e.target.value }))} />
              <div className="mt-3 flex gap-2">
                <Button disabled={decide.isPending} onClick={() => decide.mutate({ id: a.id, decision: "approved", note: notes[a.id]?.trim() || undefined })}>Approve</Button>
                <Button
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => {
                    const note = notes[a.id]?.trim();
                    if (!note) return toast.error("Please say what needs to change.");
                    decide.mutate({ id: a.id, decision: "rejected", note });
                  }}
                >
                  Request changes
                </Button>
              </div>
            </GlassCard>
          ))}
          {decided.length > 0 ? (
            <GlassCard className="p-5">
              <h3 className="text-[13px] font-medium text-white/80">Previous decisions</h3>
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {decided.map((a) => (
                  <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-white/85">{a.projectName}: {a.title}</span>
                    <StatusPill status={a.status} variant={variant(a.status)} />
                  </li>
                ))}
              </ul>
            </GlassCard>
          ) : null}
        </div>
      )}
    </>
  );
}
