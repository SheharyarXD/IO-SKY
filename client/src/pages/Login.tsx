/*
 * IO SKY — Login Portal.
 *
 * Premium 3-column authentication surface that matches the official mockup
 * and the LOGIN PORTAL MASTER SPECIFICATION:
 *
 *   LEFT      — cinematic hero: brand wordmark, headline with orange
 *                "operational intelligence" phrase, body, globe background,
 *                and a four-tile "Enterprise-grade security. Always." trust strip.
 *   CENTER    — premium login card: lock-shield icon, headline, email,
 *                password (show/hide), Remember me, Forgot password,
 *                Sign In, divider, Sign in with SSO menu (Google / Microsoft / Apple),
 *                and two footer links: Request Access (left) and
 *                Developer Access (right).
 *   RIGHT     — "Select Your Portal" rail with three hover-lift cards
 *                (Client Portal, Admin Portal, Developer Workspace),
 *                followed by a Need-help tile.
 *   BOTTOM    — full-width metrics strip (Uptime, Encryption, Monitoring,
 *                Data Protection) + "Built for trust. Designed for impact." block.
 *
 * Locked design tokens only: deep navy-black background, restrained orange
 * interaction language, premium glass surfaces, executive typography hierarchy.
 *
 * The page intentionally does NOT render the global Navbar (per spec) — a
 * minimal header is used so the focus stays on authentication. Footer is
 * also replaced with the dedicated trust strip + minimal links.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useT } from "@/contexts/LanguageContext";
import IOSkyLogo from "@/components/IOSkyLogo";
import { trpc } from "@/lib/trpc";
import { getSupabaseClient } from "@/lib/supabase";
import { getLoginUrl } from "@/const";
import { debugLog } from "@/lib/debugLog";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Headphones,
  User,
  ShieldAlert,
  Code2,
  KeyRound,
  Activity,
  Database,
  Award,
  ChevronDown,
} from "lucide-react";
import LogoLoader from "@/components/LogoLoader";

/* ------------------------------------------------------------------ */
/* Static asset URLs                                                  */
/* ------------------------------------------------------------------ */
const GLOBE_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663657847143/YvCUjmiq4ztE2dxYNn2BqA/io-login-globe-mockup-gG2umyFn7pmEaQUAbKnbxL.webp";

