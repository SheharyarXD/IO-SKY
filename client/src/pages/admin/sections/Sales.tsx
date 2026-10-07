/*
 * IO SKY — Admin Portal · Sales and Finance (SRS 14, 16).
 *
 * Opportunities and their lifecycle, proposals, activities and follow ups,
 * customer timelines, quotations, subscriptions and the financial summary.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { canMoveOpportunity, canMoveDocument, OPPORTUNITY_STAGES, type DocumentStatus, type OpportunityStage } from "@shared/srsRules";
import OperationalPage, { DataTable, StatusPill, type DataColumn } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, TabBar, money, shortDate, shortDateTime } from "./_shared/Forms";

type Tab = "pipeline" | "proposals" | "activities" | "quotes" | "subscriptions" | "finance";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "pipeline", label: "Opportunities" },
  { id: "proposals", label: "Proposals" },
  { id: "activities", label: "Activities & follow ups" },
  { id: "quotes", label: "Quotations" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "finance", label: "Financial summary" },
];

const stageTone = (s: string) => (s === "won" ? "ok" : s === "lost" ? "err" : "info");
const docTone = (s: string) => (s === "accepted" ? "ok" : s === "rejected" || s === "expired" ? "err" : s === "sent" ? "info" : "muted");
const optInt = (v: string) => (v.trim() ? Number(v) : undefined);

export function Sales() {
  const [tab, setTab] = useState<Tab>("pipeline");
  return (
    <OperationalPage
      eyebrow="Revenue"
      title="Sales & Finance"
      tagline="Opportunities through to won handover, proposals, quotations, subscriptions and the financial position."
      primary={
        <div className="space-y-4">
          <TabBar tabs={TABS} value={tab} onChange={setTab} />
          {tab === "pipeline" && <Pipeline />}
          {tab === "proposals" && <Proposals />}
          {tab === "activities" && <Activities />}
          {tab === "quotes" && <Quotes />}
          {tab === "subscriptions" && <Subscriptions />}
          {tab === "finance" && <Finance />}
        </div>
      }
    />
  );
}

function Pipeline() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.opportunities.useQuery({});
  const create = trpc.adminOps.createOpportunity.useMutation({ onSuccess: () => utils.adminOps.opportunities.invalidate() });
  const move = trpc.adminOps.moveOpportunity.useMutation({ onSuccess: () => utils.adminOps.opportunities.invalidate() });

  const doMove = async (id: number, to: OpportunityStage) => {
    let lostReason: string | undefined;
    if (to === "lost") {
      const r = window.prompt("Why was this opportunity lost?");
      if (!r?.trim()) return;
      lostReason = r.trim();
    }
    try {
      const res = await move.mutateAsync({ id, to, lostReason });
      toast.success(to === "won" && res.handoverProjectId ? `Won. Project #${res.handoverProjectId} created.` : `Moved to ${to}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const cols: DataColumn<NonNullable<typeof q.data>["rows"][number]>[] = [
    { key: "id", header: "Ref", width: "64px", render: (r) => <span className="font-mono text-white/55">OPP-{r.id}</span> },
    { key: "title", header: "Opportunity" },
    { key: "valueCents", header: "Value", align: "right", render: (r) => money(r.valueCents, r.currency) },
    { key: "stage", header: "Stage", render: (r) => <StatusPill tone={stageTone(r.stage) as never} label={r.stage} /> },
    {
      key: "actions",
      header: "Move to",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {OPPORTUNITY_STAGES.filter((s) => canMoveOpportunity(r.stage as OpportunityStage, s)).map((s) => (
            <SmallButton key={s} tone={s === "lost" ? "danger" : "default"} onClick={() => doMove(r.id, s)}>
              {s}
            </SmallButton>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      {q.data?.pipeline?.length ? (
        <div className="flex flex-wrap gap-2">
          {q.data.pipeline.map((p) => (
            <div key={p.stage} className="rounded-[10px] border border-white/[0.06] px-3 py-2 text-[12px]">
              <div className="font-mono uppercase text-[10px] tracking-[0.16em] text-white/50">{p.stage}</div>
              <div className="text-white/90">{p.count} · {money(p.valueCents)}</div>
            </div>
          ))}
        </div>
      ) : null}
      <Panel title="Opportunities">
        <DataTable columns={cols} rows={q.data?.rows ?? []} emptyLabel="No opportunities yet." />
      </Panel>
      <FormCard
        title="New opportunity"
        submitLabel="Create opportunity"
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "leadId", label: "Lead id", type: "number", hint: "Lead or organization is required." },
          { name: "organizationId", label: "Organization id", type: "number", hint: "Required before it can be won." },
          { name: "value", label: "Value (EUR)", type: "number", initial: "0" },
          { name: "expectedCloseDate", label: "Expected close", type: "date" },
        ]}
        onSubmit={(v) =>
          create.mutateAsync({
            title: v.title,
            leadId: optInt(v.leadId),
            organizationId: optInt(v.organizationId),
            valueCents: Math.round(Number(v.value || 0) * 100),
            expectedCloseDate: v.expectedCloseDate || undefined,
          })
        }
      />
    </>
  );
}

function Proposals() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.proposals.useQuery({});
  const create = trpc.adminOps.createProposal.useMutation({ onSuccess: () => utils.adminOps.proposals.invalidate() });
  const move = trpc.adminOps.moveProposal.useMutation({ onSuccess: () => utils.adminOps.proposals.invalidate() });
  const STATUSES: DocumentStatus[] = ["sent", "accepted", "rejected", "expired"];
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "id", header: "Ref", width: "64px", render: (r) => <span className="font-mono text-white/55">PRP-{r.id}</span> },
    { key: "title", header: "Proposal" },
    { key: "opportunityId", header: "Opp.", render: (r) => `OPP-${r.opportunityId}` },
    { key: "amountCents", header: "Amount", align: "right", render: (r) => money(r.amountCents, r.currency) },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={docTone(r.status) as never} label={r.status} /> },
    {
      key: "actions",
      header: "Move to",
      render: (r) => (
        <div className="flex gap-1">
          {STATUSES.filter((s) => canMoveDocument(r.status as DocumentStatus, s)).map((s) => (
            <SmallButton key={s} onClick={() => move.mutateAsync({ id: r.id, to: s }).catch((e) => toast.error(e.message))}>
              {s}
            </SmallButton>
          ))}
        </div>
      ),
    },
  ];
  return (
    <>
      <Panel title="Proposals">
        <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No proposals yet." />
      </Panel>
      <FormCard
        title="New proposal"
        submitLabel="Create proposal"
        fields={[
          { name: "opportunityId", label: "Opportunity id", type: "number", required: true },
          { name: "title", label: "Title", required: true },
          { name: "amount", label: "Amount (EUR)", type: "number", required: true },
          { name: "validUntil", label: "Valid until", type: "date" },
          { name: "body", label: "Body", type: "textarea" },
        ]}
        onSubmit={(v) =>
          create.mutateAsync({ opportunityId: Number(v.opportunityId), title: v.title, amountCents: Math.round(Number(v.amount) * 100), validUntil: v.validUntil || undefined, body: v.body || undefined })
        }
      />
    </>
  );
}

function Activities() {
  const utils = trpc.useUtils();
  const follow = trpc.adminOps.followUps.useQuery();
  const create = trpc.adminOps.createActivity.useMutation({ onSuccess: () => utils.adminOps.followUps.invalidate() });
  const complete = trpc.adminOps.completeActivity.useMutation({ onSuccess: () => utils.adminOps.followUps.invalidate() });
  const outcome = trpc.adminOps.recordCallOutcome.useMutation({ onSuccess: () => utils.adminOps.followUps.invalidate() });
  const [lookup, setLookup] = useState<{ leadId?: number; organizationId?: number } | null>(null);
  const timeline = trpc.adminOps.customerTimeline.useQuery(lookup ?? { leadId: 1 }, { enabled: lookup !== null });
  const now = Date.now();
  return (
    <>
      <Panel title="Open follow ups">
        <DataTable
          columns={[
            { key: "subject", header: "Follow up" },
            { key: "dueAt", header: "Due", render: (r: NonNullable<typeof follow.data>[number]) => <span className={r.dueAt && new Date(r.dueAt).getTime() < now ? "text-red-300" : ""}>{shortDateTime(r.dueAt)}</span> },
            { key: "actions", header: "", align: "right", render: (r: NonNullable<typeof follow.data>[number]) => <SmallButton onClick={() => complete.mutateAsync({ id: r.id }).then(() => toast.success("Done."))}>Mark done</SmallButton> },
          ]}
          rows={follow.data ?? []}
          emptyLabel="Nothing waiting on a follow up."
        />
      </Panel>
      <FormCard
        title="Log an activity"
        submitLabel="Log activity"
        fields={[
          { name: "kind", label: "Type", type: "select", required: true, initial: "note", options: ["call", "email", "meeting", "note", "follow_up"].map((k) => ({ value: k, label: k.replace("_", " ") })) },
          { name: "subject", label: "Subject", required: true },
          { name: "leadId", label: "Lead id", type: "number" },
          { name: "opportunityId", label: "Opportunity id", type: "number" },
          { name: "organizationId", label: "Organization id", type: "number" },
          { name: "dueAt", label: "Due (follow ups)", type: "datetime-local" },
          { name: "body", label: "Notes", type: "textarea" },
        ]}
        onSubmit={(v) =>
          create.mutateAsync({
            kind: v.kind as "call",
            subject: v.subject,
            body: v.body || undefined,
            leadId: optInt(v.leadId),
            opportunityId: optInt(v.opportunityId),
            organizationId: optInt(v.organizationId),
            dueAt: v.dueAt ? new Date(v.dueAt).getTime() : undefined,
          })
        }
      />
      <FormCard
        title="Record a Discovery Call outcome"
        submitLabel="Record outcome"
        successMessage="Outcome recorded. The call is marked completed and added to the customer timeline."
        fields={[
          { name: "bookingId", label: "Booking id", type: "number", required: true, hint: "From Discovery Calls." },
          { name: "outcome", label: "Outcome", type: "select", required: true, initial: "qualified", options: [{ value: "qualified", label: "Qualified" }, { value: "not_a_fit", label: "Not a fit" }, { value: "needs_follow_up", label: "Needs follow up" }, { value: "proposal_requested", label: "Proposal requested" }] },
          { name: "followUpAt", label: "Follow up on", type: "datetime-local", hint: "Required for follow up and proposal outcomes." },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={(v) =>
          outcome.mutateAsync({
            bookingId: Number(v.bookingId),
            outcome: v.outcome as "qualified",
            notes: v.notes || undefined,
            followUpAt: v.followUpAt ? new Date(v.followUpAt).getTime() : undefined,
          })
        }
      />
      <FormCard
        title="Customer timeline"
        submitLabel="Show history"
        columns={2}
        fields={[
          { name: "leadId", label: "Lead id", type: "number" },
          { name: "organizationId", label: "Organization id", type: "number" },
        ]}
        successMessage="Loaded."
        onSubmit={async (v) => {
          if (!v.leadId && !v.organizationId) throw new Error("Enter a lead id or an organization id.");
          setLookup({ leadId: optInt(v.leadId), organizationId: optInt(v.organizationId) });
        }}
      />
      {lookup ? (
        <Panel title="History">
          <DataTable
            columns={[
              { key: "at", header: "When", render: (r: NonNullable<typeof timeline.data>[number] & { id: string }) => shortDateTime(r.at) },
              { key: "type", header: "Type" },
              { key: "title", header: "What" },
            ]}
            rows={(timeline.data ?? []).map((t) => ({ ...t, id: t.ref }))}
            emptyLabel="No history for that customer yet."
          />
        </Panel>
      ) : null}
    </>
  );
}

function Quotes() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.quotes.useQuery();
  const create = trpc.adminOps.createQuote.useMutation({ onSuccess: () => utils.adminOps.quotes.invalidate() });
  const move = trpc.adminOps.moveQuote.useMutation({ onSuccess: () => utils.adminOps.quotes.invalidate() });
  const STATUSES: DocumentStatus[] = ["sent", "accepted", "rejected", "expired"];
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "publicRef", header: "Ref", render: (r) => <span className="font-mono text-white/55">{r.publicRef}</span> },
    { key: "title", header: "Quotation" },
    { key: "totalCents", header: "Total", align: "right", render: (r) => money(r.totalCents, r.currency) },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={docTone(r.status) as never} label={r.status} /> },
    {
      key: "actions",
      header: "Move to",
      render: (r) => (
        <div className="flex gap-1">
          {STATUSES.filter((s) => canMoveDocument(r.status as DocumentStatus, s)).map((s) => (
            <SmallButton key={s} onClick={() => move.mutateAsync({ id: r.id, to: s }).catch((e) => toast.error(e.message))}>
              {s}
            </SmallButton>
          ))}
        </div>
      ),
    },
  ];
  return (
    <>
      <Panel title="Quotations">
        <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No quotations yet." />
      </Panel>
      <FormCard
        title="New quotation (one line; add more by editing later)"
        submitLabel="Create quotation"
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "organizationId", label: "Organization id", type: "number" },
          { name: "opportunityId", label: "Opportunity id", type: "number" },
          { name: "description", label: "Line description", required: true },
          { name: "quantity", label: "Quantity", type: "number", initial: "1", required: true },
          { name: "unit", label: "Unit price (EUR)", type: "number", required: true },
          { name: "validUntil", label: "Valid until", type: "date" },
        ]}
        onSubmit={(v) =>
          create.mutateAsync({
            title: v.title,
            organizationId: optInt(v.organizationId),
            opportunityId: optInt(v.opportunityId),
            validUntil: v.validUntil || undefined,
            lines: [{ description: v.description, quantity: Number(v.quantity), unitCents: Math.round(Number(v.unit) * 100) }],
          })
        }
      />
    </>
  );
}

function Subscriptions() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.subscriptions.useQuery({});
  const create = trpc.adminOps.createSubscription.useMutation({ onSuccess: () => utils.adminOps.subscriptions.invalidate() });
  const set = trpc.adminOps.setSubscriptionStatus.useMutation({ onSuccess: () => utils.adminOps.subscriptions.invalidate() });
  const tone = (s: string) => (s === "active" ? "ok" : s === "cancelled" ? "err" : "warn");
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "id", header: "Ref", width: "64px", render: (r) => <span className="font-mono text-white/55">SUB-{r.id}</span> },
    { key: "organizationId", header: "Org", render: (r) => `#${r.organizationId}` },
    { key: "plan", header: "Plan" },
    { key: "amountCents", header: "Amount", align: "right", render: (r) => `${money(r.amountCents, r.currency)} / ${r.billingInterval}` },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={tone(r.status) as never} label={r.status} /> },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "cancelled" ? null : (
          <div className="flex gap-1">
            {r.status !== "active" && <SmallButton onClick={() => set.mutateAsync({ id: r.id, status: "active" })}>Activate</SmallButton>}
            {r.status === "active" && <SmallButton onClick={() => set.mutateAsync({ id: r.id, status: "paused" })}>Pause</SmallButton>}
            <SmallButton tone="danger" onClick={() => window.confirm("Cancelling is final. Continue?") && set.mutateAsync({ id: r.id, status: "cancelled" })}>
              Cancel
            </SmallButton>
          </div>
        ),
    },
  ];
  return (
    <>
      <Panel title="Subscriptions">
        <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No subscriptions yet." />
      </Panel>
      <FormCard
        title="New subscription"
        submitLabel="Create subscription"
        fields={[
          { name: "organizationId", label: "Organization id", type: "number", required: true },
          { name: "plan", label: "Plan", required: true },
          { name: "amount", label: "Amount (EUR)", type: "number", required: true },
          { name: "billingInterval", label: "Interval", type: "select", required: true, initial: "monthly", options: ["monthly", "quarterly", "yearly"].map((v) => ({ value: v, label: v })) },
        ]}
        onSubmit={(v) => create.mutateAsync({ organizationId: Number(v.organizationId), plan: v.plan, amountCents: Math.round(Number(v.amount) * 100), billingInterval: v.billingInterval as "monthly" })}
      />
    </>
  );
}

function Finance() {
  const q = trpc.adminOps.financialSummary.useQuery();
  const f = q.data;
  if (!f) return <div className="text-[12.5px] text-white/55">{q.isLoading ? "Loading…" : "Financial data is unavailable."}</div>;
  const rows: Array<[string, string]> = [
    ["Outstanding", `${money(f.outstandingCents)} across ${f.openInvoices} invoices`],
    ["Overdue", `${money(f.overdueCents)} across ${f.overdueInvoices} invoices`],
    ["Paid, last 30 days", money(f.paidLast30DaysCents)],
    ["Paid, last 90 days", money(f.paidLast90DaysCents)],
    ["Monthly recurring revenue", `${money(f.monthlyRecurringCents)} from ${f.activeSubscriptions} subscriptions`],
  ];
  return (
    <Panel title="Financial summary">
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-[10px] border border-white/[0.06] px-3 py-2">
            <dt className="text-[10.5px] font-mono uppercase tracking-[0.16em] text-white/50">{k}</dt>
            <dd className="mt-1 text-[13px] text-white/90">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11.5px] text-white/45">Computed from invoice and subscription records. Payment processing is not connected, so "paid" reflects what an admin has recorded.</p>
    </Panel>
  );
}
