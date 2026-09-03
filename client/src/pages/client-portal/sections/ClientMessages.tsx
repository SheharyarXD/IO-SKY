/*
 * IO SKY — Client Portal · Messages
 *
 * What this view does:
 *   • Threaded inbox with the IO SKY operating team. Messages from the team
 *     and from the client are colour-coded; unread inbound messages get a
 *     subtle pulse until the user opens this section.
 *   • On mount we fire trpc.clientPortal.markMessagesRead so the bell and
 *     dashboard unread counters drop to zero.
 *   • Compose form sends through trpc.clientPortal.sendMessage which audits,
 *     writes a notification and pings the IO SKY team via notifyOwner.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "../components/PortalUI";

type Message = {
  id: number;
  organizationId: number;
  threadKey: string;
  sender: "io-sky" | "client" | string;
  senderName: string | null;
  subject: string | null;
  body: string;
  readAt: number | null;
  createdAt: Date | string;
};

function formatTimestamp(ts: Date | string | number) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString();
}

export default function ClientMessages() {
  const utils = trpc.useUtils();
  const messages = trpc.clientPortal.messages.useQuery();
  const list = (messages.data ?? []) as Message[];

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Mark inbound messages as read once when this section is opened.
  const markRead = trpc.clientPortal.markMessagesRead.useMutation({
    onSuccess: () => {
      utils.clientPortal.dashboard.invalidate();
      utils.clientPortal.messages.invalidate();
    },
  });
  const markedRef = useRef(false);
  useEffect(() => {
    if (markedRef.current) return;
    markedRef.current = true;
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = trpc.clientPortal.sendMessage.useMutation({
    onSuccess: () => {
      utils.clientPortal.messages.invalidate();
      utils.clientPortal.dashboard.invalidate();
      toast.success("Message sent", {
        description: "Your IO SKY operating partner has been notified.",
      });
      setSubject("");
      setBody("");
    },
    onError: err => {
      toast.error("Couldn't send message", {
        description: err.message ?? "Please try again.",
      });
    },
  });

  // Sort oldest → newest so the timeline reads naturally.
  const ordered = useMemo(() => {
    return [...list].sort((a, b) => {
      const av = new Date(a.createdAt as string).getTime();
      const bv = new Date(b.createdAt as string).getTime();
      return av - bv;
    });
  }, [list]);

  // Scroll the conversation to the latest message after each refresh.
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [ordered.length]);

  const onSend = () => {
    const trimmed = body.trim();
    if (trimmed.length < 2) {
      toast.error("Please write a message before sending.");
      return;
    }
    send.mutate({
      threadKey: "general",
      subject: subject.trim() || null,
      body: trimmed,
    });
  };

  return (
    <>
      <SectionHeader
        eyebrow="Messages"
        title="Private channel with your IO SKY team"
        description="Secure, audited communication with your account manager and the operational team."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div>
          <SectionStateSwitch
            loading={messages.isLoading}
            error={messages.error}
            onRetry={() => messages.refetch()}
            data={ordered}
            isEmpty={d => d.length === 0}
            emptyIcon={<Mail className="h-5 w-5" />}
            emptyTitle="No messages yet"
            emptyBody="Send your first message — we usually reply within one business hour."
            skeletonRows={5}
          />

          {!messages.isLoading && !messages.error && ordered.length > 0 && (
            <div
              ref={listRef}
              className="space-y-3 max-h-[640px] overflow-y-auto pr-1"
            >
              {ordered.map(m => {
                const isClient = m.sender === "client";
                const unread = !isClient && !m.readAt;
                return (
                  <GlassCard
                    key={m.id}
                    className={`p-5 ${
                      unread ? "ring-1 ring-orange-400/40" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`h-9 w-9 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ring-1 ${
                          isClient
                            ? "bg-white/[0.04] ring-white/15 text-white/70"
                            : "bg-orange-500/15 ring-orange-500/30 text-orange-200"
                        }`}
                      >
                        {(m.senderName ?? (isClient ? "Y" : "IO"))
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">
                            {m.senderName ??
                              (isClient ? "You" : "IO SKY Team")}
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-white/35">
                              {isClient ? "outbound" : "inbound"}
                            </span>
                          </p>
                          <span className="text-[10px] uppercase tracking-wider text-white/45">
                            {formatTimestamp(m.createdAt)}
                          </span>
                        </div>
                        {m.subject && (
                          <p className="text-[12px] text-orange-300/80 font-medium mt-0.5">
                            {m.subject}
                          </p>
                        )}
                        <p className="text-sm text-white/75 mt-2 whitespace-pre-line leading-relaxed">
                          {m.body}
                        </p>
                        {!isClient && (
                          <p className="mt-2 text-[10px] text-white/35">
                            {m.readAt
                              ? `Read ${formatTimestamp(m.readAt)}`
                              : "New"}
                          </p>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>

        <GlassCard className="p-5 self-start lg:sticky lg:top-24">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
            Compose
          </p>
          <h3 className="text-base font-semibold text-white mt-1">
            Send a secure message
          </h3>

          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            maxLength={200}
            className="mt-4 bg-white/[0.02] border-white/10 text-white placeholder:text-white/35"
          />
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="What can our team help with?"
            maxLength={4000}
            className="mt-3 bg-white/[0.02] border-white/10 text-white placeholder:text-white/35 min-h-[140px]"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
            <span>{body.length} / 4000</span>
            <span className="uppercase tracking-wider">Encrypted in transit</span>
          </div>
          <Button
            onClick={onSend}
            // Milestone 3 (RM-105): also disabled while the composer is empty.
            // `onSend` already refused a body under 2 characters, and the
            // server's zod schema enforces the same minimum — but the only way
            // to discover that was to click and receive an error toast. This
            // makes the existing guard visible instead of punitive, and matches
            // the Login form, which likewise disables submit until valid.
            disabled={send.isPending || body.trim().length < 2}
            className="mt-3 w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            {send.isPending ? "Sending…" : "Send message"}
          </Button>
          <p className="mt-3 text-[11px] text-white/40">
            Messages are end-to-end logged and auditable. Mean response time:
            under 1 hour during business days.
          </p>
        </GlassCard>
      </div>
    </>
  );
}
