/*
 * IO SKY — Client Portal · Billing
 *
 * Surfaces the org's invoices with running totals (paid / outstanding /
 * count). Two functional flows:
 *   • Download PDF  → trpc.clientPortal.requestInvoiceSignedUrl
 *                     opens the signed URL in a new tab; download is logged
 *   • Pay Now       → trpc.clientPortal.requestInvoiceCheckout
 *                     scaffolded checkout intent (Stripe not yet enabled).
 *                     Audits + notifies the IO SKY team and routes the user
 *                     to /client-portal/billing?pay=<number> so we can show
 *                     manual instructions until Stripe lands.
 */
import { useMemo } from "react";
import { Download, Receipt, ExternalLink, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  GlassCard,
  SectionHeader,
  SectionStateSwitch,
  StatusPill,
} from "../components/PortalUI";

type Invoice = {
  id: number;
  number: string;
  description: string;
  status: "draft" | "open" | "paid" | "overdue" | "void" | string;
  amountCents: number;
  currency: string;
  issuedMs: number | null;
  dueMs: number | null;
  pdfKey: string | null;
};

const STATUS_VARIANT: Record<
  string,
  "good" | "warn" | "danger" | "neutral" | "info"
> = {
  paid: "good",
  open: "warn",
  draft: "info",
  overdue: "danger",
  void: "neutral",
};

function fmtMoney(cents: number, currency: string) {
  return (cents / 100).toLocaleString("en-EU", {
    style: "currency",
    currency,
  });
}

export default function ClientInvoices() {
  const invoices = trpc.clientPortal.invoices.useQuery();
  const list = (invoices.data ?? []) as Invoice[];

  const { paid, outstanding, currency } = useMemo(() => {
    const paidCents = list
      .filter(i => i.status === "paid")
      .reduce((s, i) => s + i.amountCents, 0);
    const outstandingCents = list
      .filter(i => i.status === "open" || i.status === "overdue")
      .reduce((s, i) => s + i.amountCents, 0);
    return {
      paid: paidCents,
      outstanding: outstandingCents,
      currency: list[0]?.currency ?? "EUR",
    };
  }, [list]);

  const downloadPdf = trpc.clientPortal.requestInvoiceSignedUrl.useMutation({
    onSuccess: res => {
      window.open(res.url, "_blank", "noopener,noreferrer");
      toast.success(`Receipt ready — ${res.number}`, {
        description: "Link expires in 10 minutes.",
      });
    },
    onError: error => {
      toast.error("Couldn't open the PDF", {
        description: error.message ?? "Please try again.",
      });
    },
  });

  const startCheckout = trpc.clientPortal.requestInvoiceCheckout.useMutation({
    onSuccess: res => {
      toast.success(`Payment started — ${res.invoice.number}`, {
        description:
          "Your IO SKY operating partner has been notified. Routing you to instructions…",
      });
      // Navigate within /client-portal/billing — keeps the user inside the
      // portal layout while the manual-pay placeholder loads.
      window.location.href = res.instructionsUrl;
    },
    onError: error => {
      toast.error("Couldn't start payment", {
        description: error.message ?? "Please try again.",
      });
    },
  });

  const isCheckoutPending = (id: number) =>
    startCheckout.isPending && startCheckout.variables?.id === id;
  const isPdfPending = (id: number) =>
    downloadPdf.isPending && downloadPdf.variables?.id === id;

  return (
    <>
      <SectionHeader
        eyebrow="Billing"
        title="Invoices & billing"
        description="Every invoice IO SKY issues against your organization, with secure PDF download, audited Pay Now and live payment status."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <GlassCard className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Total paid
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {fmtMoney(paid, currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Outstanding
          </p>
          <p className="mt-2 text-2xl font-semibold text-orange-200">
            {fmtMoney(outstanding, currency)}
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            Invoices
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {list.length}
          </p>
        </GlassCard>
      </div>

      <SectionStateSwitch
        loading={invoices.isLoading}
        error={invoices.error}
        onRetry={() => invoices.refetch()}
        data={list}
        isEmpty={d => d.length === 0}
        emptyIcon={<Receipt className="h-5 w-5" />}
        emptyTitle="No invoices on file"
        emptyBody="When IO SKY issues your first invoice it will appear here automatically with full audit trail."
        skeletonRows={5}
      />

      {!invoices.isLoading && !invoices.error && list.length > 0 && (
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.18em] text-white/45">
                <tr>
                  <th className="px-5 py-3 text-left">Invoice</th>
                  <th className="px-5 py-3 text-left">Description</th>
                  <th className="px-5 py-3 text-left">Issued</th>
                  <th className="px-5 py-3 text-left">Due</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.map(inv => {
                  const isPayable =
                    inv.status === "open" || inv.status === "overdue";
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-orange-500/[0.04] transition-colors"
                    >
                      <td className="px-5 py-3 text-orange-200 font-mono text-xs">
                        {inv.number}
                      </td>
                      <td className="px-5 py-3 text-white/80">
                        {inv.description}
                      </td>
                      <td className="px-5 py-3 text-white/65">
                        {inv.issuedMs
                          ? new Date(inv.issuedMs).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-white/65">
                        {inv.dueMs
                          ? new Date(inv.dueMs).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-mono">
                        {fmtMoney(inv.amountCents, inv.currency)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill
                          status={inv.status}
                          variant={STATUS_VARIANT[inv.status] ?? "info"}
                        />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {inv.pdfKey ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPdfPending(inv.id)}
                              onClick={() =>
                                downloadPdf.mutate({ id: inv.id })
                              }
                              className="border-white/15 bg-white/[0.02] text-white/80 hover:bg-orange-500/10 hover:text-orange-200 hover:border-orange-500/40"
                            >
                              {isPdfPending(inv.id) ? (
                                "Opening…"
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5 mr-1" />
                                  PDF
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-white/30 text-xs">No PDF</span>
                          )}
                          {isPayable ? (
                            <Button
                              size="sm"
                              disabled={isCheckoutPending(inv.id)}
                              onClick={() =>
                                startCheckout.mutate({ id: inv.id })
                              }
                              className="bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                            >
                              {isCheckoutPending(inv.id) ? (
                                "Routing…"
                              ) : (
                                <>
                                  <CreditCard className="h-3.5 w-3.5 mr-1" />
                                  Pay Now
                                  <ExternalLink className="h-3 w-3 ml-1.5 opacity-70" />
                                </>
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </>
  );
}
