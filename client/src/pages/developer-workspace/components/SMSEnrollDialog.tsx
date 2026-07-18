/*
 * SMS enrollment dialog.
 *
 * Three phases:
 *   1. `phone` — user types an E.164 number; we POST mfa.enrollSmsBegin
 *      and the server dispatches a 6-digit OTP via the active SMS provider
 *      (Twilio in production, console-logger in dev).
 *   2. `verify` — user types the OTP; we POST mfa.enrollSmsVerify.
 *   3. `success` — show the 10 recovery codes that were issued (only
 *      time they are ever returned to the client).
 *
 * On wrong code the dialog stays on the `verify` phase and surfaces the
 * server's lock + retry messages.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { KeyRound, Loader2, Send, ShieldCheck } from "lucide-react";

type Phase = "phone" | "verify" | "success";

export function SMSEnrollDialog(props: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onEnrolled?: () => void;
}) {
  const { open, onOpenChange, onEnrolled } = props;
  const utils = trpc.useUtils();

  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [phoneHint, setPhoneHint] = useState("");
  const [factorId, setFactorId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Reset state when the dialog re-opens.
  useEffect(() => {
    if (!open) {
      setPhase("phone");
      setPhone("");
      setPhoneHint("");
      setFactorId(null);
      setCode("");
      setRecoveryCodes([]);
    }
  }, [open]);

  const begin = trpc.mfa.enrollSmsBegin.useMutation({
    onSuccess: (out) => {
      setFactorId(out.factorId);
      setPhoneHint(out.phoneHint);
      setPhase("verify");
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not send the SMS code");
    },
  });

  const verify = trpc.mfa.enrollSmsVerify.useMutation({
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

  const resend = trpc.mfa.requestSmsCode.useMutation({
    onSuccess: () => toast.success("New code sent"),
    onError: (err) => toast.error(err.message ?? "Could not resend the code"),
  });

  const onSubmitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (begin.isPending) return;
    begin.mutate({ phone });
  };

  const onSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || verify.isPending) return;
    verify.mutate({ factorId, code });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add phone (SMS)</DialogTitle>
          <DialogDescription>
            We will send a 6-digit verification code to this number every time
            you sign in. Standard carrier rates apply.
          </DialogDescription>
        </DialogHeader>

        {phase === "phone" && (
          <form onSubmit={onSubmitPhone} className="space-y-4">
            <div>
              <label className="text-xs text-white/55 block mb-1">
                Phone number (E.164, e.g. +31612345678)
              </label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+31612345678"
                inputMode="tel"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={begin.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!phone.trim() || begin.isPending}
              >
                {begin.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span className="ml-2">Send code</span>
              </Button>
            </DialogFooter>
          </form>
        )}

        {phase === "verify" && (
          <form onSubmit={onSubmitCode} className="space-y-4">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
              We sent a 6-digit code to{" "}
              <span className="text-white/95 font-medium">{phoneHint}</span>.
              It expires in 5 minutes.
            </div>
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
                onClick={() => factorId && resend.mutate({ factorId })}
                disabled={!factorId || resend.isPending}
              >
                Resend
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
                SMS factor enrolled
              </div>
              <p className="mt-1 text-xs text-emerald-100/80">
                Save the recovery codes below. They are the only way back in if
                you lose access to your phone. They will not be shown again.
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
