/*
 * IO SKY — Admin Portal · Delivery (SRS 11, 12, 15).
 *
 * Developer projects and assignments (BR-018), tasks, time review, customer
 * approval gates (BR-019), project archiving and messages to developers.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import OperationalPage, { DataTable, StatusPill, type DataColumn } from "./_shared/OperationalPage";
import { FormCard, Panel, SmallButton, TabBar, shortDateTime } from "./_shared/Forms";

type Tab = "assign" | "tasks" | "time" | "approvals" | "messages";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "assign", label: "Projects & assignment" },
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

function Assign() {
  const utils = trpc.useUtils();
  const projects = trpc.admin.developerProjects.useQuery();
  const assignments = trpc.admin.developerAssignments.useQuery();
  const devOptions = useDevOptions();
  const create = trpc.admin.createDeveloperProject.useMutation({ onSuccess: () => utils.admin.developerProjects.invalidate() });
  const assign = trpc.admin.assignDeveloperToProject.useMutation({ onSuccess: () => utils.admin.developerAssignments.invalidate() });
  const end = trpc.admin.endDeveloperAssignment.useMutation({ onSuccess: () => utils.admin.developerAssignments.invalidate() });
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

function Tasks() {
  const utils = trpc.useUtils();
  const projects = trpc.admin.developerProjects.useQuery();
  const tasks = trpc.admin.developerTasks.useQuery();
  const devOptions = useDevOptions();
  const createTask = trpc.admin.createDeveloperTask.useMutation({ onSuccess: () => utils.admin.developerTasks.invalidate() });
  const assignTask = trpc.admin.assignDeveloperTask.useMutation({ onSuccess: () => utils.admin.developerTasks.invalidate() });
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
  return (
    <>
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
  return (
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
  );
}
