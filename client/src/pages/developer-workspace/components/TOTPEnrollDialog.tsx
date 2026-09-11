/*
 * TOTP enrollment dialog.
 *
 * Workflow:
 *   1. Open dialog → call `mfa.enrollTotpBegin` → render QR from otpauth URI
 *      + display the base32 secret as a manual-entry fallback.
 *   2. User scans / types the secret into their authenticator app.
 *   3. User enters the 6-digit code → call `mfa.enrollTotpVerify`.
 *   4. On success show 10 recovery codes the user must save (only chance).
 *   5. On close after success, parent invalidates the factor list.
 *
 * The dialog is intentionally a thin wrapper — all crypto + audit happens
 * on the server. We never see the plaintext secret again after step 2.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";

type Phase = "loading" | "verify" | "success";

export function TOTPEnrollDialog(props: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onEnrolled?: () => void;
}) {
  const { open, onOpenChange, onEnrolled } = props;
  const utils = trpc.useUtils();

  const [phase, setPhase] = useState<Phase>("loading");
  const [factorId, setFactorId] = useState<number | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [otpauthUri, setOtpauthUri] = useState<string>("");
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const qrCanvas = useRef<HTMLCanvasElement | null>(null);

  const begin = trpc.mfa.enrollTotpBegin.useMutation({
    onSuccess: (out) => {
      setFactorId(out.factorId);
      // Extract the base32 secret out of the otpauth URI for manual entry.
      try {
        const params = new URL(out.otpauthUri).searchParams;
        const s = params.get("secret") ?? "";
        setSecret(s);
      } catch {
        setSecret("");
      }
      setOtpauthUri(out.otpauthUri);
      setQrFailed(false);
      setPhase("verify");
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not start TOTP enrolment");
      onOpenChange(false);
    },
  });

  const verify = trpc.mfa.enrollTotpVerify.useMutation({
    onSuccess: async (out) => {
      setRecoveryCodes(out.recoveryCodes);
      setPhase("success");
      await utils.mfa.listFactors.invalidate();
      onEnrolled?.();
    },
    onError: (err) => {
      toast.error(err.message ?? "Code did not match");
    },
  });

  // Kick off enrollment whenever the dialog opens fresh.
  useEffect(() => {
    if (!open) {
      // Reset state when the dialog closes so re-opening starts clean.
      setPhase("loading");
      setFactorId(null);
      setSecret("");
      setOtpauthUri("");
      setQrFailed(false);
      setCode("");
      setRecoveryCodes([]);
      return;
    }
    begin.mutate({ label: "Authenticator app" });
    // We intentionally fire-and-forget when the dialog opens; the mutation
    // handles its own error path. Adding `begin` to deps would re-trigger
    // every render because the mutation object is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Paint the QR once the canvas is actually in the DOM.
   *
   * This deliberately does NOT live in the mutation's onSuccess handler.
   * React batches the `setPhase("verify")` above, so the canvas — which is
   * only mounted in the "verify" branch — is still unmounted on the next
   * synchronous line, and `qrCanvas.current` is null. The old code guarded
   * on that ref and silently skipped the render, so the dialog showed an
   * empty bordered box and enrolment could only be completed by someone who
   * noticed the manual-entry secret underneath it. Running as an effect
   * keyed on the URI means the canvas is guaranteed mounted before we draw.
   */
  useEffect(() => {
    if (phase !== "verify" || !otpauthUri) return;
    const canvas = qrCanvas.current;
    if (!canvas) {
      setQrFailed(true);
      return;
    }
    let cancelled = false;
    QRCode.toCanvas(canvas, otpauthUri, {
      width: 220,
      margin: 1,
      color: { dark: "#FFFFFFFF", light: "#0B0F1AFF" },
    })
      .then(() => {
        if (!cancelled) setQrFailed(false);
      })
      .catch((e: unknown) => {
        // A failed QR must not become a dead end: surface it so the manual
        // secret is presented as the way forward rather than as a footnote.
        console.warn("QR render failed", e);
        if (!cancelled) setQrFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [phase, otpauthUri]);

  const onSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verify.isPending) return;
    verify.mutate({ factorId, token: code });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add authenticator app</DialogTitle>
          <DialogDescription>
            Scan the QR with Google Authenticator, 1Password, Authy, or any
            TOTP-compatible app, then enter the 6-digit code it generates.
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" && (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        )}

        {phase === "verify" && (
          <form onSubmit={onSubmitCode} className="space-y-4">
            <div className="flex items-center justify-center">
              <canvas
                ref={qrCanvas}
                hidden={qrFailed}
                className="rounded-md border border-white/10 bg-[#0B0F1A] p-2"
                aria-label="TOTP QR code"
              />
              {qrFailed && (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/[0.06] p-4 text-center text-[12px] text-amber-200/90">
                  The QR code could not be drawn in this browser. Use the
                  manual entry key below instead — it enrols exactly the same
                  factor.
                </div>
              )}
            </div>
            {secret && (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs">
                <div className="text-white/55 mb-1">
                  Manual entry key (case-insensitive, spaces ignored):
                </div>
                <code className="block break-all font-mono text-[11px] text-white/85 select-all">
                  {secret}
                </code>
                <button
                  type="button"
                  className="mt-2 text-[11px] text-white/60 underline underline-offset-2 hover:text-white/85"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret);
                      toast.success("Key copied");
                    } catch {
                      toast.error("Clipboard unavailable — select and copy manually");
                    }
                  }}
                >
                  Copy key
                </button>
              </div>
            )}
            <div>
              <label className="text-xs text-white/55 block mb-1">
                Verification code
              </label>
              <Input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                placeholder="123456"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={verify.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={code.length !== 6 || verify.isPending}
              >
                {verify.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Verify and enable</span>
              </Button>
            </DialogFooter>
          </form>
        )}

        {phase === "success" && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/[0.04] p-3 text-sm text-emerald-200">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Authenticator app enrolled
              </div>
              <p className="mt-1 text-xs text-emerald-100/80">
                Save the recovery codes below. They are the only way back in
                if you lose access to your authenticator. They will not be
                shown again.
              </p>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px] text-white/85">
              {recoveryCodes.map((c) => (
                <code key={c} className="select-all">
                  {c}
                </code>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
                    toast.success("Recovery codes copied");
                  } catch {
                    toast.error("Clipboard unavailable — copy manually");
                  }
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span className="ml-2">Copy codes</span>
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
