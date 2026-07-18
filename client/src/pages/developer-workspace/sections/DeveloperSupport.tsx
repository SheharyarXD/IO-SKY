/*
 * IO SKY — Developer Workspace · Support.
 *
 * Lets a developer raise a support ticket scoped to engineering topics.
 * The server validates and audits, generates a public reference (ENG-…),
 * and pings the IO SKY desk. Existing tickets are not yet exposed on a
 * read query (no `listSupportTickets` for developers in this iteration);
 * the developer gets a confirmation toast with the public reference so
 * they can quote it via Messages.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
} from "@/pages/client-portal/components/PortalUI";
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
import { LifeBuoy, Loader2, Send } from "lucide-react";

type Category = "technical" | "access" | "agreements" | "billing" | "general";
type Priority = "low" | "normal" | "high" | "urgent";

export default function DeveloperSupport() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<Priority>("normal");

  const create = trpc.developer.createSupportTicket.useMutation({
    onSuccess: (ticket) => {
      const ref = (ticket as { publicRef?: string } | null)?.publicRef ?? "";
      toast.success(
        ref
          ? `Ticket opened — reference ${ref}`
          : "Ticket opened — engineering desk notified",
      );
      setSubject("");
      setBody("");
      setCategory("general");
      setPriority("normal");
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not open ticket");
    },
  });

  const ready = subject.trim().length >= 3 && body.trim().length >= 8;

  return (
    <div>
      <SectionHeader
        eyebrow="Help"
        title="Support"
        description="Open a ticket for delivery, access, agreements, billing or general engineering questions. Each ticket is logged and routed to the IO SKY engineering desk."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            New ticket
          </h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                Category
              </label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="mt-1 bg-white/[0.02] border-white/10 text-white/85">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1020] border-white/10">
                  <SelectItem value="technical" className="text-white/85">Technical</SelectItem>
                  <SelectItem value="access" className="text-white/85">Access</SelectItem>
                  <SelectItem value="agreements" className="text-white/85">Agreements</SelectItem>
                  <SelectItem value="billing" className="text-white/85">Billing</SelectItem>
                  <SelectItem value="general" className="text-white/85">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                Priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="mt-1 bg-white/[0.02] border-white/10 text-white/85">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a1020] border-white/10">
                  <SelectItem value="low" className="text-white/85">Low</SelectItem>
                  <SelectItem value="normal" className="text-white/85">Normal</SelectItem>
                  <SelectItem value="high" className="text-white/85">High</SelectItem>
                  <SelectItem value="urgent" className="text-white/85">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary (3+ chars)"
                maxLength={200}
                className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
                Details
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe the question or issue. Reference projects, files or task IDs where helpful (8+ chars)."
                maxLength={5000}
                rows={6}
                className="mt-1 bg-white/[0.02] border-white/10 text-white/90"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[11px] text-white/40">
              {body.length}/5000
            </span>
            <Button
              disabled={!ready || create.isPending}
              onClick={() =>
                create.mutate({
                  subject: subject.trim(),
                  body: body.trim(),
                  category,
                  priority,
                })
              }
              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_18px_-8px_rgba(255,134,46,0.7)]"
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Open ticket</span>
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/25 text-orange-300">
            <LifeBuoy className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-semibold tracking-tight text-white">
            What support covers
          </h3>
          <ul className="mt-2 space-y-2 text-xs text-white/65 list-disc pl-5">
            <li>Workspace access, MFA enrolment, agreement signing</li>
            <li>Delivery questions and unblockers per project</li>
            <li>File / signed-URL / repository scope issues</li>
            <li>Contractor billing and invoice questions</li>
          </ul>
          <p className="mt-4 text-xs text-white/45">
            Direct client communication is intentionally not available
            from this workspace. Escalate via Support and the engineering
            desk will route on your behalf.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
