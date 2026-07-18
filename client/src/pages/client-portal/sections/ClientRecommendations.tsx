/*
 * IO SKY — Client Portal · Recommendations
 *
 * Each recommendation is sourced from the latest AI Scan and lives behind the
 * client-only `recommendations` query. From this view the client can:
 *   • Inspect the full body / impact / category in a slide-in detail drawer
 *   • "Discuss on Discovery Call" → /book-strategy with the rec title prefilled
 *   • "Request Proposal" → moves the rec to in_progress and notifies the team
 *   • "Start Implementation" → same status flip + an "implementation" intent
 *   • "Dismiss" → marks the rec as dismissed (still kept in the audit trail)
 *
 * The action mutation lives at trpc.clientPortal.recommendationAction and
 * always: (a) confirms tenant ownership, (b) appends a login_audit row,
 * (c) appends a client_notification row, (d) calls notifyOwner() for
 * proposal/implement so the IO SKY team is alerted in real time.
 */
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  Rocket,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "../components/PortalUI";

type Rec = {
  id: number;
  organizationId: number;
  reportId: number | null;
  title: string;
  category: string;
  impact: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "dismissed";
  body: string | null;
  createdAt: Date | string;
};

type ActionKind = "discuss" | "proposal" | "implement" | "dismiss";

const STATUS_VARIANT: Record<
  Rec["status"],
  "good" | "info" | "neutral" | "warn"
> = {
  completed: "good",
  in_progress: "info",
  dismissed: "neutral",
  pending: "warn",
};

const IMPACT_VARIANT: Record<
  Rec["impact"],
  "good" | "info" | "neutral" | "warn"
> = {
  high: "warn",
  medium: "info",
  low: "neutral",
};

function formatStatus(status: Rec["status"]) {
  return status.replace("_", " ");
}

