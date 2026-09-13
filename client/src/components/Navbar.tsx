/*
 * IO SKY — Master navbar.
 *
 * Locked design language (per IO SKY master spec):
 *   • deep navy-black atmosphere
 *   • restrained orange interaction language (active = ivory text + orange
 *     underline glow with a small floating dot, hover = soft ivory + orange dot)
 *   • premium glass mega-menu with icon + title + description per child item
 *   • cinematic transitions, smooth easing
 *
 * Layout: Logo · [Infrastructure ▾, Intelligence ▾, Enterprise ▾, AI Scan,
 * Solutions, About, Contact] · Language selector · Log in · Book Discovery Call.
 *
 * Localization: every visible label (including dropdown children + descriptions)
 * is sourced from useT() so changing language re-renders the entire navbar.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, ArrowUpRight, ChevronDown, Globe, Lock,
  UserSquare2, Workflow, Boxes, BarChart3, ShieldCheck, Infinity as InfinityIcon,
  Bot, LineChart, TrendingUp, PieChart, Database, Network,
  Layers, Building2, Gauge, Cpu, Code2, Briefcase,
} from "lucide-react";
import IOSkyLogo from "./IOSkyLogo";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import { LANGUAGES, type LangCode } from "@/lib/i18n";

type NavChild = {
  labelKey: string;
  href: string;
  descKey?: string;
  icon?: ReactNode;
};
type NavItem = {
  labelKey: string;
  href: string;
  children?: NavChild[];
  /** Footer link inside the mega-menu (e.g., "Explore all Infrastructure capabilities →") */
  footerLabelKey?: string;
  footerHref?: string;
};

const ICON_CLASS = "w-[18px] h-[18px]";

const NAV: NavItem[] = [
  {
    labelKey: "nav.infrastructure",
    href: "/infrastructure",
    footerLabelKey: "nav.infra.exploreAll",
    footerHref: "/infrastructure",
    children: [
      { labelKey: "infra.cap.crm.title",       descKey: "infra.cap.crm.short",       href: "/infrastructure#crm",          icon: <UserSquare2 className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "infra.cap.automation.title", descKey: "infra.cap.automation.short", href: "/infrastructure#automation",  icon: <Workflow    className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "infra.cap.integrations.title", descKey: "infra.cap.integrations.short", href: "/infrastructure#integrations", icon: <Boxes      className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "infra.cap.data.title",       descKey: "infra.cap.data.short",       href: "/infrastructure#data",         icon: <BarChart3   className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "infra.cap.security.title",   descKey: "infra.cap.security.short",   href: "/infrastructure#security",     icon: <ShieldCheck className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "infra.cap.scalability.title", descKey: "infra.cap.scalability.short", href: "/infrastructure#scalability", icon: <InfinityIcon className={ICON_CLASS} strokeWidth={1.6} /> },
    ],
  },
  {
    labelKey: "nav.intelligence",
    href: "/intelligence",
    footerLabelKey: "nav.intel.exploreAll",
    footerHref: "/intelligence",
    children: [
      { labelKey: "intel.cap.agents.title",      descKey: "nav.intel.agents.short",      href: "/intelligence#agents",     icon: <Bot        className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "intel.cap.operational.title", descKey: "nav.intel.operational.short", href: "/intelligence#operational", icon: <LineChart  className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "intel.cap.data.title",        descKey: "nav.intel.data.short",        href: "/intelligence#data",       icon: <Database   className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "intel.cap.predictive.title",  descKey: "nav.intel.predictive.short",  href: "/intelligence#predictive", icon: <TrendingUp className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "intel.cap.executive.title",   descKey: "nav.intel.executive.short",   href: "/intelligence#executive",  icon: <PieChart   className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "intel.cap.hub.title",         descKey: "nav.intel.hub.short",         href: "/intelligence#hub",        icon: <Network    className={ICON_CLASS} strokeWidth={1.6} /> },
    ],
  },
  {
    labelKey: "nav.enterprise",
    href: "/enterprise",
    footerLabelKey: "nav.ent.exploreAll",
    footerHref: "/enterprise",
    children: [
      { labelKey: "ent.cap.systems.title",      descKey: "ent.cap.systems.short",      href: "/enterprise#systems",      icon: <Briefcase   className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "ent.cap.aiSystems.title",    descKey: "ent.cap.aiSystems.short",    href: "/enterprise#ai-systems",   icon: <Cpu         className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "ent.cap.customSoftware.title", descKey: "ent.cap.customSoftware.short", href: "/custom-software",      icon: <Code2       className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "ent.cap.security.title",     descKey: "ent.cap.security.short",     href: "/enterprise#security",     icon: <ShieldCheck className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "ent.cap.scalability.title",  descKey: "ent.cap.scalability.short",  href: "/enterprise#scalability",  icon: <Gauge       className={ICON_CLASS} strokeWidth={1.6} /> },
      { labelKey: "ent.cap.integrationHub.title", descKey: "ent.cap.integrationHub.short", href: "/enterprise#integration", icon: <Network    className={ICON_CLASS} strokeWidth={1.6} /> },
    ],
  },
  { labelKey: "nav.aiScan", href: "/ai-scan" },
  { labelKey: "nav.solutions", href: "/solutions" },
  { labelKey: "nav.about", href: "/about" },
  { labelKey: "nav.contact", href: "/contact" },
];

