import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { LifeBuoy, Send } from "lucide-react";
import { GlassCard, EmptyState, PortalSkeleton, SectionHeader, StatusPill } from "../components/PortalUI";

const PRIORITIES = [
  { value: "low", label: "Low — general question" },
  { value: "normal", label: "Normal — within 4 hours" },
  { value: "high", label: "High — operational impact" },
  { value: "urgent", label: "Urgent — production incident" },
] as const;

export default function ClientSupport() {
  const utils = trpc.useUtils();
  const tickets = trpc.clientPortal.tickets.useQuery();
  const create = trpc.clientPortal.createTicket.useMutation({
    onSuccess: () => {
      utils.clientPortal.tickets.invalidate();
      toast.success("Ticket opened. Our concierge desk has been paged.");
      setSubject("");
      setBody("");
      setPriority("normal");
    },
    onError: err => toast.error(err.message || "Could not open ticket"),
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  const list = tickets.data ?? [];

  return (
    <>
      <SectionHeader
        eyebrow="Support"
        title="Concierge support desk"
        description="Open a ticket, track its status and access our knowledge base. Urgent issues page the on-call team."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div>
          {tickets.isLoading ? (
            <PortalSkeleton rows={4} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="h-5 w-5" />}
              title="No open tickets"
              body="Open a ticket on the right whenever you need our team."
            />
          ) : (
            <ul className="space-y-3">
              {list.map(t => (
                <GlassCard key={t.id} className="p-5" interactive>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white">{t.subject}</p>
                      <p className="text-[11px] text-white/45 mt-0.5">
                        Opened {new Date(t.createdAt as unknown as string).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill
                        status={t.priority}
                        variant={
                          t.priority === "urgent"
                            ? "danger"
                            : t.priority === "high"
                              ? "warn"
                              : t.priority === "normal"
                                ? "info"
                                : "neutral"
                        }
                      />
                      <StatusPill
                        status={t.status.replace("_", " ")}
                        variant={
                          t.status === "resolved"
                            ? "good"
                            : t.status === "closed"
                              ? "neutral"
                              : "info"
                        }
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/70 leading-relaxed">{t.body}</p>
                  <p className="mt-2 text-[10px] text-orange-200/70 font-mono">{t.publicRef}</p>
                </GlassCard>
              ))}
            </ul>
          )}
        </div>

        <GlassCard className="p-5 self-start sticky top-24">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">New ticket</p>
          <h3 className="text-base font-semibold text-white mt-1">Open a support ticket</h3>

          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="mt-4 bg-white/[0.02] border-white/10 text-white placeholder:text-white/35"
          />
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Describe what's happening, with as much detail as possible…"
            className="mt-3 bg-white/[0.02] border-white/10 text-white placeholder:text-white/35 min-h-[140px]"
          />
          <div className="mt-3">
            <Select value={priority} onValueChange={v => setPriority(v as typeof priority)}>
              <SelectTrigger className="bg-white/[0.02] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a1020] border-white/10 text-white">
                {PRIORITIES.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              if (!subject.trim() || !body.trim()) {
                toast.error("Please fill subject and description.");
                return;
              }
              create.mutate({ subject: subject.trim(), body: body.trim(), priority });
            }}
            disabled={create.isPending}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            {create.isPending ? "Opening ticket…" : "Open ticket"}
          </Button>
          <p className="mt-3 text-[11px] text-white/40">
            Urgent tickets page the on-call team immediately. All others are responded to within four business hours.
          </p>
        </GlassCard>
      </div>
    </>
  );
}
