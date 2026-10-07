/**
 * IO SKY — Account activation (SRS 8.7).
 *
 * Reached from the link in the invitation email. The link proves control of the
 * address; here the invitee sets a password, accepts the live agreements, and is
 * signed in and routed to their portal. Privileged roles go on to enrol a second
 * factor, which the portal enforces.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPasswordStrength, MIN_PASSWORD_LENGTH } from "@shared/srsRules";

export default function Activate() {
  const [, navigate] = useLocation();
  const token = typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("token") ?? "");
  const details = trpc.accounts.activationDetails.useQuery({ token }, { enabled: token.length >= 20, retry: false });
  const activate = trpc.accounts.activate.useMutation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-[#0D2D2E] text-[#E6EAF0] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">{children}</div>
    </div>
  );

  if (token.length < 20 || details.error) {
    return shell(
      <>
        <h1 className="text-xl font-semibold mb-2">This link cannot be used</h1>
        <p className="text-sm text-white/65">{details.error?.message ?? "The activation link is missing or incomplete."} If you were invited, ask your IO SKY contact to send a new invitation.</p>
      </>,
    );
  }
  if (details.isLoading || !details.data) return shell(<p className="text-sm text-white/60">Checking your invitation…</p>);

  const d = details.data;
  const minLen = d.passwordMinLength ?? MIN_PASSWORD_LENGTH;
  const strength = password ? checkPasswordStrength(password, d.email, minLen) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("The two passwords do not match.");
    const s = checkPasswordStrength(password, d.email, minLen);
    if (!s.ok) return setError(s.reason);
    if (!accepted) return setError("Please accept the agreements to continue.");
    try {
      const res = await activate.mutateAsync({ token, name: name.trim(), password, acceptedAgreements: true });
      navigate(res.mfaRequired ? "/admin/my-security" : res.next);
      // A full navigation so the new session cookie is picked up by every query.
      window.location.href = res.mfaRequired ? "/admin/my-security" : res.next;
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return shell(
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-semibold">Activate your account</h1>
        <p className="mt-1 text-sm text-white/60">
          {d.email}, invited as {d.role.replace(/_/g, " ")}.
        </p>
      </div>
      <div>
        <label htmlFor="act-name" className="text-xs text-white/60 block mb-1">Your name</label>
        <Input id="act-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
      </div>
      <div>
        <label htmlFor="act-pw" className="text-xs text-white/60 block mb-1">Password</label>
        <Input id="act-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required aria-describedby="act-pw-hint" />
        <p id="act-pw-hint" className={`mt-1 text-xs ${strength && !strength.ok ? "text-amber-300" : "text-white/45"}`}>
          {strength && !strength.ok ? strength.reason : `At least ${minLen} characters, with letters and numbers.`}
        </p>
      </div>
      <div>
        <label htmlFor="act-pw2" className="text-xs text-white/60 block mb-1">Confirm password</label>
        <Input id="act-pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </div>
      {d.agreements.length > 0 ? (
        <label className="flex items-start gap-2 text-sm text-white/80">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[#F58A1F]" />
          <span>
            I have read and accept the{" "}
            {d.agreements.map((a, i) => (
              <span key={a.kind}>
                {i > 0 ? " and " : ""}
                <a href={a.href} target="_blank" rel="noreferrer" className="underline text-[#F58A1F]">{a.title}</a>
              </span>
            ))}
            .
          </span>
        </label>
      ) : (
        <label className="flex items-start gap-2 text-sm text-white/80">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[#F58A1F]" />
          <span>I accept the IO SKY terms of service and privacy policy.</span>
        </label>
      )}
      {d.mfaRequired ? <p className="text-xs text-white/55">Your role requires a second factor. After activation you will be taken to set it up before you can use the admin area.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <Button type="submit" disabled={activate.isPending} className="w-full">
        {activate.isPending ? "Activating…" : "Activate account"}
      </Button>
    </form>,
  );
}
