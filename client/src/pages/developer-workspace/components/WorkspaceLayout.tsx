/*
 * IO SKY — Developer Workspace Layout.
 *
 * Mirrors the cinematic dark-navy + restrained orange visual language used
 * by the Client Portal but is wired to a *different* nav model (the 11
 * sidebar items pinned by the Sidebar Functional Logic Master) and a
 * *different* tRPC namespace (`developer.*`).
 *
 * Persistent sidebar on lg+, mobile drawer below. The header carries the
 * developer's display name, availability pill, notifications bell, and
 * user pod. Search and quick-actions are intentionally simple here — the
 * spec asks for a focused, calm UI rather than a CRM-style chrome.
 */
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  FolderLock,
  GitCommit,
  MessageSquare,
  ShieldCheck,
  ScrollText,
  UserCog,
  KeyRound,
  LifeBuoy,
  Bell,
  Menu,
} from "lucide-react";
import IOSkyLogo from "@/components/IOSkyLogo";
import ImpersonationBanner from "@/components/ImpersonationBanner";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
}

/**
 * The 11 sidebar items pinned by the Sidebar Functional Logic Master.
 * Order is intentional and must not be re-shuffled — the developer
 * spec describes the order as part of the trust signal.
 */
export const DEVELOPER_NAV: NavItem[] = [
  { id: "overview", label: "Overview", href: "/developer-workspace", icon: LayoutDashboard },
  {
    id: "projects",
    label: "Assigned Projects",
    href: "/developer-workspace/projects",
    icon: FolderKanban,
  },
  { id: "tasks", label: "Tasks", href: "/developer-workspace/tasks", icon: ListTodo },
  { id: "files", label: "Files", href: "/developer-workspace/files", icon: FolderLock },
  {
    id: "submissions",
    label: "Submissions",
    href: "/developer-workspace/submissions",
    icon: GitCommit,
  },
  {
    id: "messages",
    label: "Messages",
    href: "/developer-workspace/messages",
    icon: MessageSquare,
  },
  {
    id: "access-scope",
    label: "Access Scope",
    href: "/developer-workspace/access-scope",
    icon: ShieldCheck,
  },
  {
    id: "agreements",
    label: "Agreements",
    href: "/developer-workspace/agreements",
    icon: ScrollText,
  },
  {
    id: "profile",
    label: "Profile & Availability",
    href: "/developer-workspace/profile",
    icon: UserCog,
  },
  { id: "security", label: "Security", href: "/developer-workspace/security", icon: KeyRound },
  { id: "support", label: "Support", href: "/developer-workspace/support", icon: LifeBuoy },
];

interface WorkspaceLayoutProps {
  userDisplayName: string;
  userEmail: string | null;
  availability?: "available" | "limited" | "unavailable" | null;
  unreadNotifs?: number;
  unreadMessages?: number;
  children: ReactNode;
}

/**
 * Map availability values to a visible badge style. Defaults to "Limited"
 * if we have not yet loaded the profile to avoid a flash of "Available".
 */
function availabilityBadge(value: WorkspaceLayoutProps["availability"]) {
  if (!value) return null;
  if (value === "available") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 font-medium"
      >
        Available
      </Badge>
    );
  }
  if (value === "limited") {
    return (
      <Badge
        variant="outline"
        className="border-amber-400/30 bg-amber-500/10 text-amber-200 font-medium"
      >
        Limited
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-rose-400/30 bg-rose-500/10 text-rose-200 font-medium"
    >
      Unavailable
    </Badge>
  );
}

export default function WorkspaceLayout({
  userDisplayName,
  userEmail,
  availability,
  unreadNotifs = 0,
  unreadMessages = 0,
  children,
}: WorkspaceLayoutProps) {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Active state matches by exact URL or by being a prefix of a deeper
  // route (e.g. `/developer-workspace/projects/500` should still light up
  // the Assigned Projects rail entry).
  const isActive = (href: string) => {
    if (href === "/developer-workspace") return location === "/developer-workspace";
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
      {DEVELOPER_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        const badgeCount =
          item.id === "messages" ? unreadMessages : 0;
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
                active
                  ? "text-orange-300"
                  : "text-white/45 group-hover:text-orange-300/80",
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
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Engineering desk</p>
        <p className="mt-1 text-sm text-white/85">
          Reach the IO SKY engineering coordinator for delivery questions or access.
        </p>
        <Link href="/developer-workspace/support">
          <Button
            size="sm"
            variant="outline"
            className="mt-3 w-full border-white/15 bg-white/[0.03] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
          >
            Open ticket
          </Button>
        </Link>
      </div>

      <div className="mx-3 mb-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-white/45">Workspace policy</p>
        <p className="mt-1 text-sm text-white/85">
          Assignment-scoped access only. All actions are logged.
        </p>
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
          <div className="px-5 mb-4 -mt-1 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
              Developer
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-orange-300/90">
              Workspace
            </span>
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
            <SheetTitle className="sr-only">IO SKY Developer Workspace Navigation</SheetTitle>
            <SheetDescription className="sr-only">Mobile navigation drawer for the IO SKY developer workspace.</SheetDescription>
            <div className="flex h-full flex-col">
              <div className="px-5 py-6 flex items-center gap-3">
                <IOSkyLogo variant="primary" className="h-8" />
              </div>
              <div className="px-5 mb-4 -mt-1 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                  Developer
                </span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-orange-300/90">
                  Workspace
                </span>
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
                    Developer Workspace
                  </h1>
                  <p className="mt-0.5 text-[11px] text-white/55 truncate">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400 mr-1.5 align-middle animate-pulse" />
                    Welcome back, {userDisplayName.split(" ")[0]}
                  </p>
                </div>

                <div className="hidden md:flex items-center gap-2 ml-4">
                  {availabilityBadge(availability)}
                </div>

                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-white/70 hover:text-orange-200 hover:border-orange-500/40 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadNotifs > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-black">
                        {unreadNotifs}
                      </span>
                    )}
                  </button>

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

            <div className="px-4 py-6 sm:px-5 md:px-8 md:py-8 max-w-[1500px] mx-auto">
              {children}
            </div>

            <footer className="px-5 sm:px-8 py-6 text-[11px] text-white/35 border-t border-white/5">
              © IO SKY {new Date().getFullYear()} · Engineering workspace · Assignment-scoped
              access · security-first practices
            </footer>
          </main>
        </Sheet>
      </div>
    </div>
  );
}
