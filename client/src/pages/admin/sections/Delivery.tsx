/*
 * IO SKY — Admin Portal · Delivery (SRS 11, 12, 15).
 *
 * Developer projects and assignments (BR-018), tasks, time review, customer
 * approval gates (BR-019), project archiving and messages to developers.
 */
import { PROJECT_LIFECYCLE, nextLifecycleStates } from "@shared/srsRules";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OperationalPage, { DataTable, StatusPill, type DataColumn } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, TabBar, shortDateTime } from "./_shared/Forms";

type Tab = "assign" | "teams" | "tasks" | "time" | "approvals" | "messages";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "assign", label: "Projects & assignment" },
  { id: "teams", label: "Teams" },
  { id: "tasks", label: "Tasks" },
  { id: "time", label: "Time review" },
  { id: "approvals", label: "Customer approvals" },
  { id: "messages", label: "Message a developer" },
];

const optInt = (v: string) => (v.trim() ? Number(v) : undefined);

export function Delivery() {
  const [tab, setTab] = useState<Tab>("assign");
  return (
    <OperationalPage
      eyebrow="Delivery"
      title="Delivery Management"
      tagline="Assign developers to projects, hand out tasks, review time, and ask customers to approve a phase before it moves on."
      primary={
        <div className="space-y-4">
          <TabBar tabs={TABS} value={tab} onChange={setTab} />
          {tab === "assign" && <Assign />}
          {tab === "teams" && <Teams />}
          {tab === "tasks" && <Tasks />}
          {tab === "time" && <TimeReview />}
          {tab === "approvals" && <Approvals />}
          {tab === "messages" && <Messages />}
        </div>
      }
    />
  );
}

function useDevOptions() {
  const devs = trpc.admin.developers.useQuery(undefined, { staleTime: 30_000 });
  const rows = devs.data && "rows" in devs.data ? (devs.data as { rows: Array<{ id: number; fullName: string; status: string }> }).rows : [];
  return rows.filter((d) => d.status === "active").map((d) => ({ value: String(d.id), label: `${d.fullName} (DEV-${d.id})` }));
}

const EVENT_LABEL: Record<string, string> = {
  assigned: "Assigned",
  released: "Released",
  reassigned_out: "Moved away",
  reassigned_in: "Moved to",
  replaced_out: "Replaced (left)",
  replaced_in: "Replaced (joined)",
};

type HistoryRow = { id: number; event: string; developerName: string | null; counterpartName: string | null; reason: string | null; createdAt: string | Date; taskId: number | null };

function HistoryTable({ rows, empty }: { rows: HistoryRow[]; empty: string }) {
  const cols: DataColumn<HistoryRow>[] = [
    { key: "createdAt", header: "When", render: (r) => shortDateTime(r.createdAt) },
    { key: "event", header: "What", render: (r) => EVENT_LABEL[r.event] ?? r.event },
    { key: "taskId", header: "Task", render: (r) => (r.taskId ? `T-${r.taskId}` : "Whole project") },
    { key: "developerName", header: "Developer", render: (r) => r.developerName ?? "n/a" },
    { key: "counterpartName", header: "With", render: (r) => r.counterpartName ?? "" },
    { key: "reason", header: "Reason", render: (r) => r.reason ?? "" },
  ];
  return <DataTable columns={cols} rows={rows} emptyLabel={empty} />;
}

function ProjectHistory({ projects }: { projects: Array<{ id: number; code: string; name: string }> }) {
  const [id, setId] = useState<number | null>(null);
  const q = trpc.admin.projectAssignmentHistory.useQuery({ projectId: id ?? 0 }, { enabled: id !== null });
  return (
    <Panel title="Assignment history (kept for every move)">
      <select className="mb-3 rounded border border-white/15 bg-transparent px-2 py-1 text-sm" value={id ?? ""} onChange={(e) => setId(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Choose a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code}: {p.name}
          </option>
        ))}
      </select>
      {id === null ? <p className="text-sm text-white/55">Choose a project to see who held its work and why it moved.</p> : <HistoryTable rows={(q.data ?? []) as HistoryRow[]} empty="No assignment changes are recorded for this project yet." />}
    </Panel>
  );
}

