/*
 * IO SKY — Live Ops Ticker.
 *
 * A horizontal, slowly-scrolling strip of operational telemetry that lives
 * between the hero and the "Real Problem" section. The purpose is purely
 * perceptual: it makes the homepage feel like a live operational platform
 * instead of a marketing page.
 *
 * Notes
 * - Animation is pure CSS (`@keyframes liveOpsScroll`), GPU-friendly transform.
 * - The strip pauses on hover so visitors can read individual rows.
 * - Honors `prefers-reduced-motion` (animation disabled, content centred).
 * - All visible labels go through useT() so they translate cleanly.
 */

import { useT } from "@/contexts/LanguageContext";
import { Activity, CheckCircle2, Cpu, Globe2, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";

type TickerEvent = {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  region: string;
  tone: "ok" | "live" | "alert";
};

export default function LiveOpsTicker() {
  const { t } = useT();

  const EVENTS: TickerEvent[] = [
    { icon: Activity,      label: t("ticker.aiScan.completed"),     region: t("ticker.cap.aiScan"),     tone: "ok"    },
    { icon: Workflow,      label: t("ticker.workflow.synced"),      region: t("ticker.cap.workflow"),   tone: "ok"    },
    { icon: ShieldCheck,   label: t("ticker.security.verified"),    region: t("ticker.cap.security"),   tone: "ok"    },
    { icon: Cpu,           label: t("ticker.agent.deployed"),       region: t("ticker.cap.agent"),      tone: "live"  },
    { icon: Sparkles,      label: t("ticker.report.generated"),     region: t("ticker.cap.report"),     tone: "live"  },
    { icon: Globe2,        label: t("ticker.region.online"),        region: t("ticker.cap.region"),     tone: "ok"    },
    { icon: Zap,           label: t("ticker.automation.triggered"), region: t("ticker.cap.automation"), tone: "live"  },
    { icon: CheckCircle2,  label: t("ticker.payment.reconciled"),   region: t("ticker.cap.payment"),    tone: "ok"    },
  ];

  // Duplicate the list once so the CSS scroll loops seamlessly.
  const LOOP = [...EVENTS, ...EVENTS];

  return (
    <section
      aria-label={t("ticker.aria")}
      className="relative border-y border-[oklch(1_0_0/0.06)] bg-[oklch(0.08_0.022_260/0.6)] backdrop-blur-md overflow-hidden"
    >
      <div className="relative">
        <div className="ticker-track flex items-center gap-10 px-6 py-3 whitespace-nowrap">
          {LOOP.map((event, i) => (
            <TickerRow key={`${event.label}-${i}`} event={event} />
          ))}
        </div>
        {/* Edge fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0B1020] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0B1020] to-transparent" />
      </div>
    </section>
  );
}

function TickerRow({ event }: { event: TickerEvent }) {
  const Icon = event.icon;
  const dotColor =
    event.tone === "alert" ? "bg-[oklch(0.75_0.18_30)]" :
    event.tone === "live"  ? "bg-[var(--color-orange)] pulse-orange" :
                              "bg-[oklch(0.7_0.18_150)]";
  return (
    <span className="inline-flex items-center gap-3 text-[11.5px] font-mono uppercase tracking-[0.16em]">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      <Icon className="w-3.5 h-3.5 text-[oklch(0.88_0.01_250)]" strokeWidth={1.75} />
      <span className="text-[var(--color-ivory)] font-semibold">{event.label}</span>
      <span className="text-[oklch(0.6_0.018_250)]">{event.region}</span>
    </span>
  );
}
