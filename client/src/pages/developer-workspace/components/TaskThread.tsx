/*
 * IO SKY — Developer Workspace · task notes and clarification requests (SRS 11.7).
 *
 * A progress note or comment is recorded on the task. A clarification request
 * also lands in the admin notification feed, so a question is never left
 * waiting in a thread nobody opens.
 */
import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  { value: "progress_note", label: "Progress note" },
  { value: "comment", label: "Comment" },
  { value: "clarification_request", label: "Ask for clarification" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

export default function TaskThread({ taskId, canWrite }: { taskId: number; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("progress_note");
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();
  const q = trpc.developer.taskComments.useQuery({ taskId }, { enabled: open, retry: false });
  const add = trpc.developer.addTaskComment.useMutation({
    onSuccess: () => {
      utils.developer.taskComments.invalidate({ taskId });
      setBody("");
      toast.success(kind === "clarification_request" ? "Your question was sent to the engineering desk." : "Saved.");
    },
    onError: (e) => toast.error(e.message || "Could not save that."),
  });

  return (
    <div className="mt-1 px-1">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        {open ? "Hide notes" : "Notes and questions"}
      </button>
      {open ? (
        <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          {q.isLoading ? (
            <p className="text-[12px] text-white/50">Loading…</p>
          ) : q.error ? (
            <p className="text-[12px] text-white/50">You can read the thread only on tasks assigned to you.</p>
          ) : (
            <ul className="space-y-2">
              {(q.data ?? []).length === 0 ? <li className="text-[12px] text-white/50">No notes yet.</li> : null}
              {(q.data ?? []).map((c) => (
                <li key={c.id} className="text-[12.5px]">
                  <span className="text-[10px] uppercase tracking-wider text-white/45">
                    {c.developerId ? "You" : "IO SKY"} · {c.kind.replace(/_/g, " ")} · {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap text-white/85">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          {canWrite ? (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (body.trim()) add.mutate({ taskId, kind, body: body.trim() });
              }}
            >
              <label className="sr-only" htmlFor={`k-${taskId}`}>Type</label>
              <select id={`k-${taskId}`} value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="rounded-md bg-[#103438] border border-white/10 px-2 py-1 text-[12px]">
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor={`b-${taskId}`}>Message</label>
              <Textarea id={`b-${taskId}`} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} placeholder="What is the status, or what do you need to know?" />
              <Button type="submit" size="sm" disabled={add.isPending || !body.trim()}>{add.isPending ? "Saving…" : "Post"}</Button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
