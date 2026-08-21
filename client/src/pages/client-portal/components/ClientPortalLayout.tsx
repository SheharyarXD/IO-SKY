/*
 * IO SKY — Client Portal Layout.
 * Deep navy background, premium glass surfaces, restrained orange accents.
 * Persistent left sidebar on lg+, drawer on mobile/tablet.
 * Top header with company chip + book-call CTA + notifications bell + avatar.
 */
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ScanSearch,
  Sparkles,
  PhoneCall,
  GitBranch,
  Receipt,
  FolderLock,
  MessageSquare,
  UserCog,
  ShieldCheck,
  LifeBuoy,
  CalendarClock,
  Menu,
} from "lucide-react";
import IOSkyLogo from "@/components/IOSkyLogo";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import NotificationBell from "@/components/NotificationBell";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: "messages" | "support";
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/client-portal", icon: LayoutDashboard },
  { id: "reports", label: "Reports", href: "/client-portal/reports", icon: FileText },
  { id: "ai-scans", label: "AI Scan History", href: "/client-portal/ai-scans", icon: ScanSearch },
  {
    id: "recommendations",
    label: "Recommendations",
    href: "/client-portal/recommendations",
    icon: Sparkles,
  },
  {
    id: "strategy-calls",
    label: "Discovery Calls",
    href: "/client-portal/strategy-calls",
    icon: PhoneCall,
  },
  { id: "projects", label: "Project Progress", href: "/client-portal/projects", icon: GitBranch },
  { id: "billing", label: "Invoices & Billing", href: "/client-portal/billing", icon: Receipt },
  { id: "documents", label: "Documents", href: "/client-portal/documents", icon: FolderLock },
  {
    id: "messages",
    label: "Messages",
    href: "/client-portal/messages",
    icon: MessageSquare,
    badge: "messages",
  },
  { id: "account", label: "Account Settings", href: "/client-portal/account", icon: UserCog },
  { id: "security", label: "Security Center", href: "/client-portal/security", icon: ShieldCheck },
  {
    id: "support",
    label: "Support",
    href: "/client-portal/support",
    icon: LifeBuoy,
    badge: "support",
  },
];

interface ClientPortalLayoutProps {
  section: string;
  organizationName: string | null;
  userDisplayName: string;
  userEmail: string | null;
  children: ReactNode;
}

