/**
 * IO SKY — Cookie Consent banner.
 *
 * GDPR/AVG-compliant cookie consent banner with locale-aware copy.
 *   - Appears bottom-aligned, non-modal, on every page until a decision is recorded.
 *   - Offers Accept all / Reject all / Customise — all three are equally weighted.
 *   - Strictly necessary (functional) cookies are explained but cannot be disabled.
 *   - Persists the decision via `useCookieConsent` (localStorage + DB).
 *   - Links to the live `/cookies` policy and `/privacy` policy.
 *   - Final polish: subtler border, lighter shadow, tighter dimensions.
 */
import { useState } from "react";
import { Link } from "wouter";
import {
  type ConsentCategories,
  useCookieConsent,
} from "@/hooks/useCookieConsent";
import { useT } from "@/contexts/LanguageContext";

function tx(ctx: ReturnType<typeof useT>, key: string, fallback: string): string {
  const v = ctx.t(key);
  return v === key ? fallback : v;
}

function ToggleRow({
  title,
  body,
  enabled,
  required,
  requiredLabel,
  onToggle,
}: {
  title: string;
  body: string;
  enabled: boolean;
  required?: boolean;
  requiredLabel: string;
  onToggle?: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#E6EAF010] last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#E6EAF0] flex items-center gap-2">
          {title}
          {required && (
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#E6EAF080] border border-[#E6EAF030] rounded px-1.5 py-0.5">
              {requiredLabel}
            </span>
          )}
        </p>
        <p className="mt-1 text-[12px] text-[#E6EAF0B3] leading-[1.55]">{body}</p>
      </div>
      <button
        type="button"
        disabled={required}
        onClick={() => onToggle && onToggle(!enabled)}
        className={`mt-1 flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 ease-out ${
          enabled ? "bg-[#FF7A1A]" : "bg-[#FFFFFF20]"
        } ${required ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        aria-label={`${title} consent toggle`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-[#0a0f1e] shadow transition-transform duration-200 ease-out ${
            enabled ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

export function CookieConsentBanner() {
  const consent = useCookieConsent();
  const ctx = useT();
  const [showCustomise, setShowCustomise] = useState(false);
  const [draft, setDraft] = useState<ConsentCategories>({
    functional: true,
    analytics: false,
    marketing: false,
  });

  if (consent.isResolved) return null;

  const L = {
    eyebrow: tx(ctx, "cookie.eyebrow", "Cookie consent"),
    title: tx(ctx, "cookie.title", "We respect your data sovereignty"),
    body1: tx(
      ctx,
      "cookie.body.1",
      "IO SKY uses strictly necessary cookies to keep your session secure and load-balanced. Analytics and marketing cookies are",
    ),
    body2: tx(ctx, "cookie.body.optin", "opt-in only"),
    body3: tx(
      ctx,
      "cookie.body.2",
      "and never shared with third-party advertisers. Read our",
    ),
    linkCookies: tx(ctx, "cookie.link.cookies", "Cookie Policy"),
    linkPrivacy: tx(ctx, "cookie.link.privacy", "Privacy Notice"),
    body4: tx(ctx, "cookie.body.3", "for the full versioned record."),
    and: tx(ctx, "cookie.and", "and"),
    acceptAll: tx(ctx, "cookie.btn.acceptAll", "Accept all"),
    rejectNonEssential: tx(ctx, "cookie.btn.rejectNonEssential", "Reject non-essential"),
    customise: tx(ctx, "cookie.btn.customise", "Customise"),
    back: tx(ctx, "cookie.btn.back", "Back"),
    save: tx(ctx, "cookie.btn.save", "Save preferences"),
    required: tx(ctx, "cookie.toggle.required", "Required"),
    strictTitle: tx(ctx, "cookie.cat.strict.title", "Strictly necessary"),
    strictBody: tx(
      ctx,
      "cookie.cat.strict.body",
      "Session security, load balancing and consent persistence. Required for the platform to operate.",
    ),
    analyticsTitle: tx(ctx, "cookie.cat.analytics.title", "Analytics"),
    analyticsBody: tx(
      ctx,
      "cookie.cat.analytics.body",
      "First-party, server-side analytics that help us improve the platform. No cross-site tracking.",
    ),
    marketingTitle: tx(ctx, "cookie.cat.marketing.title", "Marketing"),
    marketingBody: tx(
      ctx,
      "cookie.cat.marketing.body",
      "Used only to remember if you arrived from a campaign. Disabled by default. We never run advertising pixels.",
    ),
  };

  return (
    <div
      role="dialog"
      aria-label={L.title}
      className="fixed left-0 right-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none"
    >
      <div className="container max-w-2xl pointer-events-auto">
        <div className="rounded-xl border border-[#E6EAF0]/[0.08] bg-[#0a0f1e]/[0.94] backdrop-blur-xl shadow-[0_18px_48px_-22px_rgba(0,0,0,0.7)] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-[10.5px] font-mono uppercase tracking-[0.2em] text-[#FF7A1A]/90">
                {L.eyebrow}
              </p>
              <h2 className="mt-1 text-[15px] sm:text-[16px] font-display font-medium text-[#E6EAF0]">
                {L.title}
              </h2>
            </div>
          </div>

          {!showCustomise && (
            <>
              <p className="text-[12.5px] text-[#E6EAF0]/75 leading-[1.6]">
                {L.body1}{" "}
                <span className="text-[#E6EAF0]">{L.body2}</span> {L.body3}{" "}
                <Link
                  href="/cookies"
                  className="text-[#FF7A1A] hover:underline"
                >
                  {L.linkCookies}
                </Link>{" "}
                {L.and}{" "}
                <Link
                  href="/privacy"
                  className="text-[#FF7A1A] hover:underline"
                >
                  {L.linkPrivacy}
                </Link>{" "}
                {L.body4}
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={consent.isSaving}
                  onClick={() => consent.acceptAll()}
                  className="rounded-lg bg-[#FF7A1A] hover:bg-[#FF8A33] active:scale-[0.97] text-[#0a0f1e] text-[12.5px] font-medium py-2.5 px-4 transition-all duration-150 ease-out disabled:opacity-60"
                >
                  {L.acceptAll}
                </button>
                <button
                  type="button"
                  disabled={consent.isSaving}
                  onClick={() => consent.rejectAll()}
                  className="rounded-lg border border-[#E6EAF030] hover:border-[#E6EAF060] hover:bg-[#FFFFFF06] active:scale-[0.97] text-[#E6EAF0] text-[12.5px] font-medium py-2.5 px-4 transition-all duration-150 ease-out disabled:opacity-60"
                >
                  {L.rejectNonEssential}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft({
                      functional: true,
                      analytics: consent.categories.analytics,
                      marketing: consent.categories.marketing,
                    });
                    setShowCustomise(true);
                  }}
                  className="rounded-lg border border-[#E6EAF015] hover:border-[#FF7A1A]/50 hover:text-[#FF7A1A] active:scale-[0.97] text-[#E6EAF0CC] text-[12.5px] font-medium py-2.5 px-4 transition-all duration-150 ease-out"
                >
                  {L.customise}
                </button>
              </div>
            </>
          )}

          {showCustomise && (
            <>
              <ToggleRow
                title={L.strictTitle}
                body={L.strictBody}
                enabled
                required
                requiredLabel={L.required}
              />
              <ToggleRow
                title={L.analyticsTitle}
                body={L.analyticsBody}
                enabled={draft.analytics}
                requiredLabel={L.required}
                onToggle={(next) =>
                  setDraft((prev) => ({ ...prev, analytics: next }))
                }
              />
              <ToggleRow
                title={L.marketingTitle}
                body={L.marketingBody}
                enabled={draft.marketing}
                requiredLabel={L.required}
                onToggle={(next) =>
                  setDraft((prev) => ({ ...prev, marketing: next }))
                }
              />

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCustomise(false)}
                  className="rounded-lg border border-[#E6EAF015] hover:border-[#E6EAF040] active:scale-[0.97] text-[#E6EAF0CC] text-[12.5px] font-medium py-2.5 px-4 transition-all duration-150 ease-out"
                >
                  {L.back}
                </button>
                <button
                  type="button"
                  disabled={consent.isSaving}
                  onClick={() => consent.saveCustom(draft)}
                  className="rounded-lg bg-[#FF7A1A] hover:bg-[#FF8A33] active:scale-[0.97] text-[#0a0f1e] text-[12.5px] font-medium py-2.5 px-4 transition-all duration-150 ease-out disabled:opacity-60"
                >
                  {L.save}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
