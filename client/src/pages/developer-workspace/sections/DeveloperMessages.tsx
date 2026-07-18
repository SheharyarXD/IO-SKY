/*
 * IO SKY — Developer Workspace · Messages.
 *
 * Direct line to the engineering desk only — by design there is no path
 * from this surface to a client conversation. Every inbound message
 * shows an Unread/Read receipt, the section auto-calls `markMessagesRead`
 * on mount, and outbound messages audit on the server and trigger an
 * admin notification.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "@/pages/client-portal/components/PortalUI";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, CheckCheck, Circle, Loader2 } from "lucide-react";

function formatTimestamp(value: number | string | Date) {
  return new Date(value).toLocaleString();
}

export default function DeveloperMessages() {
  const utils = trpc.useUtils();
  const messagesQuery = trpc.developer.listMessages.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const markRead = trpc.developer.markMessagesRead.useMutation({
    onSuccess: () => {
      utils.developer.listMessages.invalidate();
      utils.developer.dashboard.invalidate();
    },
  });

  const sendMessage = trpc.developer.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Message sent");
      setSubject("");
      setBody("");
      utils.developer.listMessages.invalidate();
      utils.developer.dashboard.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not send message");
    },
  });

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-flag every inbound message as read once on mount.
  const hasMarkedRef = useRef(false);
  useEffect(() => {
    if (hasMarkedRef.current) return;
    if (!messagesQuery.data) return;
    const hasUnreadInbound = messagesQuery.data.some(
      (m) => m.sender === "admin" && !m.readAt,
    );
    if (hasUnreadInbound) {
      hasMarkedRef.current = true;
      markRead.mutate();
    }
  }, [messagesQuery.data, markRead]);

  // Sort oldest -> newest so the latest is at the bottom (chat-style).
  const sorted = useMemo(() => {
    const data = messagesQuery.data ?? [];
    return [...data].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesQuery.data]);

  // Auto-scroll on new messages.
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [sorted.length]);

  return (
    <div>
      <SectionHeader
        eyebrow="Communication"
        title="Messages"
        description="Direct line to the IO SKY engineering desk. Direct client communication is intentionally not available from this workspace."
      />

      <SectionStateSwitch
        loading={messagesQuery.isLoading}
        error={messagesQuery.error}
        onRetry={() => messagesQuery.refetch()}
        data={messagesQuery.data ?? []}
        isEmpty={(d) => (d?.length ?? 0) === 0}
        emptyIcon={<MessageSquare className="h-5 w-5" />}
        emptyTitle="No messages yet"
        emptyBody="When the engineering desk reaches out you'll see the thread here. You can also start one below."
        skeletonRows={4}
      />

      {messagesQuery.data && messagesQuery.data.length > 0 && (
        <GlassCard className="p-0 overflow-hidden">
          <div
            ref={listRef}
            className="max-h-[440px] overflow-y-auto px-5 py-5 space-y-3"
          >
            {sorted.map((msg) => {
              const inbound = msg.sender === "admin";
              return (
                <div
                  key={msg.id}
                  className={[
                    "flex",
                    inbound ? "justify-start" : "justify-end",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-xl px-4 py-3 border",
                      inbound
                        ? "border-white/10 bg-white/[0.04] text-white/85"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-50",
                    ].join(" ")}
                  >
                    {msg.subject && (
                      <p className="text-[11px] uppercase tracking-wider font-semibold mb-1 opacity-75">
                        {msg.subject}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.body}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] opacity-60">
                      <span>
                        {inbound ? "Engineering desk" : "You"} ·{" "}
                        {formatTimestamp(msg.createdAt)}
                      </span>
                      {inbound && (
                        <span className="inline-flex items-center gap-1">
                          {msg.readAt ? (
                            <CheckCheck className="h-3 w-3" />
                          ) : (
                            <Circle className="h-3 w-3" />
                          )}
                          {msg.readAt ? "Read" : "Unread"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="p-5 mt-5">
        <h3 className="text-sm font-semibold tracking-tight text-white">
          Send a message to the engineering desk
        </h3>
        <p className="mt-1 text-xs text-white/55">
          Subject is optional. Use this for delivery questions, blocking
          dependencies, or process clarifications.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (optional)"
            maxLength={200}
            className="bg-white/[0.02] border-white/10 text-white/90"
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            maxLength={5000}
            rows={5}
            className="bg-white/[0.02] border-white/10 text-white/90"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-white/40">
              {body.length}/5000
            </span>
            <Button
              disabled={body.trim().length === 0 || sendMessage.isPending}
              onClick={() =>
                sendMessage.mutate({
                  subject: subject.trim() || undefined,
                  body: body.trim(),
                })
              }
              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_28px_-10px_rgba(255,134,46,0.7)]"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Send message</span>
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