function Assign() {
  const utils = trpc.useUtils();
  const projects = trpc.admin.developerProjects.useQuery();
  const assignments = trpc.admin.developerAssignments.useQuery();
  const devOptions = useDevOptions();
  const create = trpc.admin.createDeveloperProject.useMutation({ onSuccess: () => utils.admin.developerProjects.invalidate() });
  const assign = trpc.admin.assignDeveloperToProject.useMutation({ onSuccess: () => utils.admin.developerAssignments.invalidate() });
  const end = trpc.admin.endDeveloperAssignment.useMutation({ onSuccess: () => utils.admin.developerAssignments.invalidate() });
  const replace = trpc.admin.replaceProjectDeveloper.useMutation({ onSuccess: () => { utils.admin.developerAssignments.invalidate(); utils.admin.developerTasks.invalidate(); utils.admin.projectAssignmentHistory.invalidate(); } });
  const projectOptions = (projects.data ?? []).filter((p) => p.status !== "completed").map((p) => ({ value: String(p.id), label: `${p.code}: ${p.name}` }));

  const cols: DataColumn<NonNullable<typeof assignments.data>[number] & { id: string }>[] = [
    { key: "projectId", header: "Project", render: (r) => (projects.data ?? []).find((p) => p.id === r.projectId)?.code ?? `#${r.projectId}` },
    { key: "developerName", header: "Developer" },
    { key: "role", header: "Role", render: (r) => <StatusPill tone="info" label={r.role} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <SmallButton tone="danger" onClick={() => window.confirm("Remove this developer from the project? Their tasks on it are released.") && end.mutateAsync({ projectId: r.projectId, developerId: r.developerId }).then(() => toast.success("Assignment ended.")).catch((e) => toast.error(e.message))}>
          End
        </SmallButton>
      ),
    },
  ];

  return (
    <>
      <Panel title="Active assignments">
        <DataTable columns={cols} rows={(assignments.data ?? []).map((a) => ({ ...a, id: `${a.projectId}-${a.developerId}` }))} emptyLabel="No developer is assigned to a project yet." />
      </Panel>
      <FormCard
        title="Assign a developer to a project"
        submitLabel="Assign"
        successMessage="Developer assigned and notified."
        fields={[
          { name: "projectId", label: "Project", type: "select", required: true, options: projectOptions },
          { name: "developerId", label: "Developer", type: "select", required: true, options: devOptions },
          { name: "assignmentRole", label: "Role", type: "select", required: true, initial: "contributor", options: ["lead", "contributor", "reviewer"].map((v) => ({ value: v, label: v })) },
        ]}
        onSubmit={(v) => assign.mutateAsync({ projectId: Number(v.projectId), developerId: Number(v.developerId), assignmentRole: v.assignmentRole as "lead" })}
      />
      <FormCard
        title="Replace a developer on a project"
        submitLabel="Replace developer"
        successMessage="Developer replaced. Unfinished tasks moved; finished work stays in the history."
        fields={[
          { name: "projectId", label: "Project", type: "select", required: true, options: projectOptions },
          { name: "outgoing", label: "Developer leaving", type: "select", required: true, options: devOptions, hint: "They lose the project and all its tasks at once." },
          { name: "incoming", label: "Developer taking over", type: "select", required: true, options: devOptions, hint: "Takes the same role and the unfinished tasks." },
          { name: "reason", label: "Reason", required: true, hint: "Kept in the assignment history." },
        ]}
        onSubmit={(v) => replace.mutateAsync({ projectId: Number(v.projectId), outgoingDeveloperId: Number(v.outgoing), incomingDeveloperId: Number(v.incoming), reason: v.reason })}
      />
      <ProjectHistory projects={projects.data ?? []} />
      <FormCard
        title="Create a developer project"
        submitLabel="Create project"
        fields={[
          { name: "code", label: "Code", required: true, placeholder: "PRJ-ALPHA", hint: "Upper case letters, digits, dashes." },
          { name: "name", label: "Name shown to developers", required: true, hint: "May differ from the client project name, for client privacy (SRS 15.10)." },
          { name: "track", label: "Track", type: "select", required: true, initial: "full-stack", options: ["backend", "frontend", "full-stack", "ai", "infra", "research"].map((v) => ({ value: v, label: v })) },
          { name: "brief", label: "Sanitised brief", type: "textarea", hint: "Never include the client name, contacts or financials." },
        ]}
        onSubmit={(v) => create.mutateAsync({ code: v.code, name: v.name, track: v.track as "full-stack", brief: v.brief || undefined })}
      />
    </>
  );
}