export default function Navbar() {
  const { lang, setLang, t } = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openLang, setOpenLang] = useState(false);
  const [location] = useLocation();
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 14);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setOpenMenu(null);
    setOpenLang(false);
  }, [location]);

  function hover(item: string | null) {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (item === null) {
      closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140);
    } else {
      setOpenMenu(item);
    }
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[backdrop-filter,background,border-color] duration-300",
        scrolled
          ? "backdrop-blur-2xl bg-[oklch(0.09_0.022_260/0.72)] border-b border-white/[0.06]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="container">
        <nav className="flex items-center justify-between h-[68px] md:h-[76px] gap-3">
          {/* Logo */}
          <Link href="/" className="shrink-0 transition-opacity hover:opacity-90" aria-label="IO SKY — Home">
            <IOSkyLogo size="sm" />
          </Link>

          {/* Center nav (desktop) */}
          <div className="hidden lg:flex items-center gap-0.5 whitespace-nowrap">
            {NAV.map((item) => {
              const active =
                location === item.href ||
                (item.children && item.children.some((c) => location.startsWith(c.href.split("#")[0])));
              const isHovered = openMenu === item.labelKey;
              const hasChildren = Boolean(item.children?.length);
              const label = t(item.labelKey);
              return (
                <div
                  key={item.labelKey}
                  className="relative"
                  onMouseEnter={() => hover(item.labelKey)}
                  onMouseLeave={() => hover(null)}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "relative inline-flex items-center gap-1 px-2.5 py-2 text-[13.5px] font-medium tracking-[0.005em] rounded-md transition-colors duration-200 whitespace-nowrap",
                      active || isHovered
                        ? "text-[var(--color-orange)]"
                        : "text-[oklch(0.8_0.012_250)] hover:text-[var(--color-ivory)]",
                    )}
                  >
                    {label}
                    {hasChildren && (
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 transition-transform duration-300",
                          isHovered ? "rotate-180 opacity-100" : "opacity-70",
                        )}
                        strokeWidth={2}
                      />
                    )}
                    {/* Orange underline glow — appears on hover/active */}
                    <span
                      className={cn(
                        "pointer-events-none absolute left-2.5 right-2.5 -bottom-[1px] h-[2px] rounded-full transition-[opacity,transform] duration-300",
                        active || isHovered ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50",
                      )}
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, #FF7A00 50%, transparent 100%)",
                        boxShadow: "0 0 12px rgba(255, 122, 0,0.55)",
                        transformOrigin: "center",
                      }}
                    />
                  </Link>

                  {hasChildren && (
                    <div
                      className={cn(
                        "absolute left-0 top-full pt-3 transition-[opacity,transform] duration-300",
                        (item.children && item.children.length >= 6) ? "min-w-[640px]" : "min-w-[420px]",
                        isHovered
                          ? "opacity-100 translate-y-0 pointer-events-auto"
                          : "opacity-0 translate-y-1 pointer-events-none",
                      )}
                    >
                      <MegaMenu item={item} t={t} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5">
            {/* Language selector */}
            <div
              className="relative hidden lg:block"
              onMouseLeave={() => setOpenLang(false)}
            >
              <button
                type="button"
                onClick={() => setOpenLang((v) => !v)}
                onMouseEnter={() => setOpenLang(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#FF7A00]/30 text-[12.5px] text-[var(--color-ivory)] font-medium transition-colors"
                aria-haspopup="menu"
                aria-expanded={openLang}
                aria-label={t("nav.langLabel")}
              >
                <Globe className="w-3.5 h-3.5 opacity-80" strokeWidth={2} />
                <span className="font-display">{lang}</span>
                <ChevronDown className="w-3 h-3 opacity-70" strokeWidth={2} />
              </button>
              <div
                className={cn(
                  "absolute right-0 top-full pt-2 min-w-[200px] transition-[opacity,transform] duration-200",
                  openLang ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-1 pointer-events-none",
                )}
              >
                <div className="glass-strong p-1.5">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => { setLang(l.code as LangCode); setOpenLang(false); }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-[13px] transition-colors",
                        l.code === lang
                          ? "text-[#FF7A00] bg-[rgba(255,122,0,0.08)]"
                          : "text-[#E6EAF0] hover:bg-white/[0.04] hover:text-[#FF7A00]",
                      )}
                    >
                      <span className="font-mono text-[10.5px] tracking-[0.18em] uppercase opacity-80">{l.code}</span>
                      <span className="text-right">{l.native}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Login */}
            <Link
              href="/login"
              className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#FF7A00]/30 text-[12.5px] text-[var(--color-ivory)] font-medium transition-colors whitespace-nowrap"
            >
              {t("nav.login")}
              <Lock className="w-3.5 h-3.5 opacity-70" strokeWidth={2} />
            </Link>

            {/* Primary CTA */}
            <Link href="/book-strategy" className="hidden md:inline-flex btn-primary !h-9 !py-0 !px-3.5 !text-[12.5px] !whitespace-nowrap">
              {t("nav.cta")}
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.25} />
            </Link>

            {/* Mobile trigger */}
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-white/10 bg-white/[0.03] text-[var(--color-ivory)] active:scale-[0.97] transition-transform"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </div>

      {/*
        Mobile drawer.

        Sized with `h-[calc(100dvh-…)]` rather than `bottom-0`. Dynamic
        viewport units track the mobile browser's collapsing URL bar, which
        `100vh` does not: on iOS Safari `100vh` is the TALLEST the viewport
        ever gets, so a drawer sized that way hides its last rows behind the
        browser chrome exactly when the chrome is showing.

        The background is fully opaque. It was 0.92 alpha over a backdrop
        blur, and the page headline read straight through it on a dark hero.
        A blur is a decoration here, not a substitute for an opaque surface,
        and `backdrop-filter` is the first thing a browser drops under load.
      */}
      <div
        className={cn(
          "lg:hidden fixed inset-x-0 top-[68px] md:top-[76px] z-40 h-[calc(100dvh-68px)] md:h-[calc(100dvh-76px)] transition-[opacity,transform] duration-300",
          open ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-[oklch(0.07_0.022_260)] backdrop-blur-2xl" />
        {/*
          `overscroll-contain` stops a scroll that reaches the end of this
          panel from chaining to the page behind it, which on iOS otherwise
          drags the whole document under the open drawer.
        */}
        <div className="relative h-full overflow-y-auto overscroll-contain">
          {/*
            The bottom padding is what guarantees the two calls to action are
            reachable. `env(safe-area-inset-bottom)` clears the iPhone home
            indicator, which sits over the last ~34px of the viewport and
            would otherwise cover the primary button on exactly the devices
            most likely to see this menu.
          */}
          <div className="container pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] flex flex-col gap-1">
            {NAV.map((item) => (
              <MobileNavItem key={item.labelKey} item={item} t={t} />
            ))}

            {/*
              A fixed two-column grid rather than a wrapping flex row. Ten
              language pills of differing widths wrap to a different number
              of rows at every screen width, so the height of the block below
              them was unpredictable; this is the same height on every phone.
            */}
            <div className="mt-6 grid grid-cols-2 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code as LangCode)}
                  className={cn(
                    "px-3 py-2 rounded-md text-[12.5px] border transition-colors flex items-center gap-2 min-w-0",
                    l.code === lang
                      ? "border-[#FF7A00]/40 text-[#FF7A00] bg-[rgba(255,122,0,0.08)]"
                      : "border-white/10 text-[#E6EAF0] bg-white/[0.03]",
                  )}
                >
                  <span className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-80 shrink-0">
                    {l.code}
                  </span>
                  <span className="truncate">{l.native}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <Link href="/login" className="btn-secondary w-full justify-center !py-4 !text-[14px]">
                {t("nav.login")} <Lock className="w-4 h-4 opacity-70" />
              </Link>
              <Link href="/book-strategy" className="btn-primary w-full justify-center !py-4 !text-[14px]">
                {t("nav.cta")}
                <ArrowUpRight className="w-4 h-4" strokeWidth={2.25} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------- Mega menu panel ---------- */
function MegaMenu({ item, t }: { item: NavItem; t: (k: string) => string }) {
  const isInfra = item.labelKey === "nav.infrastructure";
  const cols = isInfra ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className="glass-strong p-2.5 relative overflow-hidden">
      {/* top accent line */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255, 122, 0,0.5) 50%, transparent 100%)" }}
      />
      <div className={cn("grid gap-1.5", cols)}>
        {item.children!.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-white/[0.04] transition-colors"
          >
            <div
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border border-white/[0.07] bg-white/[0.02] text-[oklch(0.8_0.012_250)] group-hover:text-[var(--color-orange)] group-hover:border-[#FF7A00]/30 group-hover:bg-[rgba(255,122,0,0.06)] transition-colors"
              aria-hidden
            >
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-[var(--color-ivory)] group-hover:text-[var(--color-orange)] transition-colors leading-tight">
                {t(c.labelKey)}
              </div>
              {c.descKey && (
                <div className="mt-0.5 text-[12px] leading-snug text-[oklch(0.7_0.014_250)] line-clamp-2">
                  {t(c.descKey)}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
      {item.footerLabelKey && item.footerHref && (
        <div className="mt-1 border-t border-white/[0.06] pt-2.5 px-2">
          <Link
            href={item.footerHref}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-orange)] hover:gap-2 transition-[gap,color] duration-200"
          >
            {t(item.footerLabelKey)}
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------- Mobile expandable nav item ---------- */
function MobileNavItem({
  item,
  t,
}: {
  item: NavItem;
  t: (k: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <div className="flex items-center">
        {/* Primary route — tap to navigate */}
        <Link
          href={item.href}
          className="flex-1 inline-flex items-center justify-between py-4 text-[18px] font-display font-medium text-[var(--color-ivory)] hover:text-[var(--color-orange)] active:opacity-70 transition-colors"
        >
          <span>{t(item.labelKey)}</span>
        </Link>
        {/* Expand toggle (only when children) */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            onClick={(e) => {
              e.preventDefault();
              setExpanded((v) => !v);
            }}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md hover:bg-white/[0.04] active:scale-[0.97] transition"
          >
            <ChevronDown
              className={cn(
                "w-5 h-5 text-[var(--color-orange)] transition-transform duration-300",
                expanded ? "rotate-180" : "",
              )}
              strokeWidth={2}
            />
          </button>
        ) : (
          <ArrowUpRight className="w-5 h-5 mr-2 text-[var(--color-orange)]" strokeWidth={1.75} />
        )}
      </div>

      {hasChildren && (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            expanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="pb-4 pt-1 flex flex-col gap-1.5">
              {item.children!.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-[#FF7A00]/30 hover:bg-[rgba(255,122,0,0.05)] transition-colors"
                >
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border border-white/[0.07] bg-white/[0.02] text-[oklch(0.8_0.012_250)] [a:hover_&]:text-[var(--color-orange)]"
                    aria-hidden
                  >
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[var(--color-ivory)] leading-tight">
                      {t(c.labelKey)}
                    </div>
                    {c.descKey && (
                      <div className="mt-0.5 text-[12px] leading-snug text-[oklch(0.7_0.014_250)] line-clamp-2">
                        {t(c.descKey)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {item.footerLabelKey && item.footerHref && (
                <Link
                  href={item.footerHref}
                  className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-orange)] hover:gap-2 transition-[gap,color] duration-200 pl-3"
                >
                  {t(item.footerLabelKey)}
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
