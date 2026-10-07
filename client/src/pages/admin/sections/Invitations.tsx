/*
 * IO SKY — Admin Portal · Invitations (SRS 8.7, BR-004).
 *
 * Registration is invitation only. The activation link is emailed straight to
 * the invitee and never shown here, so an admin cannot activate an account on
 * someone else's behalf.
 */
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { INVITABLE_ROLES } from "@shared/srsRules";
import { DataTable, StatusPill } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, shortDateTime } from "./_shared/Forms";

export function Invitations() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.invitations.useQuery();
  const invite = trpc.adminOps.inviteUser.useMutation({ onSuccess: () => utils.adminOps.invitations.invalidate() });
  const revoke = trpc.adminOps.revokeInvitation.useMutation({ onSuccess: () => utils.adminOps.invitations.invalidate() });
  type Row = NonNullable<typeof q.data>[number];
  const tone = (s: string) => (s === "accepted" ? "ok" : s === "pending" ? "info" : s === "expired" ? "warn" : "muted");
  return (
    <>
      <Panel title="Invitations">
        <DataTable
          columns={[
            { key: "email", header: "Email" },
            { key: "role", header: "Role", render: (r: Row) => r.role.replace(/_/g, " ") },
            { key: "state", header: "State", render: (r: Row) => <StatusPill tone={tone(r.state) as never} label={r.state} /> },
            { key: "expiresAt", header: "Expires", render: (r: Row) => shortDateTime(r.expiresAt) },
            {
              key: "actions",
              header: "",
              render: (r: Row) =>
                r.state === "pending" ? (
                  <SmallButton tone="danger" onClick={() => revoke.mutateAsync({ id: r.id }).then(() => toast.success("Invitation revoked.")).catch((e) => toast.error(e.message))}>
                    Revoke
                  </SmallButton>
                ) : null,
            },
          ]}
          rows={q.data ?? []}
          emptyLabel="No invitations yet."
        />
      </Panel>
      <FormCard
        title="Invite someone"
        submitLabel="Send invitation"
        successMessage="Invitation sent. The link works once and expires in 7 days."
        fields={[
          { name: "email", label: "Email", type: "email", required: true },
          { name: "role", label: "Role", type: "select", required: true, initial: "client", options: INVITABLE_ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ") })), hint: "Admin, super admin and technical operator invitations need a super admin." },
          { name: "organizationId", label: "Organization id", type: "number", hint: "Required for a client." },
        ]}
        onSubmit={async (v) => {
          const r = await invite.mutateAsync({ email: v.email, role: v.role as (typeof INVITABLE_ROLES)[number], organizationId: v.organizationId ? Number(v.organizationId) : undefined });
          if (!r.emailSent) throw new Error("The invitation was created but the email could not be sent. Check email delivery, then revoke and invite again.");
        }}
      />
    </>
  );
}
