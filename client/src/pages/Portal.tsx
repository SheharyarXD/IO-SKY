/*
 * IO SKY — Portal stubs.
 * Three role-scoped landing surfaces (Client / Admin / Developer) the login
 * flow can route into. Premium dark layout matching the IO SKY design
 * language, with a sidebar, header chip, and a "Coming soon" hero that
 * surfaces what each role will see in production. This page is intentionally
 * non-functional and contains no real data — production builds connect to
 * the IdP-issued JWT and load real dashboards.
 */
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  User,
  ShieldAlert,
  Code2,
  Activity,
  FileText,
  Users,
  Settings,
  Boxes,
  Sparkles,
  GitBranch,
  KeyRound,
  Webhook,
  LogOut,
} from "lucide-react";
import IOSkyLogo from "@/components/IOSkyLogo";
import { useT } from "@/contexts/LanguageContext";

type Role = "client" | "admin" | "developer";

function useLocalT() {
  const ctx = useT();
  return (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };
}

const ROLE_CONFIG: Record<
  Role,
  {
    title: string;
    sub: string;
    icon: React.ReactNode;
    nav: { label: string; icon: React.ReactNode }[];
    chip: string;
  }
> = {
  client: {
    title: "Client Portal",
    sub: "Reports, projects, invoices and performance insights.",
    icon: <User size={18} strokeWidth={1.9} className="text-[#FF6A00]" />,
    chip: "CLIENT",
    nav: [
      { label: "Overview", icon: <Activity size={15} strokeWidth={1.9} /> },
      { label: "Reports", icon: <FileText size={15} strokeWidth={1.9} /> },
      { label: "Projects", icon: <Boxes size={15} strokeWidth={1.9} /> },
      { label: "Invoices", icon: <FileText size={15} strokeWidth={1.9} /> },
      { label: "Performance", icon: <Sparkles size={15} strokeWidth={1.9} /> },
      { label: "Settings", icon: <Settings size={15} strokeWidth={1.9} /> },
    ],
  },
  admin: {
    title: "Admin Portal",
    sub: "Manage users, clients, scans, reports and system settings with full control.",
    icon: <ShieldAlert size={18} strokeWidth={1.9} className="text-[#FF6A00]" />,
    chip: "ADMIN",
    nav: [
      { label: "Overview", icon: <Activity size={15} strokeWidth={1.9} /> },
      { label: "Users", icon: <Users size={15} strokeWidth={1.9} /> },
      { label: "Clients", icon: <Boxes size={15} strokeWidth={1.9} /> },
      { label: "AI Scans", icon: <Sparkles size={15} strokeWidth={1.9} /> },
      { label: "Reports", icon: <FileText size={15} strokeWidth={1.9} /> },
      { label: "Settings", icon: <Settings size={15} strokeWidth={1.9} /> },
    ],
  },
  developer: {
    title: "Developer Workspace",
    sub: "Build, deploy and manage integrations within the IO SKY ecosystem.",
    icon: <Code2 size={18} strokeWidth={1.9} className="text-[#FF6A00]" />,
    chip: "DEVELOPER",
    nav: [
      { label: "Overview", icon: <Activity size={15} strokeWidth={1.9} /> },
      { label: "Projects", icon: <Boxes size={15} strokeWidth={1.9} /> },
      { label: "API Keys", icon: <KeyRound size={15} strokeWidth={1.9} /> },
      { label: "Webhooks", icon: <Webhook size={15} strokeWidth={1.9} /> },
      { label: "Deployments", icon: <GitBranch size={15} strokeWidth={1.9} /> },
      { label: "Docs", icon: <FileText size={15} strokeWidth={1.9} /> },
    ],
  },
};

