/*
 * IO SKY — "The Solution" section (master design).
 *
 * Left column: eyebrow + headline + body + "Explore our infrastructure →".
 * Right column: central IO hex hub with 6 radial connector pills:
 *   LEFT  → CRM & Pipeline, Automation, Communication
 *   RIGHT → Dashboards, Analytics, Integrations
 */
import { Link } from "wouter";
import { ArrowRight, Workflow, MessagesSquare, LayoutDashboard, BarChart3, Plug, GitBranch } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function EcosystemOverview() {
  const { t } = useT();
  const LEFT_PILLS = [
    { icon: GitBranch,      label: t("solution.pill.crm") },
    { icon: Workflow,       label: t("solution.pill.automation") },
    { icon: MessagesSquare, label: t("solution.pill.communication") },
  ];
  const RIGHT_PILLS = [
    { icon: LayoutDashboard, label: t("solution.pill.dashboards") },
    { icon: BarChart3,       label: t("solution.pill.analytics") },
    { icon: Plug,            label: t("solution.pill.integrations") },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left copy */}
          <div className="lg:col-span-5">
            <div className="eyebrow">{t("solution.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[30px] md:text-[36px] leading-[1.12] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("solution.title")}
            </h2>
            <p className="mt-5 text-[14.5px] leading-[1.75] text-[oklch(0.74_0.014_250)] max-w-lg">
              {t("solution.body")}
            </p>
            <Link href="/infrastructure" className="mt-7 link-orange">
              {t("solution.link")}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          {/* Right hub */}
          <div className="lg:col-span-7">
            <HubDiagram LEFT_PILLS={LEFT_PILLS} RIGHT_PILLS={RIGHT_PILLS} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HubDiagram({ LEFT_PILLS, RIGHT_PILLS }: { LEFT_PILLS: {icon:any;label:string}[]; RIGHT_PILLS: {icon:any;label:string}[] }) {
  return (
    <div className="relative w-full">
      <div className="grid grid-cols-3 items-center gap-3 md:gap-5 relative">
        {/* Connector lines (desktop only) */}
        <svg
          aria-hidden="true"
          className="hidden md:block absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 600 320"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cgrad-l" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.72 0.205 45 / 0)" />
              <stop offset="60%" stopColor="oklch(0.72 0.205 45 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.72 0.205 45 / 0.85)" />
            </linearGradient>
            <linearGradient id="cgrad-r" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="oklch(0.72 0.205 45 / 0)" />
              <stop offset="60%" stopColor="oklch(0.72 0.205 45 / 0.55)" />
              <stop offset="100%" stopColor="oklch(0.72 0.205 45 / 0.85)" />
            </linearGradient>
          </defs>
          {[60, 160, 260].map((y) => (
            <path key={`l${y}`} d={`M 180 ${y} C 230 ${y}, 250 160, 300 160`} stroke="url(#cgrad-l)" strokeWidth="1.25" fill="none" />
          ))}
          {[60, 160, 260].map((y) => (
            <path key={`r${y}`} d={`M 420 ${y} C 370 ${y}, 350 160, 300 160`} stroke="url(#cgrad-r)" strokeWidth="1.25" fill="none" />
          ))}
        </svg>

        {/* Left pills */}
        <div className="flex flex-col gap-3 md:gap-5 relative z-10">
          {LEFT_PILLS.map((p) => <Pill key={p.label} icon={p.icon} label={p.label} />)}
        </div>

        {/* Hub */}
        <div className="flex items-center justify-center relative z-10">
          <Hub />
        </div>

        {/* Right pills */}
        <div className="flex flex-col gap-3 md:gap-5 relative z-10">
          {RIGHT_PILLS.map((p) => <Pill key={p.label} icon={p.icon} label={p.label} />)}
        </div>
      </div>
    </div>
  );
}

function Pill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <div className="feature-card glass-soft inline-flex items-center gap-3 px-3.5 py-3 max-w-full">
      <span className="icon-chip" style={{ width: 30, height: 30 }}>
        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
      </span>
      <span className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-[var(--color-ivory)] font-semibold whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

function Hub() {
  return (
    <div className="relative w-[180px] h-[180px] md:w-[220px] md:h-[220px] flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-[oklch(0.72_0.205_45/0.1)] blur-[40px]" />
      <div className="absolute inset-4 rounded-full border border-[oklch(0.72_0.205_45/0.25)]" />
      <div className="absolute inset-8 rounded-full border border-[oklch(0.72_0.205_45/0.35)]" />
      <div className="absolute inset-14 rounded-full border border-[oklch(0.72_0.205_45/0.55)] shadow-[0_0_24px_oklch(0.72_0.205_45/0.45)_inset]" />
      <div className="relative z-10">
        {/* Official IO symbol mark at the center of the ecosystem hub */}
        <img
          src="/manus-storage/iosky-mark-transparent_9aba89cd.png"
          alt="IO SKY"
          width={72}
          height={70}
          draggable={false}
          className="select-none pointer-events-none drop-shadow-[0_0_18px_rgba(255,106,0,0.45)]"
          style={{ width: 72, height: 70 }}
        />
      </div>
    </div>
  );
}