export default function ClientPortalLayout({
  userDisplayName,
  userEmail,
  children,
}: ClientPortalLayoutProps) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dashboard = trpc.clientPortal.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const utils = trpc.useUtils();
  const markRead = trpc.clientPortal.markNotificationRead.useMutation({
    onSuccess: () => utils.clientPortal.dashboard.invalidate(),
  });
  const archiveNotif = trpc.clientPortal.archiveNotification.useMutation({
    onSuccess: () => utils.clientPortal.dashboard.invalidate(),
  });

  const orgName = dashboard.data?.organization?.name ?? null;
  const statusLabel = dashboard.data?.organization?.statusLabel ?? "Healthy";
  const notifications = dashboard.data?.notifications ?? [];
  const unreadMessages = (dashboard.data?.messages ?? []).filter(
    (m: { sender: string; readAt: unknown }) =>
      m.sender === "io-sky" && (m.readAt === null || m.readAt === undefined),
  ).length;
  const openTickets = 0;

  const isActive = (href: string) => {
    if (href === "/client-portal") return location === "/client-portal";
    return location === href || location.startsWith(href + "/");
  };

  const initials = (userDisplayName || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const renderNav = (onNavigate?: () => void) => (
    <nav className="px-3 pb-6 flex-1 space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const badgeCount =
          item.badge === "messages"
            ? unreadMessages
            : item.badge === "support"
              ? openTickets
              : 0;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "bg-orange-500/10 text-orange-200 ring-1 ring-orange-500/30 shadow-[0_0_24px_-12px_rgba(255,134,46,0.6)]"
                : "text-white/65 hover:text-white hover:bg-white/[0.04]",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                active ? "text-orange-300" : "text-white/45 group-hover:text-orange-300/80",
              )}
            />
            <span className="truncate">{item.label}</span>
            {badgeCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500/20 px-1.5 text-[11px] font-semibold text-orange-200 ring-1 ring-orange-500/40">
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const renderTrust = () => (
    <>
      <div className="mx-3 mb-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Need help?</p>
        <p className="mt-1 text-sm text-white/85">
          Our concierge desk is on standby for urgent operational matters.
        </p>
        <Link href="/client-portal/support">
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full border-white/15 bg-white/[0.03] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
          >
            Contact Support
          </Button>
        </Link>
      </div>

      <div className="mx-3 mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Portal Status</p>
        <p className="mt-1 inline-flex items-center gap-2 text-sm text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          All systems operational
        </p>
        <p className="mt-1 text-[11px] text-white/40">Last updated: just now</p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-[#e6edf7]">
      <ImpersonationBanner />
      <div className="flex">
        {/* Persistent sidebar (lg+) */}
        <aside className="hidden lg:flex lg:flex-col w-[260px] shrink-0 min-h-screen border-r border-white/5 bg-[#0a1020]/80 backdrop-blur">
          <div className="px-5 py-6 flex items-center gap-3">
            <IOSkyLogo variant="primary" className="h-8" />
          </div>
          {renderNav()}
          {renderTrust()}
        </aside>

        {/* Mobile/tablet drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent
            side="left"
            className="w-[280px] p-0 border-r border-white/10 bg-[#0a1020]/95 backdrop-blur"
          >
            <SheetTitle className="sr-only">IO SKY Client Portal Navigation</SheetTitle>
            <SheetDescription className="sr-only">Mobile navigation drawer for the IO SKY client portal.</SheetDescription>
            <div className="flex h-full flex-col">
              <div className="px-5 py-6 flex items-center gap-3">
                <IOSkyLogo variant="primary" className="h-8" />
              </div>
              {renderNav(() => setDrawerOpen(false))}
              {renderTrust()}
            </div>
          </SheetContent>

          {/* Main */}
          <main className="flex-1 min-w-0">
            <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070b14]/85 backdrop-blur">
              <div className="flex h-16 items-center gap-4 px-4 sm:px-5">
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/70 hover:text-orange-200 hover:border-orange-500/40 transition-colors"
                    aria-label="Open navigation"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>

                <div className="min-w-0">
                  <h1 className="text-base font-semibold tracking-tight text-white">
                    Client Portal
                  </h1>
                  <p className="mt-0.5 text-[11px] text-white/55 truncate">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400 mr-1.5 align-middle animate-pulse" />
                    Welcome back, {userDisplayName.split(" ")[0]}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2 ml-4">
                  {orgName && (
                    <Badge
                      variant="outline"
                      className="border-white/15 bg-white/[0.03] text-white/70 font-medium"
                    >
                      {orgName}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 font-medium"
                  >
                    {statusLabel}
                  </Badge>
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <Link href="/book-strategy">
                    <Button
                      size="sm"
                      className="hidden sm:inline-flex bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_28px_-10px_rgba(255,134,46,0.7)]"
                    >
                      <CalendarClock className="h-4 w-4 mr-1.5" />
                      Book Discovery Call
                    </Button>
                  </Link>

                  <NotificationBell
                    notifications={notifications as any}
                    onMarkRead={(id) => markRead.mutate({ notificationId: id })}
                    onArchive={(id) => archiveNotif.mutate({ notificationId: id })}
                  />

                  <div className="flex items-center gap-2 pl-3 border-l border-white/10">
                    <Avatar className="h-8 w-8 bg-orange-500/15 ring-1 ring-orange-500/25">
                      <AvatarFallback className="bg-transparent text-orange-200 text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-right">
                      <p className="text-xs font-semibold text-white leading-tight">
                        {userDisplayName}
                      </p>
                      <p className="text-[11px] text-white/50 leading-tight truncate max-w-[140px]">
                        {userEmail ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="px-4 py-6 sm:px-5 md:px-8 md:py-8 max-w-[1500px] mx-auto">{children}</div>

            <footer className="px-5 sm:px-8 py-6 text-[11px] text-white/35 border-t border-white/5">
              © IO SKY {new Date().getFullYear()} · End-to-end encrypted · security-first practices ·
              GDPR compliant
            </footer>
          </main>
        </Sheet>
      </div>
    </div>
  );
}
