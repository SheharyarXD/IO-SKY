/**
 * Milestone 3 §3.4 (RM-99) — frontend coverage: Notification Center.
 *
 * This component is the visible half of Milestone 2 §2.7. Before that work the
 * bell rendered an unread badge from real data but had no onClick at all —
 * clicking it did nothing. That is exactly the class of defect the Milestone 2
 * exit gate ("no UI element claims a capability that isn't real") was written
 * to prevent, so the behaviour deserves a regression test rather than trust.
 *
 * The component is fully props-driven, so no tRPC stubbing is needed — the
 * callbacks are the contract, and asserting on them is what proves the
 * buttons are wired.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../test/renderWithProviders";
import { NotificationBell, type NotificationItem } from "./NotificationBell";

const onMarkRead = vi.fn();
const onArchive = vi.fn();

function items(overrides: Partial<NotificationItem>[] = []): NotificationItem[] {
  const base: NotificationItem[] = [
    {
      id: 1,
      kind: "invoice",
      title: "Invoice INV-001 is due",
      body: "Payment is due in three days.",
      readAt: null,
      createdAt: new Date("2026-08-01T10:00:00Z"),
      priority: "high",
    },
    {
      id: 2,
      kind: "message",
      title: "New message from your project lead",
      readAt: "2026-08-02T09:00:00Z",
      createdAt: new Date("2026-08-02T08:00:00Z"),
      priority: "normal",
    },
  ];
  return base.map((b, i) => ({ ...b, ...(overrides[i] ?? {}) }));
}

/** Radix opens its menu on pointerdown, not click. */
async function openBell() {
  const trigger = screen.getByRole("button", { name: /notifications/i });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByText("Notifications")).toBeInTheDocument());
}

beforeEach(() => {
  onMarkRead.mockClear();
  onArchive.mockClear();
});

describe("RM-99: unread badge", () => {
  it("shows the unread count", () => {
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    // One of the two fixtures is unread.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("counts a notification with an undefined readAt as unread", () => {
    // The API returns `readAt: null`, but a locally-constructed item may omit
    // the field entirely. Both must count as unread or the badge undercounts.
    const list = items([{ readAt: undefined }, { readAt: undefined }]);
    renderWithProviders(
      <NotificationBell notifications={list} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("hides the badge entirely when everything is read", () => {
    const list = items([{ readAt: "2026-08-02T09:00:00Z" }]);
    renderWithProviders(
      <NotificationBell notifications={list} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("stays accessible by name", () => {
    renderWithProviders(
      <NotificationBell notifications={[]} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });
});

describe("RM-99: dropdown behaviour", () => {
  it("opens on click and lists the notifications", async () => {
    // The regression guard for the original defect: the bell must actually
    // open something.
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    expect(screen.getByText("Invoice INV-001 is due")).toBeInTheDocument();
    expect(screen.getByText("New message from your project lead")).toBeInTheDocument();
  });

  it("renders the notification body when present", async () => {
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    expect(screen.getByText("Payment is due in three days.")).toBeInTheDocument();
  });

  it("shows an empty state rather than a blank panel", async () => {
    renderWithProviders(
      <NotificationBell notifications={[]} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument();
  });
});

describe("RM-99: mark-as-read and archive are wired", () => {
  it("marks a single notification read", async () => {
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    fireEvent.click(screen.getByTitle("Mark read"));
    expect(onMarkRead).toHaveBeenCalledWith(1);
  });

  it("offers mark-read only on unread items", async () => {
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    // Two notifications, one already read — so exactly one check button.
    expect(screen.getAllByTitle("Mark read")).toHaveLength(1);
    expect(screen.getAllByTitle("Dismiss")).toHaveLength(2);
  });

  it("marks every unread item read from the header action", async () => {
    const list = items([{ readAt: null }, { readAt: null }]);
    renderWithProviders(
      <NotificationBell notifications={list} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    fireEvent.click(screen.getByText("Mark all read"));
    expect(onMarkRead).toHaveBeenCalledTimes(2);
    expect(onMarkRead).toHaveBeenCalledWith(1);
    expect(onMarkRead).toHaveBeenCalledWith(2);
  });

  it("hides 'Mark all read' when nothing is unread", async () => {
    const list = items([{ readAt: "2026-08-02T09:00:00Z" }]);
    renderWithProviders(
      <NotificationBell notifications={list} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
  });

  it("archives a notification", async () => {
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    fireEvent.click(screen.getAllByTitle("Dismiss")[0]);
    expect(onArchive).toHaveBeenCalledWith(1);
  });

  it("does not mark read when archiving", async () => {
    // The two buttons sit next to each other and both stopPropagation; a
    // regression in either handler would show up as a cross-fire here.
    renderWithProviders(
      <NotificationBell notifications={items()} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    fireEvent.click(screen.getAllByTitle("Dismiss")[0]);
    expect(onMarkRead).not.toHaveBeenCalled();
  });
});

describe("RM-99: priority indicator", () => {
  it("falls back to the normal dot for an unrecognised priority", async () => {
    // Priority arrives from the database as a plain string, so an unknown
    // value must not render an undefined class and lose the dot entirely.
    const list = items([{ priority: "not-a-real-priority" }]);
    renderWithProviders(
      <NotificationBell notifications={list} onMarkRead={onMarkRead} onArchive={onArchive} />,
    );
    await openBell();
    const dots = document.querySelectorAll("span.rounded-full.shrink-0");
    expect(dots.length).toBeGreaterThan(0);
    expect(Array.from(dots).some((d) => d.className.includes("bg-white/30"))).toBe(true);
  });
});