export default function Portal({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  const t = useLocalT();
  const [, navigate] = useLocation();

  function signOut() {
    try {
      localStorage.removeItem("iosky.login.remember");
    } catch {
      /* ignore */
    }
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E6EAF0]">
      {/* Top bar */}
      <header className="border-b border-white/[0.06] bg-[#0B1020]/85 backdrop-blur sticky top-0 z-20">
        <div className="container flex items-center justify-between py-3.5">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center">
              <IOSkyLogo variant="primary" className="h-6 w-auto" />
            </Link>
            <span className="hidden sm:inline-block font-mono text-[10.5px] tracking-[0.22em] uppercase text-[#FF6A00] border border-[#FF6A00]/30 bg-[#FF6A00]/08 rounded-md px-2 py-1">
              {cfg.chip}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-[12.5px] text-[#E6EAF0]/70 hover:text-[#FF6A00] transition px-3 py-1.5"
            >
              <ArrowLeft size={14} strokeWidth={1.9} />
              {t("portal.back", "Back to login")}
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] hover:border-[rgba(255,106,0,0.35)] px-3 py-1.5 text-[12.5px] text-[#E6EAF0]/80 transition"
            >
              <LogOut size={13} strokeWidth={1.9} />
              {t("portal.signout", "Sign out")}
            </button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid lg:grid-cols-[220px_1fr] gap-7">
          {/* Sidebar */}
          <aside className="glass-soft border border-white/[0.07] rounded-xl p-3.5 h-fit">
            <div className="flex items-center gap-2.5 mb-3 px-2 py-1.5">
              <div className="w-8 h-8 rounded-md bg-[#FF6A00]/10 border border-[#FF6A00]/30 flex items-center justify-center">
                {cfg.icon}
              </div>
              <div>
                <p className="font-display font-semibold text-[12.5px] text-[#E6EAF0] leading-[1.1]">
                  {t(`portal.${role}.title`, cfg.title)}
                </p>
                <p className="text-[10.5px] text-[#E6EAF0]/55">v1.0 · sandbox</p>
              </div>
            </div>
            <nav className="space-y-1">
              {cfg.nav.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  className={[
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12.5px] transition",
                    i === 0
                      ? "bg-[#FF6A00]/10 text-[#E6EAF0] border border-[#FF6A00]/30"
                      : "text-[#E6EAF0]/70 hover:text-[#E6EAF0] hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <span className={i === 0 ? "text-[#FF6A00]" : "text-[#E6EAF0]/55"}>
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Body */}
          <section>
            <div className="glass border border-white/[0.08] rounded-2xl p-7 md:p-9">
              <div className="font-mono text-[10.5px] tracking-[0.22em] uppercase text-[#FF6A00]">
                {t("portal.eyebrow", "Sandbox preview")}
              </div>
              <h1 className="mt-3 font-display font-semibold text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.018em] text-[#E6EAF0]">
                {t(`portal.${role}.welcome`, `Welcome to your ${cfg.title}.`)}
              </h1>
              <p className="mt-3.5 text-[14px] text-[#E6EAF0]/65 leading-[1.65] max-w-[640px]">
                {t(`portal.${role}.sub`, cfg.sub)}{" "}
                {t(
                  "portal.note",
                  "This sandbox preview confirms that the secure session was created and the role routing works. In production this view connects to the IdP-issued JWT and loads the real dashboard.",
                )}
              </p>

              <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {cfg.nav.slice(1, 4).map((item) => (
                  <div
                    key={item.label}
                    className="glass-soft border border-white/[0.07] rounded-xl p-4 lift-on-hover"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#FF6A00]/10 border border-[#FF6A00]/30 flex items-center justify-center mb-3 text-[#FF6A00]">
                      {item.icon}
                    </div>
                    <p className="font-display font-semibold text-[13.5px] text-[#E6EAF0]">
                      {item.label}
                    </p>
                    <p className="text-[11.5px] text-[#E6EAF0]/55 mt-1 leading-[1.55]">
                      {t(
                        "portal.tile.placeholder",
                        "Module data loads after secure session is validated.",
                      )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/" className="btn-secondary">
                  <ArrowLeft size={14} strokeWidth={2.2} />
                  {t("portal.back-home", "Back to homepage")}
                </Link>
                <Link href="/contact" className="btn-primary">
                  {t("portal.contact", "Contact your account manager")}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
