/**
 * IO SKY — MFA post-login challenge page.
 *
 * Rendered at `/mfa-challenge?next=<path>`. After the OAuth callback the
 * server keeps the user in the "MFA pending" state via a short-lived cookie.
 * This page polls `/api/mfa/challenge/status` to discover which verified
 * factors are available, lets the user pick one, accepts a 6+ digit code or
 * a recovery code, posts to `/api/mfa/challenge`, and on success follows the
 * server's `next` destination.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Factor = {
  id: number;
  kind: "totp" | "sms";
  label: string | null;
  phoneHint: string | null;
  primary: boolean;
};

type Status =
  | { state: "loading" }
  | { state: "expired" }
  | { state: "ready"; next: string; factors: Factor[] };

function getNextParam(): string {
  if (typeof window === "undefined") return "/";
  const u = new URL(window.location.href);
  const n = u.searchParams.get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function MfaChallenge() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [factorId, setFactorId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [mode, setMode] = useState<"code" | "recovery">("code");
  const [submitting, setSubmitting] = useState(false);

  const fallbackNext = useMemo(() => getNextParam(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/mfa/challenge/status", {
          credentials: "include",
        });
        if (resp.status === 401) {
          if (!cancelled) setStatus({ state: "expired" });
          return;
        }
        if (!resp.ok) {
          throw new Error("status_failed");
        }
        const body = (await resp.json()) as {
          active: boolean;
          next: string;
          factors: Factor[];
        };
        if (cancelled) return;
        if (!body.active || body.factors.length === 0) {
          setStatus({ state: "expired" });
          return;
        }
        setStatus({ state: "ready", next: body.next, factors: body.factors });
        const primary = body.factors.find(f => f.primary) ?? body.factors[0];
        if (primary) setFactorId(primary.id);
      } catch {
        if (!cancelled) setStatus({ state: "expired" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload =
        mode === "code"
          ? { factorId, code: code.trim() }
          : { recoveryCode: recoveryCode.trim() };
      const resp = await fetch("/api/mfa/challenge", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.status === 200) {
        const body = (await resp.json()) as { ok: boolean; next: string };
        toast.success("Verified. Redirecting…");
        setLocation(body.next ?? fallbackNext);
        return;
      }
      if (resp.status === 401) {
        toast.error("The code did not match or has expired.");
      } else if (resp.status === 429) {
        toast.error(
          "Too many attempts. The factor is locked for a few minutes.",
        );
      } else {
        toast.error("We could not verify the code. Please try again.");
      }
    } catch {
      toast.error("Connection issue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status.state === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Preparing security check…</p>
      </div>
    );
  }

  if (status.state === "expired") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Sign-in session expired</h1>
          <p className="text-sm text-muted-foreground">
            For your security the verification window has closed. Please sign
            in again.
          </p>
          <Button onClick={() => setLocation("/login")}>Back to sign-in</Button>
        </div>
      </div>
    );
  }

  const factor = status.factors.find(f => f.id === factorId) ?? null;

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
      <div className="max-w-md w-full space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Two-step verification</h1>
          <p className="text-sm text-muted-foreground">
            One last check before we let you in.
          </p>
        </header>

        {mode === "code" && (
          <div className="space-y-4">
            {status.factors.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Choose a method
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {status.factors.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFactorId(f.id)}
                      className={`text-left rounded-md border px-3 py-2 text-sm transition ${
                        f.id === factorId
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-border bg-card/40 hover:bg-card/70"
                      }`}
                    >
                      <div className="font-medium">
                        {f.kind === "totp"
                          ? "Authenticator app"
                          : `SMS to ${f.phoneHint ?? "your phone"}`}
                      </div>
                      {f.label && (
                        <div className="text-xs text-muted-foreground">
                          {f.label}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                {factor?.kind === "sms" ? "SMS code" : "Authenticator code"}
              </label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
                inputMode="numeric"
                autoFocus
                maxLength={10}
              />
            </div>

            <Button
              className="w-full"
              onClick={submit}
              disabled={!factorId || code.trim().length < 4 || submitting}
            >
              {submitting ? "Verifying…" : "Verify"}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              onClick={() => setMode("recovery")}
            >
              Use a recovery code instead
            </button>
          </div>
        )}

        {mode === "recovery" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                Recovery code
              </label>
              <Input
                value={recoveryCode}
                onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXXXX"
                autoFocus
                maxLength={20}
                className="tracking-widest"
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={recoveryCode.trim().length < 8 || submitting}
            >
              {submitting ? "Verifying…" : "Verify with recovery code"}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
              onClick={() => setMode("code")}
            >
              Back to standard verification
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