/* ------------------------------------------------------------------ */
/* Localised label helper — falls back to the provided English string */
/* ------------------------------------------------------------------ */
function useLocalT() {
  const ctx = useT();
  return (key: string, fallback: string) => {
    const v = ctx.t(key);
    return v === key ? fallback : v;
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */
function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Login() {
  const t = useLocalT();
  const [, navigate] = useLocation();

  /* ---- form state ---- */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const recordAttempt = trpc.auth.recordAttempt.useMutation();

  /* ---- SSO menu state ---- */
  const [ssoOpen, setSsoOpen] = useState(false);
  const ssoMenuRef = useRef<HTMLDivElement | null>(null);

  /* ---- forgot password modal ---- */
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  /* ---- anti-spam ---- */
  const formMountedAt = useRef<number>(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const [lastSubmitAt, setLastSubmitAt] = useState<number | null>(null);

  /* ---- hydrate Remember-me ---- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("iosky.login.remember");
      if (saved) setEmail(saved);
    } catch {
      /* ignore */
    }
  }, []);

  /* ---- close SSO menu on outside click ---- */
  useEffect(() => {
    if (!ssoOpen) return;
    function onDown(e: MouseEvent) {
      if (ssoMenuRef.current && !ssoMenuRef.current.contains(e.target as Node)) {
        setSsoOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ssoOpen]);

  /* ---- validation helpers ---- */
  const formInvalid = useMemo(() => {
    return !validEmail(email) || password.length < 8;
  }, [email, password]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!validEmail(email)) next.email = t("login.err.email", "Enter a valid work email");
    if (password.length < 8)
      next.password = t("login.err.password", "Password must be at least 8 characters");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /* ---- shared post-login redirect ---- */
  function redirectToTarget(target: string) {
    setSubmitting(false);
    setFormError(null);
    // Dismiss all Sonner toasts BEFORE navigating to prevent the React 18
    // removeChild crash: Sonner mounts portals into document.body, and
    // window.location.href tears down the DOM before React can unmount them.
    toast.dismiss();
    debugLog.log("login_redirect_scheduled", { target, delay: "rAF x2" });
    // Double requestAnimationFrame gives React one full commit cycle to
    // flush and unmount all portal nodes before the hard navigation fires.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        debugLog.log("login_redirect_executing", { target });
        window.location.href = target;
      });
    });
  }

  /**
   * RM-50: try Supabase Auth first (the Path A source of truth for new
   * sign-ins). Returns true if it produced a session and the caller should
   * stop (redirect already scheduled or a Supabase-specific error was
   * shown) — false to fall through to the legacy local-password path
   * below, which covers every existing account that hasn't got a Supabase
   * identity yet (nothing has been migrated to Supabase Auth server-side).
   */
  async function trySupabaseLogin(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false; // not configured in this environment

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.session) {
      // Not a Supabase account (or wrong password) - fall through silently
      // to the local-password path rather than showing a Supabase-specific
      // error, since most existing accounts simply don't have one yet.
      return false;
    }

    try {
      const res = await fetch("/api/auth/supabase/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken: data.session.access_token }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        role?: string;
        next?: string;
        mfaRequired?: boolean;
      };
      if (!res.ok || !json.ok) {
        // Supabase itself authenticated the user but our bridge rejected
        // it (server error) - surface this as a real error, don't silently
        // fall back (that would mask a genuine backend problem).
        silentRecord("credentials", "failed", "supabase-bridge-error", email.trim());
        setSubmitting(false);
        const msg = t("login.err.server.body", "We could not reach the login service. Please try again in a moment.");
        setFormError(msg);
        toast.error(t("login.err.server.title", "Sign-in temporarily unavailable"), { description: msg });
        return true;
      }
      debugLog.log("login_auth_success", { role: json.role, next: json.next, provider: "supabase" });
      silentRecord("credentials", "success", "supabase-password", email.trim());
      redirectToTarget(json.next || "/");
      return true;
    } catch (err) {
      console.warn("[Login] supabase session bridge unreachable", err);
      silentRecord("credentials", "failed", "supabase-bridge-network", email.trim());
      setSubmitting(false);
      const netMsg = t("login.err.network.body", "Connection issue. Check your network and try again.");
      setFormError(netMsg);
      toast.error(t("login.err.network.title", "Connection issue"), { description: netMsg });
      return true;
    }
  }

  /* ---- submit ---- */
  function silentRecord(
    provider:
      | "manus"
      | "google"
      | "microsoft"
      | "apple"
      | "magic-link"
      | "credentials",
    outcome: "success" | "failed" | "blocked" | "mfa_required" | "redirect",
    reason: string | null = null,
    identifier: string | null = null,
  ) {
    recordAttempt.mutate(
      { provider, outcome, reason, identifier },
      {
        onError: (error) => {
          console.warn("[auth.recordAttempt] backend unreachable:", error);
        },
      },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    /* honeypot trap */
    if (honeypot.trim().length > 0) {
      silentRecord("credentials", "blocked", "honeypot", null);
      toast.error(t("login.bot.title", "Sign-in blocked"), {
        description: t(
          "login.bot.body",
          "Automated activity detected. If you are human, refresh and try again.",
        ),
      });
      return;
    }

    /* time gate */
    if (Date.now() - formMountedAt.current < 1500) {
      silentRecord("credentials", "blocked", "time-gate", null);
      toast.error(t("login.bot.title", "Sign-in blocked"), {
        description: t(
          "login.bot.body",
          "Automated activity detected. If you are human, refresh and try again.",
        ),
      });
      return;
    }

    /* rate-limit */
    if (lastSubmitAt && Date.now() - lastSubmitAt < 6000) {
      toast.error(t("login.rate.title", "Please wait a moment"), {
        description: t(
          "login.rate.body",
          "Too many sign-in attempts. Try again in a few seconds.",
        ),
      });
      return;
    }

    if (!validate()) {
      silentRecord("credentials", "failed", "invalid-fields", email.trim() || null);
      const msg = t(
        "login.err.fields.body",
        "Please complete all required fields and try again.",
      );
      setFormError(msg);
      toast.error(t("login.err.fields.title", "Check your credentials"), {
        description: msg,
      });
      return;
    }

    // Clear any prior banner once validation passes.
    setFormError(null);

    setSubmitting(true);
    setLastSubmitAt(Date.now());
    debugLog.log("login_submit_start", { email: email.trim() });

    /* persist remember + log attempt */
    try {
      if (remember) localStorage.setItem("iosky.login.remember", email.trim());
      else localStorage.removeItem("iosky.login.remember");

      const key = "iosky.login.attempts";
      const queue = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      queue.push({
        type: "credentials",
        email: email.trim(),
        ts: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(queue.slice(-25)));
    } catch {
      /* ignore storage errors */
    }

    /*
     * RM-50 (Path A): Supabase Auth is tried first - it's the source of
     * truth for any account that has been migrated / newly created there.
     * Nothing server-side has been migrated yet (no data migration was
     * performed - see RM-47), so today this will fall through to the
     * legacy path below for every existing account; it activates
     * automatically as accounts get linked via the bridge endpoint on
     * their first successful Supabase sign-in.
     */
    if (await trySupabaseLogin()) return;

    /*
     * Legacy path: native local-password login (Manus-independent, not
     * OAuth). Kept fully intact per the migration's explicit rule not to
     * remove working auth before its replacement is verified end-to-end.
     */
    try {
      const res = await fetch("/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; role?: string; next?: string };
        debugLog.log("login_auth_success", { role: json.role, next: json.next });
        silentRecord("credentials", "success", "local-password", email.trim());
        redirectToTarget(json.next || "/");
        return;
      }

      // Parse the stable error code from the server, with a defensive fallback.
      let code: string | undefined;
      try {
        const json = (await res.json()) as { code?: string };
        code = json?.code;
      } catch {
        /* non-JSON body */
      }

      if (res.status === 400 || code === "missing_fields") {
        silentRecord("credentials", "failed", "missing-fields", email.trim());
        setSubmitting(false);
        const msg = t(
          "login.err.fields.body",
          "Please complete all required fields and try again.",
        );
        setFormError(msg);
        toast.error(t("login.err.fields.title", "Check your credentials"), {
          description: msg,
        });
        return;
      }

      if (res.status === 401) {
        // Generic, non-enumerating message regardless of which factor failed.
        silentRecord("credentials", "failed", "invalid-credentials", email.trim());
        setSubmitting(false);
        const msg = t(
          "login.err.failed.body",
          "Login failed. Please check your email and password and try again.",
        );
        setFormError(msg);
        toast.error(t("login.err.failed.title", "Login failed"), {
          description: msg,
        });
        return;
      }

      // 5xx and any other unexpected status — stay on the page, do NOT
      // silently redirect to the OAuth portal. The user should see what
      // happened and can retry.
      silentRecord("credentials", "failed", `http-${res.status}`, email.trim());
      setSubmitting(false);
      const serverMsg = t(
        "login.err.server.body",
        "We could not reach the login service. Please try again in a moment.",
      );
      setFormError(serverMsg);
      toast.error(t("login.err.server.title", "Sign-in temporarily unavailable"), {
        description: serverMsg,
      });
      return;
    } catch (err) {
      // Network-level failure (DNS, offline, CORS). Surface a calm message
      // and keep the user on the page — no auto-redirect to OAuth.
      console.warn("[Login] local-password endpoint unreachable", err);
      silentRecord("credentials", "failed", "network", email.trim());
      setSubmitting(false);
      const netMsg = t(
        "login.err.network.body",
        "Connection issue. Check your network and try again.",
      );
      setFormError(netMsg);
      toast.error(t("login.err.network.title", "Connection issue"), {
        description: netMsg,
      });
      return;
    }
  }

  /* ---- SSO action ---- */
  function startSSO(provider: "google" | "microsoft" | "apple") {
    setSsoOpen(false);

    // Audit the SSO attempt server-side regardless of which provider the user
    // selected. The Manus OAuth portal currently brokers all federated
    // identity (Google / Microsoft / Apple are surfaced inside it), so we
    // redirect through the same gateway and let it negotiate the upstream IdP.
    silentRecord(provider, "redirect", `${provider}-via-manus-oauth`, null);

    toast.message(
      t(`login.sso.${provider}.toast`, providerLabel(provider, "toast")),
      {
        description: t(
          `login.sso.${provider}.body`,
          "Redirecting through the IO SKY identity portal\u2026",
        ),
      },
    );

    /* Local mirror so devs can debug attempts even without the backend. */
    try {
      const key = "iosky.login.attempts";
      const queue = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      queue.push({ type: "sso", provider, ts: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(queue.slice(-25)));
    } catch {
      /* ignore */
    }

    // Dismiss portals before hard navigation to avoid React 18 removeChild crash
    toast.dismiss();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.location.href = getLoginUrl("/portal/client");
      });
    });
  }

  /**
   * RM-50: real password reset via Supabase Auth (previously this only
   * wrote to localStorage and showed a fake "sent" state - no email was
   * ever dispatched). Actual delivery depends on the Supabase project's
   * email/SMTP configuration, which is external infrastructure this
   * environment cannot verify - see MILESTONE1_SUPABASE_MIGRATION_REPORT.md.
   * The UI deliberately shows the same "sent" confirmation on both success
   * and failure (matches the login form's no-enumeration principle: never
   * reveal whether an email address has an account).
   */
  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!validEmail(forgotEmail)) {
      toast.error(t("login.forgot.err", "Enter a valid email"), {
        description: t(
          "login.forgot.err.body",
          "We will send the secure reset link to that mailbox.",
        ),
      });
      return;
    }
    try {
      const key = "iosky.login.resetAttempts";
      const queue = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      queue.push({ email: forgotEmail.trim(), ts: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(queue.slice(-25)));
    } catch {
      /* ignore */
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      } catch (err) {
        console.warn("[Login] resetPasswordForEmail failed", err);
      }
    }
    setForgotSent(true);
  }

  /* ---------------------------------------------------------------- */
  return (
    <div className="relative min-h-screen flex flex-col bg-[#0B1020] text-[#E6EAF0] overflow-hidden">
      {/* Atmospheric ambient backdrop */}
      <BackdropAura />

      {/* Minimal header strip — keeps the focus on authentication */}
      <header className="relative z-[2] container flex items-center justify-between pt-6 md:pt-8 pb-2">
        <Link href="/" className="flex items-center">
          <IOSkyLogo variant="primary" className="h-7 md:h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2.5">
          <Link
            href="/contact"
            className="hidden md:inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] px-3.5 py-2 text-[12.5px] text-[#E6EAF0]/75 hover:border-[rgba(255, 122, 0,0.35)] hover:text-[#E6EAF0] transition"
          >
            <Headphones size={14} strokeWidth={1.8} className="text-[#FF7A00]" />
            {t("login.header.help", "Need help?")}
          </Link>
        </div>
      </header>

      {/* ----- Main grid ----- */}
      <main className="relative z-[1] flex-1">
        <div className="container pt-6 md:pt-10 pb-12">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr_0.95fr] gap-8 xl:gap-10 items-start">
            {/* ────────────────────────────────────────────────── */}
            {/* LEFT — cinematic hero                              */}
            {/* ────────────────────────────────────────────────── */}
            <section className="relative">
              {/* Globe — exact mockup visual: curved earth corner anchored to the
                  bottom-left with bright golden-orange horizon glow and fiber network.
                  Sits BEHIND the headline + trust pillars, masked at the right edge so
                  it blends into the page background. */}
              <div
                aria-hidden
                className="pointer-events-none absolute hidden md:block"
                style={{
                  left: "-22%",
                  bottom: "-22%",
                  width: "135%",
                  height: "110%",
                  backgroundImage: `url(${GLOBE_IMG})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "contain",
                  backgroundPosition: "left bottom",
                  opacity: 0.78,
                  maskImage:
                    "radial-gradient(ellipse 80% 70% at 20% 95%, #000 35%, rgba(0,0,0,0.65) 60%, transparent 85%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 80% 70% at 20% 95%, #000 35%, rgba(0,0,0,0.65) 60%, transparent 85%)",
                  filter: "saturate(1.05) brightness(0.95)",
                }}
              />
              {/* Mobile: subtle decorative version below content */}
              <div
                aria-hidden
                className="pointer-events-none absolute md:hidden -left-8 -bottom-8 w-[120%] h-[60%] opacity-60"
                style={{
                  backgroundImage: `url(${GLOBE_IMG})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                  backgroundPosition: "left bottom",
                  maskImage:
                    "linear-gradient(to top, #000 30%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to top, #000 30%, transparent 100%)",
                }}
              />

              <div className="relative">
                <h1 className="font-display font-semibold text-[34px] md:text-[46px] xl:text-[52px] leading-[1.05] tracking-[-0.022em] text-[#E6EAF0]">
                  {t("login.hero.line1", "Secure access to your")}{" "}
                  <span className="text-[#FF7A00]">
                    {t("login.hero.accent", "operational intelligence")}
                  </span>{" "}
                  {t("login.hero.line2", "ecosystem.")}
                </h1>
                <p className="mt-6 max-w-[470px] text-[15px] leading-[1.7] text-[#E6EAF0]/70">
                  {t(
                    "login.hero.body",
                    "One secure gateway. Three powerful portals. Built for performance. Protected by design.",
                  )}
                </p>
              </div>

              {/* Enterprise-grade security strip */}
              <div className="relative mt-12 md:mt-16">
                <div className="flex items-center gap-3 mb-5">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#FF7A00] shadow-[0_0_12px_#FF7A00]" />
                  <h3 className="font-display font-semibold text-[15px] tracking-[-0.012em] text-[#E6EAF0]">
                    {t("login.security.title", "Enterprise-grade security. Always.")}
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  <TrustMini
                    icon={<ShieldCheck size={18} strokeWidth={1.8} className="text-[#FF7A00]" />}
                    title={t("login.trust.encryption.title", "End-to-end encryption")}
                    body={t(
                      "login.trust.encryption.body",
                      "Your data is always protected.",
                    )}
                  />
                  <TrustMini
                    icon={<KeyRound size={18} strokeWidth={1.8} className="text-[#FF7A00]" />}
                    title={t("login.trust.access.title", "Role-based access")}
                    body={t(
                      "login.trust.access.body",
                      "Only authorized users get in.",
                    )}
                  />
                  <TrustMini
                    icon={<Activity size={18} strokeWidth={1.8} className="text-[#FF7A00]" />}
                    title={t("login.trust.monitoring.title", "24/7 threat monitoring")}
                    body={t(
                      "login.trust.monitoring.body",
                      "Continuous protection of our systems.",
                    )}
                  />
                  <TrustMini
                    icon={<Award size={18} strokeWidth={1.8} className="text-[#FF7A00]" />}
                    title={t("login.trust.compliance.title", "Compliance ready")}
                    body={t(
                      "login.trust.compliance.body",
                      "GDPR-aligned by design.",
                    )}
                  />
                </div>
              </div>
            </section>

            {/* ────────────────────────────────────────────────── */}
            {/* CENTER — login card                                */}
            {/* ────────────────────────────────────────────────── */}
            <section className="relative">
              <div className="relative max-w-[460px] mx-auto">
                {/* Top accent line */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#FF7A00]/65 to-transparent"
                />
                <form
                  onSubmit={onSubmit}
                  className="glass relative p-7 md:p-9 rounded-2xl border border-white/[0.08]"
                  noValidate
                  autoComplete="on"
                >
                  {/* Honeypot — invisible to humans */}
                  <input
                    type="text"
                    name="company_website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    aria-hidden="true"
                    className="absolute opacity-0 pointer-events-none -left-[9999px] top-0"
                  />

                  {/* Lock-shield icon */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-[#FF7A00]/15 blur-2xl" />
                      <div className="relative w-14 h-14 rounded-2xl border border-[#FF7A00]/45 bg-[#FF7A00]/10 flex items-center justify-center">
                        <Lock size={22} strokeWidth={1.9} className="text-[#FF7A00]" />
                      </div>
                    </div>
                  </div>

                  <h2 className="mt-5 text-center font-display font-semibold text-[22px] md:text-[24px] leading-[1.2] tracking-[-0.012em] text-[#E6EAF0]">
                    {t("login.card.line1", "Secure access to your")}
                    <br />
                    <span className="text-[#FF7A00]">
                      {t("login.card.accent", "operational intelligence ecosystem")}
                    </span>
                    .
                  </h2>
                  <p className="mt-2.5 text-center text-[13px] text-[#E6EAF0]/65">
                    {t("login.card.sub", "Sign in to continue to your portal")}
                  </p>

                  {/* Inline form-level error banner. Visible above the
                      Email field, role=alert + aria-live so screen readers
                      announce it on submit failure. Auto-clears the moment
                      the user starts typing again (handled by the email
                      onChange below). */}
                  {formError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      data-testid="login-form-error"
                      className="mt-5 rounded-md border border-[rgba(255,80,80,0.45)] bg-[rgba(255,80,80,0.08)] px-3.5 py-3 text-[12.5px] leading-snug text-[#FFB4B4]"
                    >
                      {formError}
                    </div>
                  )}

                  {/* Email */}
                  <div className="mt-6">
                    <label
                      htmlFor="login-email"
                      className="block text-[12.5px] font-medium text-[#E6EAF0]/85 mb-1.5"
                    >
                      {t("login.field.email", "Email Address")}
                    </label>
                    <div
                      className={[
                        "flex items-center gap-2.5 rounded-md border bg-white/[0.025] px-3.5 py-3 transition",
                        errors.email
                          ? "border-[rgba(255,80,80,0.5)] focus-within:border-[rgba(255,80,80,0.75)]"
                          : "border-white/10 focus-within:border-[rgba(255, 122, 0,0.55)] focus-within:ring-2 focus-within:ring-[rgba(255, 122, 0,0.22)]",
                      ].join(" ")}
                    >
                      <Mail size={15} className="text-[#E6EAF0]/45" strokeWidth={1.8} />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                          if (formError) setFormError(null);
                        }}
                        placeholder={t("login.placeholder.email", "Enter your email address")}
                        className="flex-1 bg-transparent text-[14.5px] text-[#E6EAF0] placeholder:text-[#E6EAF0]/40 focus:outline-none"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-[11.5px] text-[#FF6A6A]/90">{errors.email}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="mt-4">
                    <label
                      htmlFor="login-password"
                      className="block text-[12.5px] font-medium text-[#E6EAF0]/85 mb-1.5"
                    >
                      {t("login.field.password", "Password")}
                    </label>
                    <div
                      className={[
                        "flex items-center gap-2.5 rounded-md border bg-white/[0.025] px-3.5 py-3 transition",
                        errors.password
                          ? "border-[rgba(255,80,80,0.5)] focus-within:border-[rgba(255,80,80,0.75)]"
                          : "border-white/10 focus-within:border-[rgba(255, 122, 0,0.55)] focus-within:ring-2 focus-within:ring-[rgba(255, 122, 0,0.22)]",
                      ].join(" ")}
                    >
                      <Lock size={15} className="text-[#E6EAF0]/45" strokeWidth={1.8} />
                      <input
                        id="login-password"
                        type={showPwd ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password)
                            setErrors((p) => ({ ...p, password: undefined }));
                          if (formError) setFormError(null);
                        }}
                        placeholder={t("login.placeholder.password", "Enter your password")}
                        className="flex-1 bg-transparent text-[14.5px] text-[#E6EAF0] placeholder:text-[#E6EAF0]/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((s) => !s)}
                        className="p-1 rounded-md text-[#E6EAF0]/55 hover:text-[#FF7A00] transition"
                        aria-label={
                          showPwd
                            ? t("login.password.hide", "Hide password")
                            : t("login.password.show", "Show password")
                        }
                      >
                        {showPwd ? (
                          <EyeOff size={15} strokeWidth={1.8} />
                        ) : (
                          <Eye size={15} strokeWidth={1.8} />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 text-[11.5px] text-[#FF6A6A]/90">{errors.password}</p>
                    )}
                  </div>

                  {/* Remember + Forgot */}
                  <div className="mt-4 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-[12.5px] text-[#E6EAF0]/75 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border border-white/15 bg-white/[0.04] accent-[#FF7A00] cursor-pointer"
                      />
                      {t("login.remember", "Remember me")}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotSent(false);
                        setForgotOpen(true);
                      }}
                      className="text-[12.5px] text-[#FF7A00] hover:text-[#FFB347] transition"
                    >
                      {t("login.forgot", "Forgot password?")}
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting || formInvalid}
                    className="btn-primary mt-5 w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed gap-2.5"
                  >
                    {submitting ? (
                      <>
                        <LogoLoader size={20} />
                        <span>{t("login.submitting", "Signing in\u2026")}</span>
                      </>
                    ) : (
                      <>
                        <span>{t("login.submit", "Sign In")}</span>
                        <ArrowRight size={16} strokeWidth={2.2} />
                      </>
                    )}
                  </button>

                  {/* Divider */}
                  <div className="mt-6 mb-5 flex items-center gap-3 text-[11.5px] text-[#E6EAF0]/45">
                    <span className="flex-1 h-px bg-white/10" />
                    <span className="font-mono uppercase tracking-[0.18em]">
                      {t("login.or", "or continue with")}
                    </span>
                    <span className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* SSO */}
                  <div className="relative" ref={ssoMenuRef}>
                    <button
                      type="button"
                      onClick={() => setSsoOpen((s) => !s)}
                      className="btn-secondary w-full justify-center"
                    >
                      <ShieldCheck size={15} strokeWidth={1.9} className="text-[#FF7A00]" />
                      {t("login.sso", "Sign in with SSO")}
                      <ChevronDown
                        size={14}
                        strokeWidth={2}
                        className={`transition-transform ${ssoOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {ssoOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-md border border-white/10 bg-[#0F1521]/95 backdrop-blur-md shadow-[0_24px_48px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
                        style={{
                          transform: "scale(0.98)",
                          animation: "iosky-menu-in 180ms cubic-bezier(0.23,1,0.32,1) forwards",
                          transformOrigin: "top center",
                        }}
                      >
                        <SsoOption
                          provider="google"
                          label={t("login.sso.google", "Continue with Google")}
                          onSelect={() => startSSO("google")}
                        />
                        <SsoOption
                          provider="microsoft"
                          label={t("login.sso.microsoft", "Continue with Microsoft")}
                          onSelect={() => startSSO("microsoft")}
                        />
                        <SsoOption
                          provider="apple"
                          label={t("login.sso.apple", "Continue with Apple")}
                          onSelect={() => startSSO("apple")}
                        />
                      </div>
                    )}
                  </div>

                  {/* Footer links inside card */}
                  <div className="mt-7 pt-5 border-t border-white/[0.07] grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11.5px] text-[#E6EAF0]/55">
                        {t("login.no-access", "Don\u2019t have access yet?")}
                      </p>
                      <Link
                        href="/contact"
                        className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#FF7A00] hover:text-[#FFB347] transition"
                      >
                        {t("login.request-access", "Request Access")}
                        <ArrowRight size={12} strokeWidth={2.2} />
                      </Link>
                    </div>
                    <div className="text-right">
                      <p className="text-[11.5px] text-[#E6EAF0]/55">
                        {t("login.contribute", "Looking to contribute?")}
                      </p>
                      <Link
                        href="/engineering-access"
                        className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#FF7A00] hover:text-[#FFB347] transition"
                      >
                        {t("login.developer-access", "Developer Access")}
                        <ArrowRight size={12} strokeWidth={2.2} />
                      </Link>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            {/* ────────────────────────────────────────────────── */}
            {/* RIGHT — unified workspace promise (no portal cards)*/}
            {/* ────────────────────────────────────────────────── */}
            <section className="relative">
              <div className="mb-1.5 inline-flex items-center gap-3">
                <h3 className="font-display font-semibold text-[18px] tracking-[-0.012em] text-[#E6EAF0]">
                  {t("login.unified.title", "One workspace. One sign-in.")}
                </h3>
              </div>
              <span className="block h-[3px] w-10 rounded-full bg-[#FF7A00] mb-3" />
              <p className="text-[13px] text-[#E6EAF0]/65 max-w-[360px]">
                {t(
                  "login.unified.sub",
                  "After authentication, IO SKY routes you straight to your private operational intelligence environment. No portal pickers, no exposed admin or developer surfaces.",
                )}
              </p>

              <ul className="mt-5 space-y-3.5">
                {[
                  {
                    icon: <ShieldCheck size={18} strokeWidth={1.8} className="text-[#FF7A00]" />,
                    title: t("login.unified.f1.title", "Tenant-isolated by design"),
                    body: t(
                      "login.unified.f1.body",
                      "Every query is scoped to your organization. Records from other clients are never visible.",
                    ),
                  },
                  {
                    icon: <Lock size={18} strokeWidth={1.8} className="text-[#FF7A00]" />,
                    title: t("login.unified.f2.title", "Encrypted sessions, signed URLs"),
                    body: t(
                      "login.unified.f2.body",
                      "Cookies, file downloads and exports use short-lived signed URLs and end-to-end encryption.",
                    ),
                  },
                  {
                    icon: <ShieldAlert size={18} strokeWidth={1.8} className="text-[#FF7A00]" />,
                    title: t("login.unified.f3.title", "Audit-logged from second one"),
                    body: t(
                      "login.unified.f3.body",
                      "Logins, downloads, profile changes, MFA events and payment actions are recorded for review.",
                    ),
                  },
                ].map((item) => (
                  <li
                    key={item.title}
                    className="glass-soft border border-white/[0.07] rounded-xl p-4 flex items-start gap-3.5"
                  >
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#E6EAF0]">{item.title}</p>
                      <p className="text-[11.5px] text-[#E6EAF0]/60 mt-0.5 leading-relaxed">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Need-help tile */}
              <div className="mt-5 glass-soft border border-white/[0.07] rounded-xl p-4 flex items-start gap-3.5">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center">
                  <Headphones size={16} strokeWidth={1.8} className="text-[#FF7A00]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-[#E6EAF0]">
                    {t("login.help.title", "Need help accessing your account?")}
                  </p>
                  <p className="text-[11.5px] text-[#E6EAF0]/60 mt-0.5">
                    {t("login.help.body", "Our support team is available 24/7.")}
                  </p>
                </div>
                <Link
                  href="/contact"
                  className="self-center text-[12.5px] font-semibold text-[#FF7A00] hover:text-[#FFB347] transition whitespace-nowrap"
                >
                  {t("login.help.cta", "Contact Support")}
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* ────────────────────────────────────────────────────── */}
        {/* BOTTOM — full-width metrics strip                      */}
        {/* ────────────────────────────────────────────────────── */}
        <div className="relative z-[1] container mb-12">
          <div className="glass-strong rounded-2xl p-5 md:p-7 border border-white/[0.08]">
            <div className="grid lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr] gap-5 lg:gap-7 items-center">
              <MetricTile
                value={t("login.metric.uptime.value", "High-availability")}
                label={t("login.metric.uptime", "Architecture")}
                icon={<ShieldCheck size={20} strokeWidth={1.8} className="text-[#FF7A00]" />}
              />
              <MetricTile
                value="256-bit"
                label={t("login.metric.encryption", "Encryption")}
                icon={<Lock size={20} strokeWidth={1.8} className="text-[#FF7A00]" />}
              />
              <MetricTile
                value="24/7"
                label={t("login.metric.monitoring", "Monitoring")}
                icon={<Activity size={20} strokeWidth={1.8} className="text-[#FF7A00]" />}
              />
              <MetricTile
                value="100%"
                label={t("login.metric.data", "Data Protection")}
                icon={<Database size={20} strokeWidth={1.8} className="text-[#FF7A00]" />}
              />
              <div className="flex items-center gap-4 lg:justify-end">
                <div>
                  <p className="font-display font-semibold text-[14.5px] text-[#E6EAF0] tracking-[-0.01em]">
                    {t("login.trustpitch.title", "Built for trust. Designed for impact.")}
                  </p>
                  <p className="text-[11.5px] text-[#E6EAF0]/60 leading-[1.55] mt-1 max-w-[280px]">
                    {t(
                      "login.trustpitch.body",
                      "At IO SKY, we combine enterprise-grade security with operational excellence, so you can focus on growth with complete confidence.",
                    )}
                  </p>
                </div>
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[#FF7A00]/22 blur-2xl" />
                  <div className="relative w-14 h-14 rounded-full border border-[#FF7A00]/40 bg-gradient-to-b from-[#FF7A00]/15 to-transparent flex items-center justify-center">
                    <ShieldCheck size={22} strokeWidth={1.9} className="text-[#FF7A00]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal footer strip */}
      <footer className="relative z-[1] container pb-8">
        <div className="border-t border-white/[0.06] pt-6 flex flex-wrap items-center justify-between gap-4 text-[11.5px] text-[#E6EAF0]/55">
          <div className="flex items-center gap-2">
            <IOSkyLogo variant="primary" className="h-5 w-auto opacity-80" />
            <span className="hidden md:inline">
              © {new Date().getFullYear()} IO SKY {t("login.rights", "All rights reserved.")}
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="hover:text-[#FF7A00] transition">
              {t("footer.privacy", "Privacy Policy")}
            </Link>
            <Link href="/terms" className="hover:text-[#FF7A00] transition">
              {t("footer.terms", "Terms & Conditions")}
            </Link>
            <Link href="/cookies" className="hover:text-[#FF7A00] transition">
              {t("footer.cookies", "Cookie Policy")}
            </Link>
            <Link href="/security" className="hover:text-[#FF7A00] transition">
              {t("footer.security", "Security")}
            </Link>
            <Link href="/legal/compliance" className="hover:text-[#FF7A00] transition">
              {t("footer.compliance", "Compliance")}
            </Link>
          </nav>
        </div>
      </footer>

      {/* ----- Forgot Password modal ----- */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04060C]/72 backdrop-blur-sm"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="relative w-full max-w-md glass-strong rounded-2xl p-7"
            onClick={(e) => e.stopPropagation()}
            style={{
              animation:
                "iosky-modal-in 240ms cubic-bezier(0.23,1,0.32,1) forwards",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF7A00]/12 border border-[#FF7A00]/35 flex items-center justify-center">
                <KeyRound size={17} strokeWidth={1.8} className="text-[#FF7A00]" />
              </div>
              <div>
                <h4 className="font-display font-semibold text-[17px] text-[#E6EAF0]">
                  {forgotSent
                    ? t("login.forgot.sent.title", "Reset link sent")
                    : t("login.forgot.title", "Reset your password")}
                </h4>
                <p className="text-[12px] text-[#E6EAF0]/60">
                  {forgotSent
                    ? t(
                        "login.forgot.sent.sub",
                        "Check your inbox for the secure reset link.",
                      )
                    : t(
                        "login.forgot.sub",
                        "We will send a secure reset link to your work email.",
                      )}
                </p>
              </div>
            </div>

            {!forgotSent ? (
              <form onSubmit={submitForgot} className="space-y-3">
                <div className="flex items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.025] px-3.5 py-3 focus-within:border-[rgba(255, 122, 0,0.55)] focus-within:ring-2 focus-within:ring-[rgba(255, 122, 0,0.22)] transition">
                  <Mail size={15} className="text-[#E6EAF0]/45" strokeWidth={1.8} />
                  <input
                    type="email"
                    autoComplete="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={t("login.placeholder.email", "Enter your email address")}
                    className="flex-1 bg-transparent text-[14.5px] text-[#E6EAF0] placeholder:text-[#E6EAF0]/40 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="btn-secondary"
                  >
                    {t("login.cancel", "Cancel")}
                  </button>
                  <button type="submit" className="btn-primary">
                    {t("login.forgot.send", "Send reset link")}
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-[#FF7A00]/22 bg-[#FF7A00]/06 p-3.5 text-[12.5px] text-[#E6EAF0]/80 leading-[1.55]">
                  {t(
                    "login.forgot.sent.body",
                    "The reset link expires automatically after 30 minutes. The attempt has been written to the security audit log.",
                  )}
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="btn-primary"
                  >
                    {t("login.done", "Done")}
                    <ArrowRight size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* keyframes are defined in index.css to avoid React 18 removeChild crash */}
    </div>
  );
}

/* ================================================================== */
/* Sub-components                                                       */
/* ================================================================== */

function BackdropAura() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(800px 480px at 8% 18%, rgba(255, 122, 0,0.10), transparent 60%), radial-gradient(700px 480px at 92% 78%, rgba(255, 122, 0,0.06), transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at center, black 35%, transparent 75%)",
        }}
      />
    </>
  );
}

function TrustMini({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-soft border border-white/[0.07] rounded-xl p-3.5 lift-on-hover">
      <div className="w-8 h-8 rounded-lg bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center mb-2.5">
        {icon}
      </div>
      <p className="font-display font-semibold text-[12.5px] text-[#E6EAF0] leading-[1.3]">
        {title}
      </p>
      <p className="text-[11px] text-[#E6EAF0]/60 mt-1 leading-[1.5]">{body}</p>
    </div>
  );
}

function PortalCard({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group block glass feature-card rounded-xl p-4 border border-white/[0.08]"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center icon-chip">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-[14.5px] text-[#E6EAF0] tracking-[-0.005em]">
            {title}
          </p>
          <p className="text-[12px] text-[#E6EAF0]/65 mt-1 leading-[1.55]">
            {body}
          </p>
        </div>
        <ArrowRight
          size={16}
          strokeWidth={2.2}
          className="self-center text-[#E6EAF0]/45 group-hover:text-[#FF7A00] arrow-grow transition-colors"
        />
      </div>
    </Link>
  );
}

function SsoOption({
  provider,
  label,
  onSelect,
}: {
  provider: "google" | "microsoft" | "apple";
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#E6EAF0]/85 hover:bg-[#FF7A00]/08 hover:text-[#E6EAF0] transition"
    >
      <SsoIcon provider={provider} />
      <span className="flex-1">{label}</span>
      <ArrowRight size={13} strokeWidth={2.2} className="text-[#E6EAF0]/40" />
    </button>
  );
}

function SsoIcon({ provider }: { provider: "google" | "microsoft" | "apple" }) {
  if (provider === "google") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.4c-.22 1.28-1.62 3.78-5.4 3.78a6.13 6.13 0 0 1 0-12.26c1.95 0 3.26.83 4 1.55l2.74-2.64A9.9 9.9 0 0 0 12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.78 0 9.6-4.05 9.6-9.77 0-.66-.06-1.16-.17-1.66H12Z"
        />
      </svg>
    );
  }
  if (provider === "microsoft") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x="2" y="2" width="9" height="9" fill="#F35325" />
        <rect x="13" y="2" width="9" height="9" fill="#81BC06" />
        <rect x="2" y="13" width="9" height="9" fill="#05A6F0" />
        <rect x="13" y="13" width="9" height="9" fill="#FFBA08" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#E6EAF0"
        d="M16.37 1.43c.04 1.18-.41 2.34-1.17 3.18-.78.86-2.04 1.52-3.13 1.43-.07-1.14.46-2.32 1.2-3.13.83-.91 2.21-1.59 3.1-1.48ZM20.3 17.42c-.55 1.27-.81 1.83-1.52 2.95-.99 1.57-2.39 3.52-4.13 3.53-1.55.02-1.95-1-4.07-1-2.12 0-2.56 1-4.11.99-1.74-.02-3.07-1.78-4.07-3.34-2.79-4.34-3.08-9.44-1.36-12.15 1.22-1.93 3.14-3.05 4.95-3.05 1.84 0 3 1.01 4.52 1.01 1.47 0 2.36-1.01 4.49-1.01 1.62 0 3.33.88 4.55 2.4-3.99 2.19-3.34 7.9.75 9.67Z"
      />
    </svg>
  );
}

function MetricTile({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-display font-semibold text-[20px] tracking-[-0.018em] text-[#FF7A00] leading-[1.05]">
          {value}
        </p>
        <p className="text-[11.5px] text-[#E6EAF0]/65 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* Local provider label helper for clean fallbacks */
function providerLabel(provider: string, _kind: "toast") {
  switch (provider) {
    case "google":
      return "Continue with Google";
    case "microsoft":
      return "Continue with Microsoft";
    case "apple":
      return "Continue with Apple";
    default:
      return "SSO sign-in";
  }
}