export default function ClientRecommendations() {
  const recs = trpc.clientPortal.recommendations.useQuery();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const [activeId, setActiveId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<ActionKind | null>(null);

  const data = (recs.data ?? []) as Rec[];

  const grouped = useMemo(() => {
    return data.reduce<Record<string, Rec[]>>((acc, r) => {
      (acc[r.category] ??= []).push(r);
      return acc;
    }, {});
  }, [data]);

  const active = useMemo(
    () => data.find(r => r.id === activeId) ?? null,
    [data, activeId],
  );

  const action = trpc.clientPortal.recommendationAction.useMutation({
    onSuccess: async (_res, vars) => {
      // Refresh local cache so status pills update without a manual reload.
      await utils.clientPortal.recommendations.invalidate();
      await utils.clientPortal.notifications.invalidate().catch(() => {});
      await utils.clientPortal.dashboard.invalidate().catch(() => {});

      const nice: Record<ActionKind, string> = {
        discuss: "Heading to your discovery call planner",
        proposal: "Proposal request sent to your IO SKY team",
        implement: "Implementation intent recorded — your IO SKY team has been notified",
        dismiss: "Recommendation dismissed",
      };
      toast.success(nice[vars.kind]);
      setPendingKind(null);
      if (vars.kind !== "discuss") {
        setOpen(false);
      }
    },
    onError: error => {
      toast.error("Action failed", {
        description: error.message ?? "Please try again in a moment.",
      });
      setPendingKind(null);
    },
  });

  const openDetail = (id: number) => {
    setActiveId(id);
    setOpen(true);
  };

  const runAction = (rec: Rec, kind: ActionKind) => {
    if (action.isPending) return;
    setPendingKind(kind);
    if (kind === "discuss") {
      // Audit + notification, then redirect to /book-strategy with prefill.
      action.mutate(
        { id: rec.id, kind },
        {
          onSuccess: () => {
            const params = new URLSearchParams({
              topic: `Recommendation: ${rec.title}`,
              source: "client-portal/recommendations",
              ref: String(rec.id),
            });
            setLocation(`/book-strategy?${params.toString()}`);
          },
        },
      );
      return;
    }
    action.mutate({ id: rec.id, kind });
  };

  const isBusy = (kind: ActionKind) =>
    action.isPending && pendingKind === kind;

  return (
    <>
      <SectionHeader
        eyebrow="Recommendations"
        title="Ecosystem actions tailored to you"
        description="Each recommendation is generated from your latest AI Scan and prioritized by expected operational impact. Open one to discuss it on a discovery call, request a proposal, or start implementation."
      />

      <SectionStateSwitch
        loading={recs.isLoading}
        error={recs.error}
        onRetry={() => recs.refetch()}
        data={data}
        isEmpty={d => d.length === 0}
        emptyIcon={<Sparkles className="h-5 w-5" />}
        emptyTitle="No recommendations yet"
        emptyBody="After your next AI Scan, prioritized recommendations will appear here."
        emptyAction={
          <Link href="/ai-scan">
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-semibold">
              Run AI Scan
            </Button>
          </Link>
        }
        skeletonRows={6}
      />

      {!recs.isLoading && !recs.error && data.length > 0 && (
        <div className="space-y-7">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-white/45 mb-2">
                {category}
              </h3>
              <div className="space-y-3">
                {items.map(r => {
                  const isClosed =
                    r.status === "completed" || r.status === "dismissed";
                  return (
                    <GlassCard key={r.id} className="p-5" interactive>
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-500/10 ring-1 ring-orange-500/30 flex items-center justify-center text-orange-300 shrink-0">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <button
                              type="button"
                              className="text-left text-base font-semibold text-white hover:text-orange-200 transition-colors"
                              onClick={() => openDetail(r.id)}
                            >
                              {r.title}
                            </button>
                            <div className="flex items-center gap-2">
                              <StatusPill
                                status={r.impact}
                                variant={IMPACT_VARIANT[r.impact]}
                              />
                              <StatusPill
                                status={formatStatus(r.status)}
                                variant={STATUS_VARIANT[r.status]}
                              />
                            </div>
                          </div>
                          {r.body && (
                            <p className="mt-2 text-sm text-white/65 leading-relaxed line-clamp-2">
                              {r.body}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetail(r.id)}
                              className="border-white/15 bg-white/[0.02] text-white/85 hover:bg-white/[0.06] hover:text-white"
                            >
                              View details
                              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isClosed || action.isPending}
                              onClick={() => runAction(r, "discuss")}
                              className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                              Discuss on Discovery Call
                            </Button>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl bg-[#070b14] border-l border-white/10 text-white p-0"
        >
          {active ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300/90">
                  {active.category}
                </p>
                <SheetTitle className="text-white text-xl tracking-tight">
                  {active.title}
                </SheetTitle>
                <SheetDescription className="text-white/55">
                  Recommendation #{active.id} · sourced from your AI Scan engine.
                </SheetDescription>
                <div className="flex items-center gap-2 pt-2">
                  <StatusPill
                    status={active.impact}
                    variant={IMPACT_VARIANT[active.impact]}
                  />
                  <StatusPill
                    status={formatStatus(active.status)}
                    variant={STATUS_VARIANT[active.status]}
                  />
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {active.body ? (
                  <div className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">
                    {active.body}
                  </div>
                ) : (
                  <p className="text-sm text-white/55 italic">
                    No long-form description was attached to this recommendation.
                    The IO SKY team can add context on your next discovery call.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Category
                    </p>
                    <p className="mt-1 text-sm text-white/85">
                      {active.category}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Expected impact
                    </p>
                    <p className="mt-1 text-sm text-white/85 capitalize">
                      {active.impact}
                    </p>
                  </div>
                </div>
              </div>

              <SheetFooter className="px-6 py-4 border-t border-white/8 bg-white/[0.02] gap-2 sm:flex-col">
                <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                    disabled={
                      action.isPending ||
                      active.status === "completed" ||
                      active.status === "dismissed"
                    }
                    onClick={() => runAction(active, "discuss")}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {isBusy("discuss") ? "Opening planner…" : "Discuss on Discovery Call"}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/15 bg-white/[0.03] text-white/85 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                    disabled={
                      action.isPending ||
                      active.status === "in_progress" ||
                      active.status === "completed" ||
                      active.status === "dismissed"
                    }
                    onClick={() => runAction(active, "proposal")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {isBusy("proposal") ? "Sending request…" : "Request Proposal"}
                  </Button>
                  <Button
                    className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                    disabled={
                      action.isPending ||
                      active.status === "in_progress" ||
                      active.status === "completed" ||
                      active.status === "dismissed"
                    }
                    onClick={() => runAction(active, "implement")}
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    {isBusy("implement") ? "Notifying team…" : "Start Implementation"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-white/60 hover:text-rose-200 hover:bg-rose-500/10"
                    disabled={
                      action.isPending ||
                      active.status === "completed" ||
                      active.status === "dismissed"
                    }
                    onClick={() => runAction(active, "dismiss")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {isBusy("dismiss") ? "Dismissing…" : "Dismiss"}
                  </Button>
                </div>
                {(active.status === "completed" ||
                  active.status === "dismissed") && (
                  <p className="text-[12px] text-white/50 inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    This recommendation is closed. Open a new discovery call if
                    you'd like to revisit it.
                  </p>
                )}
              </SheetFooter>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
