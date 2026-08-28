/*
 * IO SKY — Admin Portal layout shell.
 *
 * Deep-navy operations command-center frame: persistent left sidebar with the
 * 19 master-spec items, top welcome strip with avatar pod and notification
 * cluster, plus a center search and a quick-actions ribbon. Mobile collapses
 * the sidebar into a sheet drawer and the top strip into a stacked header.
 *
 * The layout enforces RBAC at render-time: any non-admin caller is bounced
 * to the unified login page, and the audit trail records the access through
 * the existing `appendLoginAudit` helper (called server-side via the summary
 * query).
 */
import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation, useRouter } from "wouter";
import { useRouteGuard } from "@/_core/hooks/useRouteGuard";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import IOSkyLogo from "@/components/IOSkyLogo";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import { debugLog } from "@/lib/debugLog";
import { trpc } from "@/lib/trpc";
import AdminSecurityCenter from "../sections/AdminSecurityCenter";
import {
  LayoutDashboard,
  Users,
  Building2,
  ScanSearch,
  FileText,
  GitBranch,
  PhoneCall,
  CreditCard,
  FolderLock,
  Wrench,
  ShieldAlert,
  Mail,
  Headphones,
  Workflow,
  BarChart3,
  ShieldCheck,
  ScrollText,
  Settings,
  LifeBuoy,
  Menu,
  Bell,
  Search,
  ChevronDown,
  Plus,
  Shield,
  Mail as MailIcon,
  ShieldCheckIcon,
  KeyRound,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sidebar config — locked to the master spec ordering.
// ---------------------------------------------------------------------------

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export const ADMIN_NAV: NavItem[] = [
  { id: "overview", label: "Executive Overview", href: "/admin", icon: LayoutDashboard },
  { id: "crm", label: "CRM & Leads", href: "/admin/crm", icon: Users },
  { id: "clients", label: "Clients", href: "/admin/clients", icon: Building2 },
  { id: "ai-scans", label: "AI Scans", href: "/admin/ai-scans", icon: ScanSearch },
  { id: "reports", label: "Reports", href: "/admin/reports", icon: FileText },
  { id: "projects", label: "Projects & Ecosystems", href: "/admin/projects", icon: GitBranch },
  { id: "strategy-calls", label: "Discovery Calls", href: "/admin/strategy-calls", icon: PhoneCall },
  { id: "booking-availability", label: "Booking Availability", href: "/admin/booking-availability", icon: PhoneCall },
  { id: "billing", label: "Billing & Payments", href: "/admin/billing", icon: CreditCard },
  { id: "documents", label: "Documents & Storage", href: "/admin/documents", icon: FolderLock },
  { id: "developers", label: "Developer Management", href: "/admin/developers", icon: Wrench },
  { id: "security", label: "Security Monitoring", href: "/admin/security", icon: ShieldAlert },
  { id: "campaigns", label: "Email/SMS Campaigns", href: "/admin/campaigns", icon: Mail },
  { id: "agents", label: "AI Agents & IVR", href: "/admin/agents", icon: Headphones },
  { id: "automations", label: "Notifications & Automations", href: "/admin/automations", icon: Workflow, badge: 7 },
  { id: "analytics", label: "Analytics & Insights", href: "/admin/analytics", icon: BarChart3 },
  { id: "users", label: "Users & Permissions", href: "/admin/users", icon: ShieldCheck },
  { id: "audit", label: "Audit Logs", href: "/admin/audit", icon: ScrollText },
  { id: "my-security", label: "My Security (MFA)", href: "/admin/my-security", icon: KeyRound },
  { id: "settings", label: "System Settings", href: "/admin/settings", icon: Settings },
  { id: "support", label: "Support Desk", href: "/admin/support", icon: LifeBuoy },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActiveHref(currentPath: string, href: string): boolean {
  if (href === "/admin") return currentPath === "/admin" || currentPath === "/admin/";
  return currentPath === href || currentPath.startsWith(href + "/");
}

interface AdminLayoutProps {
  children: ReactNode;
  /** Override the page title rendered in the welcome strip. */
  title?: string;
  /** Override the eyebrow tagline rendered under the title. */
  tagline?: string;
}

export function AdminLayout({
  children,
  title,
  tagline = "Operational intelligence transforms data into dominance.",
}: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { user, loading, isAuthenticated, roleHome, isAdminRole } = useRouteGuard();

  // Milestone 2 §2.5 — hard, blocking MFA gate for admin/super_admin.
  // Deliberately polls while blocked (rather than requiring a manual
  // refresh/navigation) so the console unlocks the instant enrollment
  // succeeds, matching the calm-interstitial pattern the Developer
  // Workspace's WorkspaceGate already established for its own mfa_required
  // state.
  const gateStatus = trpc.admin.gateStatus.useQuery(undefined, {
    enabled: isAuthenticated && !!(user as any)?.role && isAdminRole((user as any).role),
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (query) =>
      query.state.data && !query.state.data.ok ? 4000 : false,
  });
  const mfaGateBlocked =
    !!gateStatus.data && !gateStatus.data.ok && gateStatus.data.reason === "mfa_required";

  // Tick the date/time chip once a minute so it doesn't feel frozen.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Bounce non-admin sessions back to the unified login page.
  // Use wouter navigate() instead of window.location.href to avoid the React 18
  // removeChild crash caused by hard navigation tearing down portal nodes.
  useEffect(() => {
    const role = (user as any)?.role;
    debugLog.log("admin_layout_auth_check", { loading, isAuthenticated, role });
    if (loading) return;
    if (!isAuthenticated) {
      debugLog.log("admin_layout_redirect_to_login", { location });
      // Use hard navigation only for the external OAuth URL
      window.location.href = getLoginUrl(location);
      return;
    }
    if (role && !isAdminRole(role)) {
      // Redirect to the role's home rather than gatekeeping in place.
      const dest = roleHome(role);
      debugLog.log("admin_layout_redirect_wrong_role", { role, dest });
      // Use SPA navigate to avoid portal unmount race
      navigate(dest);
    }
    debugLog.log("admin_layout_auth_passed", { role });
  }, [loading, isAuthenticated, user, location]);

  if (loading || !isAuthenticated || ((user as any)?.role && !isAdminRole((user as any).role))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B1020] text-white/70">
        <Loader2 className="w-5 h-5 animate-spin mr-3" /> Verifying admin session…
      </div>
    );
  }

  /**
   * View-As: prompts the operator for an audit-trail reason, calls the
   * Express route to mint a 30-minute impersonation cookie, then redirects
   * to the target portal. The reason is required by the server (min 4 chars).
   */
  const startViewAs = async (target: "client" | "developer") => {
    const reason = window.prompt(
      `Reason for previewing the ${target} portal? (min 4 characters, audited)`,
      `QA — sanity-check ${target} surface`,
    );
    if (!reason || reason.trim().length < 4) return;
    try {
      const r = await fetch("/api/admin/view-as", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, reason: reason.trim() }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; redirect?: string; error?: string };
      if (!r.ok || !j.ok) {
        window.alert(j.error ?? `Could not start View-As (${r.status})`);
        return;
      }
      window.location.href = j.redirect ?? (target === "client" ? "/client-portal" : "/developer-workspace");
    } catch (e) {
      window.alert("Network error while starting View-As");
    }
  };

  const displayName = (user as any)?.name ?? "Administrator";
  const userInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  const dateLabel = now.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Resolve the active section title for the welcome strip.
  const active = ADMIN_NAV.find(n => isActiveHref(location, n.href));
  const sectionTitle = title ?? active?.label ?? "Executive Overview";

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E6EAF0]">
      {/* Background dot grid + radial glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 0% 0%, rgba(255, 122, 0,0.08) 0%, transparent 40%), radial-gradient(circle at 100% 100%, rgba(255, 122, 0,0.06) 0%, transparent 50%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(230,234,240,0.6) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Layout grid */}
      <div className="relative z-[1] flex min-h-screen">
        {/* ─── Sidebar (desktop) ───────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-[244px] shrink-0 border-r border-white/[0.06] bg-[#080C18]/90 backdrop-blur-xl">
          <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
            <IOSkyLogo variant="mark" height={36} />
            <div className="flex flex-col leading-none">
              <span className="font-display font-semibold text-[15.5px] tracking-tight text-[#E6EAF0]">
                IO <span className="text-[#FF7A00]">SKY</span>
              </span>
              <span className="font-mono text-[9.5px] tracking-[0.22em] uppercase text-white/45 mt-1">
                Admin Portal
              </span>
            </div>
          </div>
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            <ul className="space-y-0.5">
              {ADMIN_NAV.map(item => {
                const active = isActiveHref(location, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] transition-colors duration-150",
                        active
                          ? "bg-[#FF7A00]/[0.10] text-[#FF7A00] border border-[#FF7A00]/25"
                          : "text-white/70 border border-transparent hover:bg-white/[0.03] hover:text-white",
                      )}
                    >
                      <Icon className={cn("w-[15px] h-[15px] shrink-0", active ? "text-[#FF7A00]" : "text-white/55 group-hover:text-white/80")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[#FF7A00]/15 text-[#FF7A00] border border-[#FF7A00]/30 leading-none">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mx-3 mb-3 mt-2 p-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFB347] flex items-center justify-center text-[12px] font-semibold text-[#0B1020]">
                {userInitials || "A"}
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-[#E6EAF0] truncate">{displayName}</div>
                <div className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-[#FF7A00]/85 truncate">
                  Super Administrator
                </div>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/55">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  Online
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2">
              <button
                onClick={() => startViewAs("client")}
                className="text-[10.5px] font-mono uppercase tracking-[0.16em] py-1.5 rounded-md border border-white/[0.08] hover:border-[#FF7A00]/45 hover:bg-[#FF7A00]/10 text-white/75 hover:text-white transition-colors"
                title="Preview the Client Portal as an audited admin (30 minutes)"
              >
                View as Client
              </button>
              <button
                onClick={() => startViewAs("developer")}
                className="text-[10.5px] font-mono uppercase tracking-[0.16em] py-1.5 rounded-md border border-white/[0.08] hover:border-[#FF7A00]/45 hover:bg-[#FF7A00]/10 text-white/75 hover:text-white transition-colors"
                title="Preview the Developer Workspace as an audited admin (30 minutes)"
              >
                View as Developer
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Main column ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top strip */}
          <header className="sticky top-0 z-20 bg-[#0B1020]/90 backdrop-blur-xl border-b border-white/[0.06]">
            <div className="px-5 lg:px-7 py-3.5 flex items-center gap-3">
              {/* Mobile: drawer trigger */}
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <button className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-white/[0.08] text-white/75 hover:text-white">
                    <Menu className="w-4 h-4" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[260px] p-0 bg-[#080C18] border-r border-white/[0.06] text-[#E6EAF0]"
                >
                  <SheetTitle className="sr-only">IO SKY Admin Navigation</SheetTitle>
                  <SheetDescription className="sr-only">Mobile navigation drawer for the IO SKY administrator portal.</SheetDescription>
                  <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-white/[0.06]">
                    <IOSkyLogo variant="mark" height={32} />
                    <span className="font-display font-semibold text-[14.5px]">
                      IO <span className="text-[#FF7A00]">SKY</span> Admin
                    </span>
                  </div>
                  <nav className="px-3 py-3">
                    {ADMIN_NAV.map(item => {
                      const active = isActiveHref(location, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setDrawerOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px]",
                            active
                              ? "bg-[#FF7A00]/[0.10] text-[#FF7A00]"
                              : "text-white/70 hover:bg-white/[0.03]",
                          )}
                        >
                          <Icon className="w-[15px] h-[15px]" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>

              {/* Welcome strip */}
              <div className="flex flex-col leading-tight min-w-0 mr-auto">
                <span className="text-[11.5px] font-mono uppercase tracking-[0.2em] text-white/55">
                  Welcome back,
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-semibold text-[20px] md:text-[22px] tracking-tight text-[#E6EAF0] truncate">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono uppercase tracking-[0.18em] bg-[#FF7A00]/12 text-[#FF7A00] border border-[#FF7A00]/30">
                    <span className="w-1 h-1 rounded-full bg-[#FF7A00]" /> Super Administrator
                  </span>
                </div>
                <p className="text-[12px] text-white/55 italic mt-0.5 truncate">"{tagline}"</p>
              </div>

              {/* Center search */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/[0.03] border border-white/[0.07] min-w-[260px] xl:min-w-[360px]">
                <Search className="w-3.5 h-3.5 text-white/45" />
                <input
                  type="text"
                  placeholder="Search anything…"
                  className="bg-transparent flex-1 text-[12.5px] text-white/85 placeholder:text-white/35 outline-none"
                />
                <span className="font-mono text-[10px] text-white/45 px-1.5 py-0.5 rounded-md border border-white/[0.07]">
                  ⌘ K
                </span>
              </div>

              {/* Notification cluster */}
              <div className="flex items-center gap-1.5">
                {[
                  { icon: Shield, count: 7, tone: "alert" as const },
                  { icon: MailIcon, count: 23, tone: "info" as const },
                  { icon: Bell, count: 12, tone: "warn" as const },
                ].map(({ icon: Icon, count, tone }, idx) => (
                  <button
                    key={idx}
                    aria-label="Notifications"
                    className="relative w-9 h-9 rounded-[10px] border border-white/[0.07] hover:border-[#FF7A00]/40 text-white/70 hover:text-white transition-colors"
                  >
                    <Icon className="w-4 h-4 mx-auto" />
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-1.5 px-1 min-w-[18px] h-[18px] rounded-full text-[9.5px] font-mono leading-[18px] text-center",
                        tone === "alert"
                          ? "bg-red-500/90 text-white"
                          : tone === "warn"
                          ? "bg-[#FF7A00]/90 text-[#0B1020]"
                          : "bg-white/15 text-white",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* System status pill */}
              <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-emerald-400/[0.05] border border-emerald-400/25 text-emerald-200">
                <ShieldCheckIcon className="w-3.5 h-3.5" />
                <div className="flex flex-col leading-tight">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-emerald-200/70">
                    System Status
                  </span>
                  <span className="text-[12px]">All Systems Operational</span>
                </div>
              </div>

              {/* Date / time chip */}
              <div className="hidden lg:flex flex-col leading-tight px-3 py-1.5 rounded-[10px] border border-white/[0.07]">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55 flex items-center gap-1">
                  {dateLabel} <ChevronDown className="w-3 h-3 opacity-50" />
                </span>
                <span className="text-[12.5px] text-white/85 mt-0.5">{timeLabel}</span>
              </div>

              {/* Avatar pod */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF7A00] to-[#FFB347] hidden md:flex items-center justify-center text-[11px] font-semibold text-[#0B1020] shrink-0">
                {userInitials || "A"}
              </div>
            </div>

            {/* Action ribbon */}
            <div className="px-5 lg:px-7 pb-3 -mt-1 flex items-center gap-2">
              <span className="font-display font-semibold text-[16px] text-[#E6EAF0]/85">
                {sectionTitle}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-white/[0.07] text-[12px] text-white/75 hover:text-white hover:border-[#FF7A00]/40 transition-colors">
                  View as <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-gradient-to-b from-[#FFB347] to-[#FF7A00] text-[#0B1020] text-[12.5px] font-semibold shadow-[0_6px_18px_-6px_rgba(255, 122, 0,0.55)] hover:brightness-105 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Quick Actions
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 px-5 lg:px-7 py-5 lg:py-6">
            {mfaGateBlocked ? (
              <div className="space-y-4">
                <div className="rounded-[14px] border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 flex items-start gap-3">
                  <KeyRound className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[13px] font-medium text-amber-200">
                      Multi-factor authentication is required for this account
                    </p>
                    <p className="text-[12px] text-amber-200/70 mt-0.5">
                      Administrator and Super Administrator accounts must enroll a second factor
                      before the rest of the console is reachable. This section unlocks
                      automatically once you've enrolled below.
                    </p>
                  </div>
                </div>
                <AdminSecurityCenter />
              </div>
            ) : (
              children
            )}
          </main>

          {/* Bottom feed strip */}
          <footer className="border-t border-white/[0.06] bg-[#080C18]/80 backdrop-blur-xl">
            <div className="px-5 lg:px-7 py-3 flex items-center gap-4 text-[11.5px] text-white/55 overflow-x-auto">
              <span className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.18em] text-emerald-300/80 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
                Live Feed
              </span>
              {[
                ["AI Scan completed for Acme Corp", "2m ago"],
                ["Payment received €8,950", "5m ago"],
                ["Report delivered to TechVision", "8m ago"],
                ["New lead from AI Scan", "12m ago"],
                ["System backup completed", "15m ago"],
              ].map(([msg, when], idx) => (
                <div key={idx} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-white/80 truncate">{msg}</span>
                  <span className="text-white/40">{when}</span>
                </div>
              ))}
              <span className="ml-auto font-mono text-[10.5px] text-white/40 shrink-0">
                © {new Date().getFullYear()} IO SKY. All rights reserved. Operational Intelligence Infrastructure.
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default AdminLayout;
