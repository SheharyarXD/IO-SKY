/**
 * Milestone 3 §3.4 (RM-100) — frontend coverage: converted admin workflows.
 *
 * Rather than 19 near-identical per-module test files, this covers the two
 * primitives every converted admin surface renders through:
 *
 *   ModuleStateBoundary — the loading / error / forbidden / empty / data
 *     state machine used by all 19 modules.
 *   DataTable / StatusPill — how those modules present their rows.
 *
 * That is where the Milestone 2 §2.4 conversion work actually landed. The
 * audit's finding was not "this table renders wrong", it was that modules
 * displayed fabricated data or claimed capabilities with nothing behind them.
 * The boundary is what replaced that: a module with no data now says so
 * explicitly, and a module the user may not see says *that* explicitly rather
 * than rendering an empty shell that looks like "no data".
 *
 * Those two cases are easy to conflate and important not to — "you have no
 * invoices" and "you are not allowed to see invoices" must never look the
 * same to an admin. Several tests below exist specifically to pin that apart.
 */
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../../../../test/renderWithProviders";
import { ModuleStateBoundary } from "./ModuleState";
import { DataTable, StatusPill, type DataColumn } from "./OperationalPage";

describe("RM-100: ModuleStateBoundary state machine", () => {
  it("shows a loading state while the query is in flight", () => {
    renderWithProviders(
      <ModuleStateBoundary isLoading error={null} data={undefined}>
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText("never rendered")).not.toBeInTheDocument();
  });

  it("renders the happy path when data arrives", () => {
    renderWithProviders(
      <ModuleStateBoundary isLoading={false} error={null} data={{ count: 3 }}>
        {(d) => <div>rows: {d.count}</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText("rows: 3")).toBeInTheDocument();
  });

  it("distinguishes 'permission denied' from 'no data'", () => {
    // The distinction that matters: an admin denied a module must be told
    // that, not shown an empty surface implying the data does not exist.
    renderWithProviders(
      <ModuleStateBoundary
        isLoading={false}
        error={{ message: "nope", data: { code: "FORBIDDEN" } }}
        data={undefined}
      >
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument();
  });

  it("treats UNAUTHORIZED the same as FORBIDDEN", () => {
    renderWithProviders(
      <ModuleStateBoundary
        isLoading={false}
        error={{ message: "nope", data: { code: "UNAUTHORIZED" } }}
        data={undefined}
      >
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
  });

  it("surfaces a genuine failure as an alert, not as an empty state", () => {
    // A failed load must never be silently indistinguishable from "no data" —
    // that is how a broken module looks healthy on a dashboard.
    renderWithProviders(
      <ModuleStateBoundary
        isLoading={false}
        error={{ message: "connection reset by peer" }}
        data={undefined}
      >
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/could not load this module/i)).toBeInTheDocument();
    expect(screen.getByText(/connection reset by peer/i)).toBeInTheDocument();
  });

  it("falls back to a generic message when the error carries none", () => {
    renderWithProviders(
      <ModuleStateBoundary isLoading={false} error={{ message: "" }} data={undefined}>
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });

  it("offers retry only when a retry handler was supplied", () => {
    const onRetry = vi.fn();
    const { unmount } = renderWithProviders(
      <ModuleStateBoundary
        isLoading={false}
        error={{ message: "boom" }}
        data={undefined}
        onRetry={onRetry}
      >
        {() => null}
      </ModuleStateBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();

    renderWithProviders(
      <ModuleStateBoundary isLoading={false} error={{ message: "boom" }} data={undefined}>
        {() => null}
      </ModuleStateBoundary>,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows the connected-but-empty state when isEmpty reports true", () => {
    renderWithProviders(
      <ModuleStateBoundary
        isLoading={false}
        error={null}
        data={{ rows: [] as string[] }}
        isEmpty={(d) => d.rows.length === 0}
      >
        {() => <div>never rendered</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it("renders nothing at all when data is undefined and there is no error", () => {
    // Guards the ordering of the checks: an undefined payload must not fall
    // through into children() and crash on a property access.
    const { container } = renderWithProviders(
      <ModuleStateBoundary isLoading={false} error={null} data={undefined}>
        {(d: { count: number }) => <div>rows: {d.count}</div>}
      </ModuleStateBoundary>,
    );
    expect(container.textContent).toBe("");
  });

  it("does not treat a present-but-falsy payload as missing", () => {
    // `data === undefined` rather than `!data`: a module whose payload is 0
    // or "" is loaded, not absent.
    renderWithProviders(
      <ModuleStateBoundary isLoading={false} error={null} data={0}>
        {(d) => <div>value {String(d)}</div>}
      </ModuleStateBoundary>,
    );
    expect(screen.getByText("value 0")).toBeInTheDocument();
  });
});

interface Row {
  id: number;
  name: string;
  amount: number;
}

const columns: DataColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "amount", header: "Amount", align: "right" },
];

describe("RM-100: DataTable", () => {
  it("renders headers and rows", () => {
    renderWithProviders(
      <DataTable
        columns={columns}
        rows={[
          { id: 1, name: "Acme BV", amount: 1200 },
          { id: 2, name: "Globex NV", amount: 800 },
        ]}
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Acme BV")).toBeInTheDocument();
    expect(screen.getByText("Globex NV")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("shows an explicit empty label instead of a bare table shell", () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} />);
    expect(screen.getByText("No records yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("honours a caller-supplied empty label", () => {
    renderWithProviders(
      <DataTable columns={columns} rows={[]} emptyLabel="No invoices in this period." />,
    );
    expect(screen.getByText("No invoices in this period.")).toBeInTheDocument();
  });

  it("uses a custom cell renderer when one is provided", () => {
    renderWithProviders(
      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "amount", header: "Amount", render: (r) => <b>EUR {r.amount}</b> },
        ]}
        rows={[{ id: 1, name: "Acme BV", amount: 1200 }]}
      />,
    );
    expect(screen.getByText("EUR 1200")).toBeInTheDocument();
  });
});

describe("RM-100: StatusPill", () => {
  it("renders each tone with its label", () => {
    const tones = ["ok", "warn", "err", "info", "muted"] as const;
    for (const tone of tones) {
      const { unmount } = renderWithProviders(<StatusPill tone={tone} label={tone} />);
      expect(screen.getByText(tone)).toBeInTheDocument();
      unmount();
    }
  });

  it("visually separates a failure tone from a success tone", () => {
    // Status is the at-a-glance signal on every admin table; ok and err
    // resolving to the same class would make a failing row look healthy.
    const { container: okBox, unmount } = renderWithProviders(
      <StatusPill tone="ok" label="Paid" />,
    );
    const okClass = okBox.querySelector("span")!.className;
    unmount();

    const { container: errBox } = renderWithProviders(<StatusPill tone="err" label="Failed" />);
    const errClass = errBox.querySelector("span")!.className;

    expect(okClass).not.toBe(errClass);
  });
});
