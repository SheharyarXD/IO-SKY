/**
 * Proposal Request form (Package 7).
 * Reachable via /solutions/proposal-request?ecosystem=growth|elite|custom
 * Submits to solutions.requestProposal, which creates a CRM lead + admin
 * notification.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Ecosystem = "growth" | "elite" | "custom";

const LABELS: Record<Ecosystem, { name: string; tagline: string }> = {
  growth: {
    name: "Growth Ecosystem",
    tagline: "For ambitious scale-ups ready to operationalize growth.",
  },
  elite: {
    name: "Elite Ecosystem",
    tagline: "High-control operational intelligence for advanced operations.",
  },
  custom: {
    name: "Custom Intelligence Infrastructure",
    tagline: "Bespoke systems for proprietary product needs.",
  },
};

export default function ProposalRequest() {
  const [location] = useLocation();
  const ecosystem: Ecosystem = useMemo(() => {
    const q = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    const v = q.get("ecosystem");
    return v === "elite" || v === "custom" ? v : "growth";
  }, [location]);

  const m = trpc.solutions.requestProposal.useMutation();
  const recordClick = trpc.solutions.recordClick.useMutation();

  useEffect(() => {
    recordClick.mutate({
      eventKey: "proposal_request_view",
      source: "solutions/proposal",
      ecosystem,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecosystem]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    company: "",
    phone: "",
    goals: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const valid =
    form.fullName.trim().length > 1 &&
    /@/.test(form.email) &&
    form.email.length > 5 &&
    accepted;

  const submit = async () => {
    if (!valid) return;
    try {
      await m.mutateAsync({
        ecosystem,
        fullName: form.fullName,
        email: form.email,
        company: form.company || null,
        phone: form.phone || null,
        goals: form.goals || null,
        message: form.message || null,
        source: "solutions",
      });
      setSubmitted(true);
      toast.success("Proposal request received");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not submit. Try again.",
      );
    }
  };

  const labels = LABELS[ecosystem];

  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <Navbar />

      <div className="container pt-24 pb-2">
        <Link
          href="/solutions"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-[var(--orange)] transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Solutions
        </Link>
      </div>

      <section className="container pt-6 pb-16">
        <div className="max-w-2xl">
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-[var(--orange)] font-semibold">
            REQUEST PROPOSAL · {labels.name.toUpperCase()}
          </p>
          <h1 className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.07]">
            Request a tailored {labels.name} proposal.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/68">
            {labels.tagline} Our team will review your inputs and respond with a
            branded scope, timeline and pricing — typically within one business day.
          </p>
        </div>

        {!submitted ? (
          <div className="mt-10 max-w-2xl rounded-2xl glass-soft p-7 sm:p-10 ring-1 ring-white/8 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name *" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
              <Field label="Work email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <Field
              label="Goals — what are you trying to achieve?"
              value={form.goals}
              onChange={(v) => setForm({ ...form, goals: v })}
              multiline
            />
            <Field
              label="Anything we should know?"
              value={form.message}
              onChange={(v) => setForm({ ...form, message: v })}
              multiline
            />
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--orange)]"
              />
              <span className="text-[12px] leading-[1.55] text-white/65">
                I accept the{" "}
                <Link href="/terms" className="text-[var(--orange)] hover:underline">
                  Terms of Service
                </Link>{" "}
                and consent to IO SKY processing this request in line with the{" "}
                <Link href="/privacy" className="text-[var(--orange)] hover:underline">
                  Privacy Notice
                </Link>
                .
              </span>
            </label>
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-white/50">
                We never share inquiries. IO SKY responds within 1 business day.
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={!valid || m.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13.5px] font-semibold disabled:opacity-40 hover:bg-[var(--orange-hover)] transition-colors active:scale-[0.98]"
              >
                {m.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-10 max-w-2xl rounded-2xl glass-soft p-10 ring-1 ring-emerald-400/30 text-center">
            <CheckCircle2 className="size-9 mx-auto text-emerald-300" />
            <h3 className="mt-4 text-2xl font-semibold">Request received.</h3>
            <p className="mt-3 text-[14px] text-white/65">
              Your {labels.name} proposal will land in your inbox within one
              business day. In the meantime, you can also schedule a discovery call.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/book-strategy?source=proposal_received"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--orange)] text-[#0B1020] text-[13px] font-semibold hover:bg-[var(--orange-hover)] transition-colors"
              >
                Book Discovery Call
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/12 text-white/85 text-[13px] hover:border-[var(--orange)]/45 hover:text-[var(--orange)] transition-colors"
              >
                Back to Solutions
              </Link>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors focus:border-[var(--orange)]/55";
  return (
    <label className="block">
      <span className="block text-[12px] uppercase tracking-[0.18em] text-white/55 mb-2">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className={cls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
