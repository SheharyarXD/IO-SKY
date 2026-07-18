/*
 * IO SKY — Client Portal · Discovery Calls
 *
 * Reads from listStrategyCallsForOrg (matched by member email). Surfaces:
 *   • Upcoming and past sessions with status pills
 *   • A live "Join" button that only enables 15 min before → 30 min after
 *     the slot start (so the client can't try to dial in arbitrarily)
 *   • "Reschedule" → routes to /book-strategy?reschedule=<publicRef>
 *   • "Cancel" → confirm dialog, calls trpc.clientPortal.cancelStrategyCall,
 *     audits + notifies the IO SKY team. Self-cancellation is blocked < 60 min
 *     before the slot (server-side guard).
 */
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarClock, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "../components/PortalUI";

type Call = {
  id: number;
  publicRef: string;
  serviceLabel: string;
  slotStart: Date | string;
  slotStartMs: number;
  durationMin: number;
  timezone: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | string;
  meetingUrl: string | null;
};

const STATUS_VARIANT: Record<
  string,
  "good" | "info" | "warn" | "danger" | "neutral"
> = {
  completed: "good",
  confirmed: "info",
  pending: "warn",
  cancelled: "danger",
  rescheduled: "warn",
};

function getMs(value: Call["slotStart"]): number {
  if (value instanceof Date) return value.getTime();
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function joinIsAvailable(call: Call): boolean {
  const ms = call.slotStartMs ?? getMs(call.slotStart);
  const start = ms;
  const end = ms + call.durationMin * 60_000;
  const now = Date.now();
  // 15 min before slot start until 30 min after the slot ends.
  return (
    now >= start - 15 * 60_000 &&
    now <= end + 30 * 60_000 &&
    call.status !== "cancelled"
  );
}

export default function ClientStrategyCalls() {
  const calls = trpc.clientPortal.strategyCalls.useQuery();
  const utils = trpc.useUtils();

  const list = (calls.data ?? []) as Call[];
  const upcoming = useMemo(
    () =>
      list
        .filter(c => getMs(c.slotStart) >= Date.now() && c.status !== "cancelled")
        .sort((a, b) => getMs(a.slotStart) - getMs(b.slotStart)),
    [list],
  );
  const past = useMemo(
    () =>
      list
        .filter(c => getMs(c.slotStart) < Date.now() || c.status === "cancelled")
        .sort((a, b) => getMs(b.slotStart) - getMs(a.slotStart)),
    [list],
  );

  const [confirmTarget, setConfirmTarget] = useState<Call | null>(null);
  const [reason, setReason] = useState("");

  const cancelCall = trpc.clientPortal.cancelStrategyCall.useMutation({
    onSuccess: async res => {
      await utils.clientPortal.strategyCalls.invalidate();
      await utils.clientPortal.notifications.invalidate().catch(() => {});
      toast.success("Strategy call cancelled", {
        description: `Reference ${res.publicRef} — your operating partner has been notified.`,
      });
      setConfirmTarget(null);
      setReason("");
    },
    onError: error => {
      toast.error("Couldn't cancel this call", {
        description: error.message ?? "Please try again in a moment.",
      });
    },
  });

  return (
    <>
      <SectionHeader
        eyebrow="Discovery Calls"
        title="Your operational alignment sessions"
        description="Past and upcoming discovery calls with your IO SKY team. Bookings sync automatically from /book-strategy."
        action={
          <Link href="/book-strategy">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              <CalendarClock className="h-4 w-4 mr-2" />
              Book new call
            </Button>
          </Link>
        }
      />

      <SectionStateSwitch
        loading={calls.isLoading}
        error={calls.error}
        onRetry={() => calls.refetch()}
        data={list}
        isEmpty={d => d.length === 0}
        emptyIcon={<CalendarClock className="h-5 w-5" />}
        emptyTitle="No discovery calls yet"
        emptyBody="Once you book your first call it will appear here, complete with rescheduling and cancellation controls."
        emptyAction={
          <Link href="/book-strategy">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              Book Discovery Call
            </Button>
          </Link>
        }
        skeletonRows={5}
      />

      {!calls.isLoading && !calls.error && list.length > 0 && (
        <div className="space-y-8">
          <section>
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">
              Upcoming
            </h3>
            {upcoming.length === 0 ? (
              <GlassCard className="p-5 text-sm text-white/55">
                No upcoming sessions. Book a new discovery call when you're
                ready.
              </GlassCard>
            ) : (
              <div className="space-y-3">
                {upcoming.map(c => (
                  <BookingRow
                    key={c.id}
                    c={c}
                    onCancelRequest={() => setConfirmTarget(c)}
                    cancelInFlight={
                      cancelCall.isPending && confirmTarget?.id === c.id
                    }
                  />
                ))}
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-3">
                Past sessions
              </h3>
              <div className="space-y-3">
                {past.map(c => (
                  <BookingRow key={c.id} c={c} muted />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <AlertDialog
        open={confirmTarget !== null}
        onOpenChange={open => {
          if (!open) {
            setConfirmTarget(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent className="bg-[#070b14] border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Cancel this discovery call?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/55">
              {confirmTarget && (
                <>
                  {confirmTarget.serviceLabel} on{" "}
                  {new Date(getMs(confirmTarget.slotStart)).toLocaleString()}.
                  Your IO SKY operating partner will be notified immediately.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="pt-1">
            <label className="text-[12px] uppercase tracking-[0.18em] text-white/45">
              Reason (optional)
            </label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Anything you want to share about why you're cancelling?"
              className="mt-2 bg-white/[0.03] border-white/10 text-white placeholder:text-white/35"
              rows={3}
              maxLength={500}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.04] border-white/15 text-white/85 hover:bg-white/[0.08] hover:text-white">
              Keep call
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-400 text-white"
              disabled={cancelCall.isPending}
              onClick={() => {
                if (!confirmTarget) return;
                cancelCall.mutate({
                  id: confirmTarget.id,
                  reason: reason.trim() || undefined,
                });
              }}
            >
              {cancelCall.isPending ? "Cancelling…" : "Cancel call"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BookingRow({
  c,
  muted,
  onCancelRequest,
  cancelInFlight,
}: {
  c: Call;
  muted?: boolean;
  onCancelRequest?: () => void;
  cancelInFlight?: boolean;
}) {
  const canJoin = !muted && joinIsAvailable(c);
  const minutesAway = Math.round((getMs(c.slotStart) - Date.now()) / 60_000);
  const variant = STATUS_VARIANT[c.status] ?? "info";

  return (
    <GlassCard className={"p-5 " + (muted ? "opacity-80" : "")}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-white">
              {c.serviceLabel}
            </p>
            <StatusPill status={c.status} variant={variant} />
          </div>
          <p className="text-[11px] text-white/50 mt-1">
            {new Date(getMs(c.slotStart)).toLocaleString()} · {c.durationMin} min ·{" "}
            {c.timezone}
          </p>
          <p className="text-[11px] text-orange-200/80 font-mono mt-1">
            {c.publicRef}
          </p>
        </div>
        {!muted && c.status !== "cancelled" && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {canJoin ? (
              <Button
                size="sm"
                className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                onClick={() => {
                  if (c.meetingUrl) {
                    window.open(c.meetingUrl, "_blank", "noopener,noreferrer");
                  } else {
                    toast.info("Meeting room", {
                      description:
                        "Your IO SKY operating partner will share the join link by email shortly before the call.",
                    });
                  }
                }}
              >
                Join
              </Button>
            ) : (
              <Button
                size="sm"
                disabled
                className="bg-white/[0.04] border border-white/10 text-white/45 cursor-not-allowed"
                title={
                  minutesAway > 0
                    ? `Join opens 15 minutes before the call (in ~${minutesAway} min)`
                    : "Join window closed"
                }
              >
                Join
              </Button>
            )}
            <Link
              href={`/book-strategy?reschedule=${encodeURIComponent(c.publicRef)}`}
            >
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
              >
                Reschedule
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              disabled={cancelInFlight}
              onClick={onCancelRequest}
              className="text-white/55 hover:text-rose-200 hover:bg-rose-500/10"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
          </div>
        )}
        {muted && c.meetingUrl && (
          <a
            href={c.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-orange-300/90 hover:text-orange-200 inline-flex items-center gap-1"
          >
            Replay <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </GlassCard>
  );
}
