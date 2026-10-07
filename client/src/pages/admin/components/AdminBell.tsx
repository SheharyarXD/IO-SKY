/*
 * IO SKY — Admin Portal · notification bell (SRS 12.15).
 *
 * Backed by admin_notifications: every owner alert, alert-rule firing, won
 * opportunity, critical incident and customer approval lands here. Replaces
 * the hardcoded counts that were removed earlier. Polls once a minute and
 * refetches when opened.
 */
import { useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

export default function AdminBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const count = trpc.adminOps.unreadNotificationCount.useQuery(undefined, { refetchInterval: 60_000, retry: false });
  const list = trpc.adminOps.notifications.useQuery({ unreadOnly: false, limit: 15 }, { enabled: open });
  const mark = trpc.adminOps.markNotificationsRead.useMutation({
    onSuccess: () => {
      utils.adminOps.unreadNotificationCount.invalidate();
      utils.adminOps.notifications.invalidate();
    },
  });
  const unread = count.data?.unread ?? 0;
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-[10px] border border-white/[0.07] flex items-center justify-center text-white/75 hover:text-white hover:border-[#F58A1F]/40"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F58A1F] text-[10px] font-semibold text-black flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[420px] overflow-y-auto rounded-[12px] border border-white/[0.08] bg-[#0D2D2E] shadow-2xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/55">Notifications</span>
            <button type="button" disabled={unread === 0} onClick={() => mark.mutate({})} className="text-[11.5px] text-[#F58A1F] disabled:opacity-40">
              Mark all read
            </button>
          </div>
          {list.isLoading ? (
            <div className="px-3 py-6 text-center text-[12.5px] text-white/50">Loading…</div>
          ) : (list.data?.rows.length ?? 0) === 0 ? (
            <div className="px-3 py-6 text-center text-[12.5px] text-white/50">Nothing yet.</div>
          ) : (
            <ul>
              {list.data!.rows.map((n) => {
                const inner = (
                  <div className={`px-3 py-2.5 border-b border-white/[0.04] ${n.readAt ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-2">
                      {n.priority === "critical" || n.priority === "high" ? <span className="w-1.5 h-1.5 rounded-full bg-red-400" aria-label={n.priority} /> : null}
                      <span className="text-[12.5px] text-white/90">{n.title}</span>
                    </div>
                    {n.body ? <div className="mt-0.5 text-[11.5px] text-white/50 line-clamp-2">{n.body}</div> : null}
                    <div className="mt-1 text-[10.5px] text-white/35">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => !n.readAt && mark.mutate({ id: n.id })}>
                    {n.href ? <Link href={n.href}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
