/**
 * IO SKY — Admin · Native Booking Availability.
 *
 * Mounts under /admin/booking-availability inside AdminPortal. Lets the
 * operator manage:
 *   - Recurring availability rules per consultation type
 *   - Ad-hoc open / close windows
 *   - Calendar blocks (vacation, holidays)
 *   - Mark a booking as no-show
 *
 * All writes go through the `bookingAdmin.*` tRPC sub-router which performs
 * its own audit logging and authorisation.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarOff, Clock4, Plus, Trash2, RefreshCw, ShieldAlert } from "lucide-react";

const WEEKDAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 0, label: "Sun" },
];

const TIERS = [
  { id: "discovery", label: "Discovery (30 min)" },
  { id: "growth", label: "Strategic Growth (60 min)" },
  { id: "elite", label: "Elite Workshop (90 min)" },
] as const;

function toMinute(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0);
}
function fromMinute(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function formatLocal(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-white/[0.07] bg-[#0E121B]/85 p-6">
      <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-[#FF7A00] mb-2">
        {eyebrow}
      </div>
      <h2 className="font-display text-[20px] text-white/90 mb-5 tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  );
}

export default function BookingAvailability() {
  const utils = trpc.useUtils();

  const rules = trpc.bookingAdmin.listAvailabilityRules.useQuery();
  const recentBookings = trpc.bookingAdmin.listRecent.useQuery({ limit: 100 });

  const range = useMemo(() => {
    const now = Date.now();
    return { rangeStartMs: now - 7 * 24 * 3600_000, rangeEndMs: now + 60 * 24 * 3600_000 };
  }, []);
  const windows = trpc.bookingAdmin.listAvailabilityWindows.useQuery(range);
  const blocks = trpc.bookingAdmin.listCalendarBlocks.useQuery(range);

  // -- Recurring rule editor ----------------------------------------------
  const [ruleDraft, setRuleDraft] = useState({
    consultationType: "discovery" as "discovery" | "growth" | "elite",
    weekday: 1,
    startHHMM: "09:00",
    endHHMM: "18:00",
    timezone: "Europe/Amsterdam",
  });
  const upsertRule = trpc.bookingAdmin.upsertAvailabilityRule.useMutation({
    onSuccess: () => {
      toast.success("Availability rule saved");
      utils.bookingAdmin.listAvailabilityRules.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteRule = trpc.bookingAdmin.deleteAvailabilityRule.useMutation({
    onSuccess: () => utils.bookingAdmin.listAvailabilityRules.invalidate(),
  });

  // -- Window editor ------------------------------------------------------
  const [windowDraft, setWindowDraft] = useState({
    kind: "close" as "open" | "close",
    consultationType: "" as "" | "discovery" | "growth" | "elite",
    startLocal: "",
    endLocal: "",
    reason: "",
  });
  const addWindow = trpc.bookingAdmin.addAvailabilityWindow.useMutation({
    onSuccess: () => {
      toast.success("Window added");
      utils.bookingAdmin.listAvailabilityWindows.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteWindow = trpc.bookingAdmin.deleteAvailabilityWindow.useMutation({
    onSuccess: () => utils.bookingAdmin.listAvailabilityWindows.invalidate(),
  });

  // -- Calendar block editor ---------------------------------------------
  const [blockDraft, setBlockDraft] = useState({
    startLocal: "",
    endLocal: "",
    label: "",
  });
  const addBlock = trpc.bookingAdmin.addCalendarBlock.useMutation({
    onSuccess: () => {
      toast.success("Calendar block added");
      utils.bookingAdmin.listCalendarBlocks.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteBlock = trpc.bookingAdmin.deleteCalendarBlock.useMutation({
    onSuccess: () => utils.bookingAdmin.listCalendarBlocks.invalidate(),
  });

  // -- Booking lifecycle --------------------------------------------------
  const cancelBooking = trpc.bookingAdmin.cancel.useMutation({
    onSuccess: () => {
      toast.success("Booking cancelled");
      utils.bookingAdmin.listRecent.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markNoShow = trpc.bookingAdmin.markNoShow.useMutation({
    onSuccess: () => toast.success("Marked no-show"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-soft font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#E6EAF0]/70 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] shadow-[0_0_8px_#FF7A00]" />
          ADMIN · NATIVE BOOKING AVAILABILITY
        </div>
        <h1 className="font-display font-semibold text-[30px] md:text-[36px] leading-[1.05] tracking-[-0.02em] text-[#E6EAF0] mt-2">
          Availability <span className="text-[#FF7A00]">control</span>
        </h1>
        <p className="text-[13.5px] leading-[1.65] text-[#E6EAF0]/65 max-w-[680px]">
          The native booking adapter computes guest-facing slots directly from
          these rules. Changes take effect on the next public availability fetch.
        </p>
      </div>

      {/* Recurring rules */}
      <Section eyebrow="Recurring rules" title="Weekly availability per tier">
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-6">
          <select
            value={ruleDraft.consultationType}
            onChange={(e) => setRuleDraft({ ...ruleDraft, consultationType: e.target.value as typeof ruleDraft.consultationType })}
            className="lg:col-span-2 h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          >
            {TIERS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <select
            value={ruleDraft.weekday}
            onChange={(e) => setRuleDraft({ ...ruleDraft, weekday: Number(e.target.value) })}
            className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          >
            {WEEKDAYS.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
          <input
            type="time"
            value={ruleDraft.startHHMM}
            onChange={(e) => setRuleDraft({ ...ruleDraft, startHHMM: e.target.value })}
            className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          />
          <input
            type="time"
            value={ruleDraft.endHHMM}
            onChange={(e) => setRuleDraft({ ...ruleDraft, endHHMM: e.target.value })}
            className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          />
          <button
            type="button"
            disabled={upsertRule.isPending}
            onClick={() => upsertRule.mutate({
              consultationType: ruleDraft.consultationType,
              weekday: ruleDraft.weekday,
              startMinute: toMinute(ruleDraft.startHHMM),
              endMinute: toMinute(ruleDraft.endHHMM),
              timezone: ruleDraft.timezone,
            })}
            className="h-10 px-4 rounded-md bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10] font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Add rule
          </button>
        </div>
        <div className="mt-5 rounded-[14px] border border-white/[0.07] overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
              <tr><th className="px-4 py-3">Tier</th><th className="px-4 py-3">Day</th><th className="px-4 py-3">Window</th><th className="px-4 py-3">Timezone</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(rules.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-white/45">No rules yet — defaults apply (Mon–Fri 09:00–18:00 Europe/Amsterdam).</td></tr>
              )}
              {(rules.data ?? []).map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 capitalize">{r.consultationType}</td>
                  <td className="px-4 py-3">{WEEKDAYS.find((w) => w.id === r.weekday)?.label}</td>
                  <td className="px-4 py-3 font-mono">{fromMinute(r.startMinute)} – {fromMinute(r.endMinute)}</td>
                  <td className="px-4 py-3 text-white/60">{r.timezone}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteRule.mutate({ id: r.id })} className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 text-[12px]">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Ad-hoc windows */}
      <Section eyebrow="Exceptions" title="Open / Close one-off windows">
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-6">
          <select
            value={windowDraft.kind}
            onChange={(e) => setWindowDraft({ ...windowDraft, kind: e.target.value as "open" | "close" })}
            className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          >
            <option value="open">Open (add)</option>
            <option value="close">Close (block)</option>
          </select>
          <select
            value={windowDraft.consultationType}
            onChange={(e) => setWindowDraft({ ...windowDraft, consultationType: e.target.value as typeof windowDraft.consultationType })}
            className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]"
          >
            <option value="">All tiers</option>
            {TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input type="datetime-local" value={windowDraft.startLocal} onChange={(e) => setWindowDraft({ ...windowDraft, startLocal: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <input type="datetime-local" value={windowDraft.endLocal} onChange={(e) => setWindowDraft({ ...windowDraft, endLocal: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <input placeholder="Reason (optional)" value={windowDraft.reason} onChange={(e) => setWindowDraft({ ...windowDraft, reason: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <button
            type="button"
            disabled={!windowDraft.startLocal || !windowDraft.endLocal || addWindow.isPending}
            onClick={() => {
              const startMs = new Date(windowDraft.startLocal).getTime();
              const endMs = new Date(windowDraft.endLocal).getTime();
              addWindow.mutate({
                consultationType: windowDraft.consultationType || null,
                kind: windowDraft.kind,
                startMs,
                endMs,
                reason: windowDraft.reason || undefined,
              });
            }}
            className="h-10 px-4 rounded-md bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10] font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Clock4 className="w-4 h-4" /> Add window
          </button>
        </div>
        <div className="mt-5 rounded-[14px] border border-white/[0.07] overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
              <tr><th className="px-4 py-3">Kind</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(windows.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-white/45">No one-off windows in the next 60 days.</td></tr>
              )}
              {(windows.data ?? []).map((w) => (
                <tr key={w.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 capitalize">{w.kind}</td>
                  <td className="px-4 py-3 text-white/70">{w.consultationType ?? "all"}</td>
                  <td className="px-4 py-3 text-white/70">{formatLocal(w.startMs)}</td>
                  <td className="px-4 py-3 text-white/70">{formatLocal(w.endMs)}</td>
                  <td className="px-4 py-3 text-white/55">{w.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteWindow.mutate({ id: w.id })} className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 text-[12px]">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Calendar blocks */}
      <Section eyebrow="Vacation & holidays" title="Calendar blocks">
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-4">
          <input type="datetime-local" value={blockDraft.startLocal} onChange={(e) => setBlockDraft({ ...blockDraft, startLocal: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <input type="datetime-local" value={blockDraft.endLocal} onChange={(e) => setBlockDraft({ ...blockDraft, endLocal: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <input placeholder="Label (e.g. Summer break)" value={blockDraft.label} onChange={(e) => setBlockDraft({ ...blockDraft, label: e.target.value })} className="h-10 px-3 rounded-md bg-[#0A0E14] border border-white/10 text-white/90 text-[13px]" />
          <button
            type="button"
            disabled={!blockDraft.startLocal || !blockDraft.endLocal || !blockDraft.label || addBlock.isPending}
            onClick={() => {
              addBlock.mutate({
                startMs: new Date(blockDraft.startLocal).getTime(),
                endMs: new Date(blockDraft.endLocal).getTime(),
                label: blockDraft.label,
              });
            }}
            className="h-10 px-4 rounded-md bg-[#FF7A00] hover:bg-[#FF5500] text-[#0A0B10] font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <CalendarOff className="w-4 h-4" /> Add block
          </button>
        </div>
        <div className="mt-5 rounded-[14px] border border-white/[0.07] overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
              <tr><th className="px-4 py-3">Label</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(blocks.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-white/45">No calendar blocks in the next 60 days.</td></tr>
              )}
              {(blocks.data ?? []).map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/85">{b.label}</td>
                  <td className="px-4 py-3 text-white/70">{formatLocal(b.startMs)}</td>
                  <td className="px-4 py-3 text-white/70">{formatLocal(b.endMs)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteBlock.mutate({ id: b.id })} className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 text-[12px]">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Booking lifecycle quick actions */}
      <Section eyebrow="Lifecycle" title="Cancel or mark no-show">
        <div className="flex items-center justify-between mb-4 text-[11.5px] font-mono uppercase tracking-[0.16em] text-white/55">
          <span>Recent {recentBookings.data?.length ?? 0} bookings</span>
          <button onClick={() => recentBookings.refetch()} className="inline-flex items-center gap-1.5 text-white/70 hover:text-[#FF7A00]"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
        <div className="rounded-[14px] border border-white/[0.07] overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] font-mono uppercase tracking-[0.16em] text-white/55">
              <tr><th className="px-4 py-3">Ref</th><th className="px-4 py-3">Tier</th><th className="px-4 py-3">When</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(recentBookings.data ?? []).slice(0, 25).map((b) => (
                <tr key={b.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-[#FF7A00]">{b.publicRef}</td>
                  <td className="px-4 py-3 capitalize">{b.serviceId}</td>
                  <td className="px-4 py-3 text-white/70">{formatLocal(b.slotStartMs)}</td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => cancelBooking.mutate({ publicRef: b.publicRef })} className="text-[12px] text-red-300 hover:text-red-200">Cancel</button>
                    <button onClick={() => markNoShow.mutate({ publicRef: b.publicRef })} className="text-[12px] text-white/70 hover:text-[#FF7A00]">No-show</button>
                  </td>
                </tr>
              ))}
              {(recentBookings.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-white/45">No bookings to manage yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-start gap-2 text-[11.5px] text-white/45">
          <ShieldAlert className="w-3.5 h-3.5 mt-0.5 text-white/45 shrink-0" />
          <span>All admin actions are append-only logged in <code>booking_events</code> and surfaced in the audit log.</span>
        </div>
      </Section>
    </div>
  );
}
