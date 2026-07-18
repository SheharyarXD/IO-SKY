/*
 * IO SKY — Developer Workspace · Agreements.
 *
 * Lists every required agreement (NDA / Confidentiality / Non-Solicit /
 * Liability / Security Policy) and the developer's signature state.
 * Signing routes through `signAgreement` which is intentionally a
 * `protectedProcedure` (so a developer who hasn't signed yet — and thus
 * cannot pass `developerProcedure` — can still sign) and audits the row.
 *
 * NOTE: a real legal flow would render the actual document and require
 * an explicit "I agree" inside an AlertDialog. We render the title +
 * version + summary and gate the action behind that confirm dialog.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
} from "@/pages/client-portal/components/PortalUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ClipboardSignature, Loader2 } from "lucide-react";

type AgreementType =
  | "nda"
  | "confidentiality"
  | "non-solicitation"
  | "liability"
  | "security-policy";

// The server's catalog only ships {type, version}. The human copy lives
// here so the UI never falls back to raw enum keys. If legal copy needs
// to change, update both this map and the version on the server side.
const AGREEMENT_COPY: Record<AgreementType, { title: string; summary: string }> = {
  nda: {
    title: "Non-Disclosure Agreement",
    summary:
      "Confidential project material, source artifacts, internal documents and roadmaps must remain confidential during and after your engagement.",
  },
  confidentiality: {
    title: "Confidentiality & Data Handling",
    summary:
      "You acknowledge IO SKY data classifications and commit to handling client information only inside approved tooling and storage.",
  },
  "non-solicitation": {
    title: "Non-Solicitation",
    summary:
      "You agree not to solicit IO SKY clients introduced through this engagement, or fellow contractors, for the duration plus 12 months.",
  },
  liability: {
    title: "Liability & Indemnification",
    summary:
      "Standard contractor liability terms, scope of indemnification, and IP assignment for code, designs, and configurations produced under this engagement.",
  },
  "security-policy": {
    title: "Security Policy Acknowledgment",
    summary:
      "MFA, device hygiene, secret handling, signed-URL-only file access, audit consent and incident-reporting expectations for engineering contractors.",
  },
};

export default function DeveloperAgreements() {
  const utils = trpc.useUtils();
  const agreementsQuery = trpc.developer.listAgreements.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [pending, setPending] = useState<AgreementType | null>(null);

  const sign = trpc.developer.signAgreement.useMutation({
    onSuccess: () => {
      toast.success("Agreement signed");
      utils.developer.listAgreements.invalidate();
      utils.developer.gateStatus.invalidate();
      utils.developer.dashboard.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Could not sign agreement");
    },
    onSettled: () => setPending(null),
  });

  return (
    <div>
      <SectionHeader
        eyebrow="Compliance"
        title="Agreements"
        description="Sign the required engineering agreements before accessing assigned work. Every signature is timestamped, audited, and bound to your account."
      />

      <SectionStateSwitch
        loading={agreementsQuery.isLoading}
        error={agreementsQuery.error}
        onRetry={() => agreementsQuery.refetch()}
        data={agreementsQuery.data ?? []}
        isEmpty={(d) => (d?.length ?? 0) === 0}
        emptyIcon={<ClipboardSignature className="h-5 w-5" />}
        emptyTitle="No agreements required"
        emptyBody="The engineering desk hasn't published required agreements yet."
        skeletonRows={5}
      />

      {agreementsQuery.data && agreementsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {agreementsQuery.data.map((row) => {
            const isPending = pending === row.type && sign.isPending;
            return (
              <GlassCard
                key={row.type}
                className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:gap-5 gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.02] text-white/55 text-[10px] uppercase tracking-wider"
                    >
                      {row.type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.02] text-white/55 text-[10px] uppercase tracking-wider"
                    >
                      v{row.version}
                    </Badge>
                    {row.signed && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Signed
                        {row.signedAtMs && (
                          <span className="text-emerald-300/60">
                            · {new Date(row.signedAtMs).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-sm md:text-base font-semibold text-white">
                    {AGREEMENT_COPY[row.type as AgreementType]?.title ?? row.type}
                  </h3>
                  <p className="mt-1 text-xs md:text-sm text-white/55">
                    {AGREEMENT_COPY[row.type as AgreementType]?.summary ?? ""}
                  </p>
                </div>

                <div className="md:w-auto shrink-0">
                  {row.signed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="ml-2">Signed</span>
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          disabled={isPending}
                          className="bg-orange-500 hover:bg-orange-400 text-black font-semibold shadow-[0_0_18px_-8px_rgba(255,134,46,0.7)]"
                        >
                          {isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ClipboardSignature className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-2">Review & sign</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#0a1020] border-white/10">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">
                            {AGREEMENT_COPY[row.type as AgreementType]?.title ?? row.type} <span className="text-white/45 text-sm font-normal">v{row.version}</span>
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-white/65">
                            {AGREEMENT_COPY[row.type as AgreementType]?.summary ?? ""}
                            <br />
                            <br />
                            By clicking "I agree" you confirm you have read this
                            agreement, that you are signing electronically, and
                            that the timestamp + IP recorded by IO SKY constitute
                            a binding signature for the version above.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-white/10 bg-white/[0.02] text-white/80 hover:bg-white/[0.05]">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              setPending(row.type as AgreementType);
                              sign.mutate({
                                agreementType: row.type as AgreementType,
                                version: row.version,
                              });
                            }}
                            className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                          >
                            I agree
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
