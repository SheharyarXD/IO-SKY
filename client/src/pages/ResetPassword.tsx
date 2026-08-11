/**
 * IO SKY — Password reset completion page (RM-50).
 *
 * Rendered at `/reset-password` after the user follows the link from a
 * Supabase Auth password-reset email (sent via Login.tsx's "Forgot
 * password" flow, `supabase.auth.resetPasswordForEmail`). Supabase's
 * client SDK automatically exchanges the URL's recovery token for a
 * short-lived session on load (`onAuthStateChange` fires a `PASSWORD_RECOVERY`
 * event) — this page just needs to collect a new password and call
 * `supabase.auth.updateUser({ password })`.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("invalid");
      return;
    }
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setStatus("ready");
    });

    // If the recovery session was already established before this
    // listener attached (e.g. fast page load), fall back to checking for
    // an existing session directly.
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session && status === "checking") setStatus("ready");
    });

    const timeout = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("Password reset is not available right now.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message || "Could not update your password. The link may have expired.");
      return;
    }
    setStatus("done");
    toast.success("Password updated", { description: "You can now sign in with your new password." });
    setTimeout(() => setLocation("/login"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1020] text-[#E6EAF0] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h1 className="text-xl font-semibold mb-2">Reset your password</h1>

        {status === "checking" && (
          <p className="text-sm text-white/60">Verifying your reset link…</p>
        )}

        {status === "invalid" && (
          <p className="text-sm text-white/60">
            This reset link is invalid or has expired. Request a new one from the{" "}
            <button className="text-[#FF6A00] underline" onClick={() => setLocation("/login")}>
              sign-in page
            </button>
            .
          </p>
        )}

        {status === "done" && (
          <p className="text-sm text-white/60">Password updated. Redirecting to sign in…</p>
        )}

        {status === "ready" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/60 block mb-1">New password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1">Confirm password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
