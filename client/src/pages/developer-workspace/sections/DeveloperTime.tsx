/*
 * IO SKY — Developer Workspace · Time registration (SRS 11.8).
 *
 * A developer logs time against a project they are assigned to. The server
 * enforces that (BR-018), bounds the date, and an admin reviews each entry.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, GlassCard, SectionHeader, StatusPill } from "@/pages/client-portal/components/PortalUI";

const variant = (s: string) => (s === "approved" ? "good" : s === "rejected" ? "danger" : "warn");
const hm = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

export default function DeveloperTime() {
  const utils = trpc.useUtils();
  const projects = trpc.developer.listProjects.useQuery();
  const entries = trpc.developer.myTimeEntries.useQuery();
  const today = new Date().toISOString().slice(0, 10);
  const [projectId, setProjectId] = useState("");
  const [workDate, setWorkDate] = useState(today);
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [note, setNote] = useState("");

  const log = trpc.developer.logTime.useMutation({
    onSuccess: () => {
      utils.developer.myTimeEntries.invalidate();
      toast.success("Time recorded. It will be reviewed by the engineering coordinator.");
      setNote("");
    },
    onError: (e) => toast.error(e.message || "Could not record the time."),
  });

  const total = Number(hours) * 60 + Number(minutes);
  const list = entries.data ?? [];
  const projectList = (projects.data as Array<{ id: number; code: string; name: string }> | undefined) ?? [];

  return (
    <>
      <SectionHeader eyebrow="Time" title="Time registration" description="Log the time you spent on a project you are assigned to. Entries can be back dated by up to 31 days." />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
        <div>
          {list.length === 0 ? (
            <EmptyState icon={<Clock className="h-5 w-5" />} title="No time logged yet" body="Record your first entry on the right." />
          ) : (
            <GlassCard>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/45">
                    <th className="p-3 font-normal">Date</th>
                    <th className="p-3 font-normal">Project</th>
                    <th className="p-3 font-normal text-right">Time</th>
                    <th className="p-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className="border-t border-white/[0.06]">
                      <td className="p-3">{e.workDate}</td>
                      <td className="p-3">{e.projectCode}</td>
                      <td className="p-3 text-right">{hm(e.minutes)}</td>
                      <td className="p-3">
                        <StatusPill status={e.status} variant={variant(e.status)} />
                        {e.status === "rejected" && e.reviewNote ? <div className="mt-1 text-[11.5px] text-white/50">{e.reviewNote}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}
        </div>
        <GlassCard className="p-5">
          <form
            className="space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              log.mutate({ projectId: Number(projectId), workDate, minutes: total, note: note.trim() || undefined });
            }}
          >
            <div>
              <label htmlFor="t-project" className="text-[11px] uppercase tracking-wider text-white/55">Project</label>
              <select id="t-project" required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded-md bg-[#103438] border border-white/10 px-2.5 py-2 text-[13px]">
                <option value="">Choose a project</option>
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="t-date" className="text-[11px] uppercase tracking-wider text-white/55">Date</label>
              <Input id="t-date" type="date" max={today} required value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="t-h" className="text-[11px] uppercase tracking-wider text-white/55">Hours</label>
                <Input id="t-h" type="number" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div>
                <label htmlFor="t-m" className="text-[11px] uppercase tracking-wider text-white/55">Minutes</label>
                <Input id="t-m" type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="t-note" className="text-[11px] uppercase tracking-wider text-white/55">What you worked on</label>
              <Textarea id="t-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
            </div>
            <Button type="submit" disabled={log.isPending || !projectId || total < 1}>{log.isPending ? "Saving…" : "Log time"}</Button>
          </form>
        </GlassCard>
      </div>
    </>
  );
}
