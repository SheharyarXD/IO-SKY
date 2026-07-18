/*
 * IO SKY — Master footer.
 * Layout:
 *   Brand (logo + body) + 4 public link columns
 *   Bottom strip: © · Privacy · Terms · Cookie Policy · Security
 *
 * No newsletter form and no portal/login links — the footer surfaces only
 * public-facing destinations. Localization: every label is sourced from useT().
 */
import { Link } from "wouter";
import { Linkedin, Youtube, Twitter } from "lucide-react";
import type { ReactNode } from "react";
import IOSkyLogo from "./IOSkyLogo";
import { useT } from "@/contexts/LanguageContext";

type FooterCol = {
  titleKey: string;
  links: { labelKey: string; href: string }[];
};

type SocialLink = { icon: ReactNode; href: string; label: string };

/**
 * Official IO SKY social profiles. Intentionally empty until verified
 * accounts exist — the footer hides the row rather than render dead links.
 * Populate with real https URLs (and the matching lucide icon) to enable.
 * Available icons already imported: Linkedin, Youtube, Twitter.
 */
const SOCIAL_LINKS: SocialLink[] = [];
void Linkedin;
void Youtube;
void Twitter;

const COLS: FooterCol[] = [
  {
    titleKey: "footer.col.infrastructure",
    links: [
      { labelKey: "footer.nav.infra.operational", href: "/infrastructure" },
      { labelKey: "footer.nav.infra.automation", href: "/infrastructure#automation" },
      { labelKey: "footer.nav.infra.data", href: "/infrastructure#data" },
      { labelKey: "footer.nav.infra.integrations", href: "/infrastructure#integrations" },
      { labelKey: "footer.nav.infra.security", href: "/infrastructure#security" },
    ],
  },
  {
    titleKey: "footer.col.intelligence",
    links: [
      { labelKey: "footer.nav.intel.agents", href: "/intelligence#ai-agents" },
      { labelKey: "footer.nav.intel.operational", href: "/intelligence#operational-intelligence" },
      { labelKey: "footer.nav.intel.predictive", href: "/intelligence#predictive-systems" },
      { labelKey: "footer.nav.intel.executive", href: "/intelligence#executive-analytics" },
      { labelKey: "footer.nav.intel.hub", href: "/intelligence#hub" },
    ],
  },
  {
    titleKey: "footer.col.solutions",
    links: [
      { labelKey: "footer.solutions.aiScan", href: "/ai-scan" },
      { labelKey: "footer.solutions.growth", href: "/solutions/growth-ecosystem" },
      { labelKey: "footer.solutions.elite", href: "/solutions/elite-ecosystem" },
      { labelKey: "footer.solutions.custom", href: "/solutions/custom-intelligence-infrastructure" },
    ],
  },
  {
    titleKey: "footer.col.company",
    links: [
      { labelKey: "footer.company.about", href: "/about" },
      { labelKey: "footer.company.contact", href: "/contact" },
      { labelKey: "footer.company.book", href: "/book-strategy" },
    ],
  },
];

export default function Footer() {
  const { t } = useT();

  return (
    <footer className="relative mt-16 md:mt-24 border-t border-white/[0.06]">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-[var(--color-orange)]/40 to-transparent" />
      <div className="container py-10 md:py-12">
        {/* Top: brand + 4 link cols */}
        <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-y-10 gap-x-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-6 lg:col-span-4">
            <IOSkyLogo size="md" />
            <p className="mt-5 text-[13px] text-[oklch(0.74_0.014_250)] leading-relaxed max-w-sm">
              {t("footer.brand.body")}
            </p>
            {SOCIAL_LINKS.length > 0 && (
              <div className="mt-5 flex items-center gap-2.5">
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-8 h-8 grid place-items-center rounded-md border border-white/[0.08] bg-white/[0.03] text-[oklch(0.78_0.014_250)] hover:text-[var(--color-orange)] hover:border-[var(--color-orange)]/40 transition-colors"
                  >
                    {s.icon}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* 4 link columns */}
          {COLS.map((col) => (
            <div key={col.titleKey} className="md:col-span-3 lg:col-span-2">
              <div className="text-[13px] text-[var(--color-ivory)] font-medium tracking-[-0.005em] mb-4">
                {t(col.titleKey)}
              </div>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href + l.labelKey}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors"
                    >
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom strip */}
        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-[12px] text-[oklch(0.6_0.014_250)]">
            {t("footer.copyright")}
          </div>
          <div className="flex items-center flex-wrap gap-5 text-[12.5px]">
            <Link href="/legal/privacy" className="text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors">
              {t("footer.privacy")}
            </Link>
            <Link href="/legal/terms" className="text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors">
              {t("footer.terms")}
            </Link>
            <Link href="/legal/cookies" className="text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors">
              {t("footer.cookies")}
            </Link>
            <Link href="/legal/ai-disclaimer" className="text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors">
              {t("footer.aiDisclaimer")}
            </Link>
            <Link href="/legal/security" className="text-[oklch(0.74_0.014_250)] hover:text-[var(--color-orange)] transition-colors">
              {t("footer.security")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
