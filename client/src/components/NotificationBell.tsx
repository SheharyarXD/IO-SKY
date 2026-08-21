/*
 * IO SKY — shared Notification Center bell (Milestone 2 §2.7).
 *
 * Before this component, the bell icon on both the Client Portal and
 * Developer Workspace headers rendered an unread-count badge from real
 * data but had no onClick at all — clicking it did nothing. This makes it
 * a real dropdown: list, mark-as-read (individually or all), and archive
 * (dismiss). Used identically by both portals since
 * client_notifications/developer_notifications share the same shape.
 */
import { Bell, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  readAt?: number | string | null;
  createdAt: string | Date;
  priority?: "low" | "normal" | "high" | "critical" | string;
}

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  normal: "bg-white/30",
  low: "bg-white/15",
};

export function NotificationBell({
  notifications,
  onMarkRead,
  onArchive,
}: {
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
  onArchive: (id: number) => void;
}) {
  const unread = notifications.filter((n) => n.readAt === null || n.readAt === undefined);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/70 hover:text-orange-200 hover:border-orange-500/40 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-black">
              {unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0 bg-[#0B1020] border-white/10 text-white">
        <div className="px-3.5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold">Notifications</span>
          {unread.length > 0 && (
            <button
              onClick={() => unread.forEach((n) => onMarkRead(n.id))}
              className="text-[11px] text-orange-300 hover:text-orange-200"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[12px] text-white/45">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const isUnread = n.readAt === null || n.readAt === undefined;
              const content = (
                <div className={`px-3.5 py-2.5 border-b border-white/[0.06] ${isUnread ? "bg-white/[0.03]" : ""}`}>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[n.priority ?? "normal"] ?? PRIORITY_DOT.normal}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-white/90 leading-snug">{n.title}</p>
                      {n.body && <p className="text-[11.5px] text-white/55 mt-0.5 line-clamp-2">{n.body}</p>}
                      <p className="text-[10.5px] text-white/35 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUnread && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onMarkRead(n.id);
                          }}
                          title="Mark read"
                          className="text-white/40 hover:text-emerald-400"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onArchive(n.id);
                        }}
                        title="Dismiss"
                        className="text-white/40 hover:text-red-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} onClick={() => isUnread && onMarkRead(n.id)}>
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
