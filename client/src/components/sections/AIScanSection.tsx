/*
 * IO SKY — "Discover Opportunities" AI Scan preview section (master design).
 *
 * Layout: editorial left column + a wide compound preview panel composed of
 * four columns: 1) AI Scan score donut, 2) Top Issues list, 3) Opportunities
 * list, 4) Start Your Free AI Scan CTA card.
 */
import { Link } from "wouter";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";

export default function AIScanSection() {
  const { t } = useT();
  const ISSUES = [
    { label: t("discover.issue1"), severity: t("discover.severity.high"),   high: true },
    { label: t("discover.issue2"), severity: t("discover.severity.high"),   high: true },
    { label: t("discover.issue3"), severity: t("discover.severity.medium"), high: false },
  ];
  const OPPS = [
    { label: t("discover.opp1"), gain: t("discover.gain1") },
    { label: t("discover.opp2"), gain: t("discover.gain2") },
    { label: t("discover.opp3"), gain: t("discover.gain3") },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-4">
            <div className="eyebrow">{t("discover.eyebrow")}</div>
            <h2 className="mt-5 font-display font-semibold text-[28px] md:text-[34px] leading-[1.15] tracking-[-0.02em] text-[var(--color-ivory)] text-balance">
              {t("discover.title")}
            </h2>
            <p className="mt-5 text-[14px] leading-[1.75] text-[oklch(0.74_0.014_250)] max-w-md">
              {t("discover.body")}
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="feature-card glass p-4 md:p-5 relative">
              <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] font-medium text-[var(--color-orange)] bg-[oklch(0.72_0.205_45/0.12)] border border-[oklch(0.72_0.205_45/0.3)] rounded-sm px-2 py-0.5">
                {t("hov.sample")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Score */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col items-center">
                  <div className="text-[10.5px] uppercase tracking-[0.18em] text-[oklch(0.62_0.014_250)] font-medium">
                    {t("discover.preview")}
                  </div>
                  <ScoreGauge value={78} />
                  <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-[oklch(0.62_0.014_250)]">
                    {t("discover.overallScore")}
                  </div>
                  <div className="text-[12.5px] mt-0.5 text-[var(--color-orange)] font-medium">{t("discover.strongPotential")}</div>
                </div>

                {/* Top Issues */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-orange)] font-semibold">
                    {t("discover.topIssues")}
                  </div>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {ISSUES.map((i) => (
                      <div key={i.label} className="flex items-start gap-2.5">
                        <span className="icon-chip shrink-0" style={{ width: 26, height: 26 }}>
                          <MessageCircleQuestion className="w-3 h-3" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-[var(--color-ivory)] leading-snug truncate">{i.label}</div>
                          <div
                            className={[
                              "text-[10.5px] mt-0.5 font-medium",
                              i.high ? "text-rose-300" : "text-amber-300",
                            ].join(" ")}
                          >
                            {i.severity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opportunities */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-orange)] font-semibold">
                    {t("discover.opportunities")}
                  </div>
                  <div className="mt-3 flex flex-col gap-2.5">
                    {OPPS.map((o) => (
                      <div key={o.label} className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-orange)] shadow-[0_0_6px_var(--color-orange)] shrink-0 mt-1.5" />
                          <div className="text-[12.5px] text-[var(--color-ivory)] leading-snug">{o.label}</div>
                        </div>
                        <div className="text-[10.5px] text-emerald-300 font-mono whitespace-nowrap">{o.gain}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA card */}
                <div className="rounded-lg border border-[oklch(0.72_0.205_45/0.25)] bg-[oklch(0.72_0.205_45/0.06)] p-4 flex flex-col">
                  <div className="text-[15px] font-display font-semibold text-[var(--color-ivory)] leading-snug">
                    {t("discover.cta.title")}
                  </div>
                  <p className="mt-2 text-[12.5px] text-[oklch(0.78_0.014_250)] leading-[1.55]">
                    {t("discover.cta.body")}
                  </p>
                  <Link href="/ai-scan/start?tier=free" className="btn-primary mt-4 justify-center !py-2 !px-3 !text-[12.5px]">
                    {t("discover.cta.btn")}
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                  <Link href="/ai-scan" className="link-orange mt-3 justify-center !text-[12px]">
                    {t("discover.cta.secondary")}
                    <ArrowRight className="w-3 h-3" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreGauge({ value }: { value: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative w-[120px] h-[120px] mt-3 flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 96 96">
        <defs>
          <linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.2 50)" />
            <stop offset="100%" stopColor="oklch(0.62 0.205 42)" />
          </linearGradient>
        </defs>
        <circle cx="48" cy="48" r={r} stroke="oklch(1 0 0 / 0.08)" strokeWidth="7" fill="none" />
        <circle
          cx="48" cy="48" r={r}
          stroke="url(#sgrad)" strokeWidth="7" strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 48 48)"
          style={{ filter: "drop-shadow(0 0 8px oklch(0.72 0.205 45 / 0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[26px] font-display font-semibold text-[var(--color-ivory)] leading-none">{value}</div>
        <div className="text-[10px] text-[oklch(0.6_0.014_250)] mt-0.5 font-mono">/100</div>
      </div>
    </div>
  );
}