function Teams() {
  const utils = trpc.useUtils();
  const teams = trpc.adminOps.teams.useQuery();
  const devOptions = useDevOptions();
  const refresh = () => utils.adminOps.teams.invalidate();
  const create = trpc.adminOps.createTeam.useMutation({ onSuccess: refresh });
  const add = trpc.adminOps.addTeamMember.useMutation({ onSuccess: refresh });
  const remove = trpc.adminOps.removeTeamMember.useMutation({ onSuccess: refresh });
  const primary = trpc.adminOps.setTeamPrimaryContact.useMutation({ onSuccess: refresh });
  const archive = trpc.adminOps.setTeamArchived.useMutation({ onSuccess: refresh });
  const rows = teams.data ?? [];
  const teamOptions = rows.filter((t) => t.status === "active").map((t) => ({ value: String(t.id), label: t.name }));
  const fail = (e: { message: string }) => toast.error(e.message);
  return (
    <>
      <Panel title="Teams">
        {rows.length === 0 ? (
          <p className="text-sm text-white/55">No teams yet.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((t) => (
              <div key={t.id} className="rounded border border-white/10 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <StatusPill tone={t.status === "active" ? "ok" : "muted"} label={t.status} />
                  <span className="text-sm text-white/55">Primary contact: {t.primaryContactName ?? "none"}</span>
                  <span className="ml-auto">
                    <SmallButton onClick={() => archive.mutateAsync({ teamId: t.id, archived: t.status === "active" }).then(() => toast.success(t.status === "active" ? "Team archived." : "Team restored.")).catch(fail)}>{t.status === "active" ? "Archive" : "Restore"}</SmallButton>
                  </span>
                </div>
                {t.members.length === 0 ? (
                  <p className="text-sm text-white/55">No members.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {t.members.map((m) => (
                      <li key={m.developerId} className="flex flex-wrap items-center gap-2">
                        <span>{m.fullName}</span>
                        <StatusPill tone="info" label={m.role} />
                        {m.primaryContact ? <StatusPill tone="ok" label="primary contact" /> : t.status === "active" ? <SmallButton onClick={() => primary.mutateAsync({ teamId: t.id, developerId: m.developerId }).then(() => toast.success("Primary contact changed.")).catch(fail)}>Make primary contact</SmallButton> : null}
                        {t.status === "active" ? (
                          <SmallButton
                            tone="danger"
                            onClick={() => {
                              const successor = m.primaryContact && t.members.length > 1 ? t.members.find((o) => o.developerId !== m.developerId) : undefined;
                              if (m.primaryContact && successor && !window.confirm(`${successor.fullName} will become the primary contact. Continue?`)) return;
                              remove.mutateAsync({ teamId: t.id, developerId: m.developerId, successorId: successor?.developerId }).then(() => toast.success("Member removed.")).catch(fail);
                            }}
                          >
                            Remove
                          </SmallButton>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <FormCard
        title="Create a team"
        submitLabel="Create team"
        successMessage="Team created."
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "description", label: "Description", type: "textarea" },
        ]}
        onSubmit={(v) => create.mutateAsync({ name: v.name, description: v.description || undefined })}
      />
      <FormCard
        title="Add a developer to a team"
        submitLabel="Add"
        successMessage="Developer added and notified. The first member becomes the primary contact."
        fields={[
          { name: "teamId", label: "Team", type: "select", required: true, options: teamOptions },
          { name: "developerId", label: "Developer", type: "select", required: true, options: devOptions },
          { name: "role", label: "Role", type: "select", required: true, initial: "member", options: ["lead", "member", "reviewer"].map((v) => ({ value: v, label: v })) },
        ]}
        onSubmit={(v) => add.mutateAsync({ teamId: Number(v.teamId), developerId: Number(v.developerId), role: v.role as "member" })}
      />
    </>
  );
}

function Tasks() {
  const utils = trpc.useUtils();
  const projects = trpc.admin.developerProjects.useQuery();
  const tasks = trpc.admin.developerTasks.useQuery();
  const devOptions = useDevOptions();
  const createTask = trpc.admin.createDeveloperTask.useMutation({ onSuccess: () => utils.admin.developerTasks.invalidate() });
  const assignTask = trpc.admin.assignDeveloperTask.useMutation({ onSuccess: () => utils.admin.developerTasks.invalidate() });
  const moveTask = trpc.admin.reassignDeveloperTask.useMutation({ onSuccess: () => { utils.admin.developerTasks.invalidate(); utils.admin.projectAssignmentHistory.invalidate(); utils.admin.taskAssignmentHistory.invalidate(); } });
  const comment = trpc.adminOps.commentOnTask.useMutation();
  const cols: DataColumn<NonNullable<typeof tasks.data>[number]>[] = [
    { key: "id", header: "Ref", width: "64px", render: (r) => <span className="font-mono text-white/55">T-{r.id}</span> },
    { key: "projectCode", header: "Project" },
    { key: "title", header: "Task" },
    { key: "priority", header: "Priority" },
    { key: "status", header: "Status", render: (r) => <StatusPill tone={r.status === "done" ? "ok" : "info"} label={r.status} /> },
    { key: "assignees", header: "Assigned", render: (r) => (r.assignees.length ? r.assignees.join(", ") : <span className="text-white/40">nobody</span>) },
  ];
  return (
    <>
      <Panel title="Tasks">
        <DataTable columns={cols} rows={tasks.data ?? []} emptyLabel="No tasks yet." />
      </Panel>
      <FormCard
        title="Create a task"
        submitLabel="Create task"
        fields={[
          { name: "projectId", label: "Project", type: "select", required: true, options: (projects.data ?? []).map((p) => ({ value: String(p.id), label: `${p.code}: ${p.name}` })) },
          { name: "title", label: "Title", required: true },
          { name: "priority", label: "Priority", type: "select", required: true, initial: "normal", options: ["low", "normal", "high", "urgent"].map((v) => ({ value: v, label: v })) },
          { name: "body", label: "Details", type: "textarea" },
        ]}
        onSubmit={(v) => createTask.mutateAsync({ projectId: Number(v.projectId), title: v.title, priority: v.priority as "normal", body: v.body || undefined })}
      />
      <FormCard
        title="Assign a task"
        submitLabel="Assign task"
        successMessage="Task assigned."
        fields={[
          { name: "taskId", label: "Task", type: "select", required: true, options: (tasks.data ?? []).map((t) => ({ value: String(t.id), label: `T-${t.id} ${t.projectCode}: ${t.title}` })) },
          { name: "developerId", label: "Developer", type: "select", required: true, options: devOptions, hint: "The developer must already be on the task's project." },
        ]}
        onSubmit={(v) => assignTask.mutateAsync({ taskId: Number(v.taskId), developerId: Number(v.developerId) })}
      />
      <FormCard
        title="Move a task to another developer"
        submitLabel="Move task"
        successMessage="Task moved. Both developers were told and the move is in the history."
        fields={[
          { name: "taskId", label: "Task", type: "select", required: true, options: (tasks.data ?? []).filter((t) => t.status !== "done").map((t) => ({ value: String(t.id), label: `T-${t.id} ${t.projectCode}: ${t.title}` })), hint: "A finished task stays with the person who did it." },
          { name: "from", label: "Currently held by", type: "select", required: true, options: devOptions },
          { name: "to", label: "Move to", type: "select", required: true, options: devOptions, hint: "Must already be on the task's project." },
          { name: "reason", label: "Reason", required: true, hint: "Kept in the assignment history." },
        ]}
        onSubmit={(v) => moveTask.mutateAsync({ taskId: Number(v.taskId), fromDeveloperId: Number(v.from), toDeveloperId: Number(v.to), reason: v.reason })}
      />
      <FormCard
        title="Answer or comment on a task"
        submitLabel="Post comment"
        successMessage="Comment posted. The assigned developers can read it on the task."
        columns={1}
        fields={[
          { name: "taskId", label: "Task", type: "select", required: true, options: (tasks.data ?? []).map((t) => ({ value: String(t.id), label: `T-${t.id} ${t.projectCode}: ${t.title}` })) },
          { name: "body", label: "Comment", type: "textarea", required: true },
        ]}
        onSubmit={(v) => comment.mutateAsync({ taskId: Number(v.taskId), body: v.body })}
      />
    </>
  );
}

function TimeReview() {
  const utils = trpc.useUtils();
  const q = trpc.adminOps.timeEntries.useQuery({ status: "submitted" });
  const review = trpc.adminOps.reviewTimeEntry.useMutation({ onSuccess: () => utils.adminOps.timeEntries.invalidate() });
  const cols: DataColumn<NonNullable<typeof q.data>[number]>[] = [
    { key: "developerName", header: "Developer" },
    { key: "projectCode", header: "Project" },
    { key: "workDate", header: "Date" },
    { key: "minutes", header: "Time", align: "right", render: (r) => `${Math.floor(r.minutes / 60)}h ${r.minutes % 60}m` },
    { key: "note", header: "Note" },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-1">
          <SmallButton onClick={() => review.mutateAsync({ id: r.id, status: "approved" }).then(() => toast.success("Approved.")).catch((e) => toast.error(e.message))}>Approve</SmallButton>
          <SmallButton
            tone="danger"
            onClick={() => {
              const note = window.prompt("Why is this entry rejected?");
              if (note?.trim()) review.mutateAsync({ id: r.id, status: "rejected", note: note.trim() }).then(() => toast.success("Rejected.")).catch((e) => toast.error(e.message));
            }}
          >
            Reject
          </SmallButton>
        </div>
      ),
    },
  ];
  return (
    <Panel title="Time entries awaiting review">
      <DataTable columns={cols} rows={q.data ?? []} emptyLabel="No time entries are waiting for review." />
    </Panel>
  );
}

function Approvals() {
  const utils = trpc.useUtils();
  const pending = trpc.adminOps.pendingApprovals.useQuery();
  const request = trpc.adminOps.requestProjectApproval.useMutation({ onSuccess: () => utils.adminOps.pendingApprovals.invalidate() });
  const archive = trpc.adminOps.archiveProject.useMutation();
  const cols: DataColumn<NonNullable<typeof pending.data>[number]>[] = [
    { key: "projectName", header: "Project" },
    { key: "title", header: "Awaiting the customer's decision on" },
    { key: "createdAt", header: "Requested", render: (r) => shortDateTime(r.createdAt) },
  ];
  const lifecycles = trpc.adminOps.projectLifecycles.useQuery();
  const setStage = trpc.adminOps.setProjectLifecycle.useMutation({ onSuccess: () => { utils.adminOps.projectLifecycles.invalidate(); utils.adminOps.pendingApprovals.invalidate(); } });
  const stageRows = lifecycles.data ?? [];
  return (
    <>
      <Panel title="Customer project stages">
        <DataTable
          columns={[
            { key: "name", header: "Project" },
            { key: "lifecycle", header: "Stage", render: (r: (typeof stageRows)[number]) => r.lifecycle.replace(/_/g, " ") },
            { key: "next", header: "Can move to", render: (r: (typeof stageRows)[number]) => nextLifecycleStates(r.lifecycle).map((s) => s.replace(/_/g, " ")).join(", ") || "none" },
          ]}
          rows={stageRows}
          emptyLabel="No customer projects yet."
        />
      </Panel>
      <FormCard
        title="Move a customer project to its next stage"
        submitLabel="Move"
        fields={[
          { name: "projectId", label: "Project id", type: "number", required: true },
          { name: "to", label: "Stage", type: "select", required: true, options: PROJECT_LIFECYCLE.map((s) => ({ value: s, label: s.replace(/_/g, " ") })) },
          { name: "note", label: "Note" },
        ]}
        onSubmit={(v) => setStage.mutateAsync({ projectId: Number(v.projectId), to: v.to as (typeof PROJECT_LIFECYCLE)[number], note: v.note || undefined })}
      />
      <Panel title="Waiting for the customer">
        <DataTable columns={cols} rows={pending.data ?? []} emptyLabel="No approvals are waiting." />
      </Panel>
      <FormCard
        title="Ask the customer to approve"
        submitLabel="Request approval"
        successMessage="Approval requested. The customer sees it in their portal."
        fields={[
          { name: "projectId", label: "Client project id", type: "number", required: true },
          { name: "milestoneId", label: "Milestone id", type: "number", hint: "Optional. Must belong to that project." },
          { name: "title", label: "What needs approving", required: true },
          { name: "description", label: "Details", type: "textarea" },
        ]}
        onSubmit={(v) => request.mutateAsync({ projectId: Number(v.projectId), milestoneId: optInt(v.milestoneId), title: v.title, description: v.description || undefined })}
      />
      <FormCard
        title="Archive a completed project"
        submitLabel="Archive"
        successMessage="Project archived."
        columns={1}
        fields={[{ name: "projectId", label: "Client project id", type: "number", required: true, hint: "Only completed projects with no pending approvals can be archived." }]}
        onSubmit={(v) => archive.mutateAsync({ projectId: Number(v.projectId) })}
      />
    </>
  );
}

function Messages() {
  const devOptions = useDevOptions();
  const reply = trpc.admin.replyToDeveloper.useMutation();
  const teams = trpc.adminOps.teams.useQuery();
  const projects = trpc.admin.developerProjects.useQuery();
  const broadcast = trpc.adminOps.messageDevelopers.useMutation();
  const toClient = trpc.adminOps.relayDeveloperMessageToClient.useMutation();
  const toDeveloper = trpc.adminOps.relayClientMessageToDeveloper.useMutation();
  const log = trpc.adminOps.mediationLog.useQuery();
  const audienceOptions = [
    ...(teams.data ?? []).filter((t) => t.status === "active").map((t) => ({ value: `team:${t.id}`, label: `Team: ${t.name}` })),
    ...(projects.data ?? []).filter((p) => p.status !== "completed").map((p) => ({ value: `project:${p.id}`, label: `Everyone on project ${p.code}` })),
  ];
  return (
    <>
      <FormCard
        title="Message a developer"
        submitLabel="Send"
        successMessage="Message sent. The developer is notified."
        columns={1}
        fields={[
          { name: "developerId", label: "Developer", type: "select", required: true, options: devOptions },
          { name: "subject", label: "Subject" },
          { name: "body", label: "Message", type: "textarea", required: true },
        ]}
        onSubmit={(v) => reply.mutateAsync({ developerId: Number(v.developerId), subject: v.subject || undefined, body: v.body })}
      />
      <FormCard
        title="Message a team or a project"
        submitLabel="Send to everyone"
        successMessage="Sent. Each developer received it in their own thread; none can see who else did."
        columns={1}
        fields={[
          { name: "audience", label: "Audience", type: "select", required: true, options: audienceOptions },
          { name: "subject", label: "Subject" },
          { name: "body", label: "Message", type: "textarea", required: true },
        ]}
        onSubmit={(v) => {
          const [type, id] = v.audience.split(":");
          return broadcast.mutateAsync({ audience: { type: type as "team", id: Number(id) }, subject: v.subject || undefined, body: v.body });
        }}
      />
      <FormCard
        title="Pass a developer's point on to a client"
        submitLabel="Send to the client"
        successMessage="Sent to the client as IO SKY. The developer is not named."
        columns={1}
        fields={[
          { name: "developerMessageId", label: "Developer message id", type: "number", required: true, hint: "The message you are answering or passing on." },
          { name: "organizationId", label: "Client organization id", type: "number", required: true, hint: "The developer must work on this client's project." },
          { name: "subject", label: "Subject" },
          { name: "body", label: "Message to the client", type: "textarea", required: true, hint: "You write this. It is refused if it names the developer, their email or their phone." },
        ]}
        onSubmit={(v) => toClient.mutateAsync({ developerMessageId: Number(v.developerMessageId), organizationId: Number(v.organizationId), subject: v.subject || undefined, body: v.body })}
      />
      <FormCard
        title="Pass a client's point on to a developer"
        submitLabel="Send to the developer"
        successMessage="Sent to the developer as IO SKY. The client is not named."
        columns={1}
        fields={[
          { name: "clientMessageId", label: "Client message id", type: "number", required: true },
          { name: "developerId", label: "Developer", type: "select", required: true, options: devOptions, hint: "Must work on this client's project." },
          { name: "subject", label: "Subject" },
          { name: "body", label: "Message to the developer", type: "textarea", required: true, hint: "Refused if it names the client's company or contact." },
        ]}
        onSubmit={(v) => toDeveloper.mutateAsync({ clientMessageId: Number(v.clientMessageId), developerId: Number(v.developerId), subject: v.subject || undefined, body: v.body })}
      />
      <Panel title="Mediation log (who sent what to whom, never the text)">
        <DataTable
          columns={[
            { key: "createdAt", header: "When", render: (r: NonNullable<typeof log.data>[number]) => shortDateTime(r.createdAt) },
            { key: "kind", header: "Kind", render: (r: NonNullable<typeof log.data>[number]) => r.kind.replace(/_/g, " ") },
            { key: "recipientCount", header: "Recipients", align: "right" },
            { key: "actorUserId", header: "By", render: (r: NonNullable<typeof log.data>[number]) => (r.actorUserId ? `user #${r.actorUserId}` : "system") },
          ]}
          rows={log.data ?? []}
          emptyLabel="Nothing has been relayed or broadcast yet."
        />
      </Panel>
    </>
  );
}
