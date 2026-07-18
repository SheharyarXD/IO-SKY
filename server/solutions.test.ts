/**
 * Tests for the Solutions ecosystem tRPC router (Package 7).
 *
 * Covers:
 *   • recordClick — public, never throws on db unavailability
 *   • requestProposal — creates lead + proposal row + notifies owner
 *   • startDiscovery — returns a token and seeds a session
 *   • saveDiscoveryStep — partial autosave is idempotent
 *   • submitDiscovery — requires name+email, marks status, fires lead
 *
 * Uses a fully mocked db layer so the tests stay deterministic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => {
  const state: {
    clicks: Array<Record<string, unknown>>;
    leads: Array<Record<string, unknown>>;
    proposals: Array<Record<string, unknown>>;
    sessions: Map<string, Record<string, unknown>>;
  } = {
    clicks: [],
    leads: [],
    proposals: [],
    sessions: new Map(),
  };

  return {
    __state: state,
    recordEcosystemClick: vi.fn(async (input: Record<string, unknown>) => {
      state.clicks.push(input);
      return { id: state.clicks.length, ...input };
    }),
    createLead: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: state.leads.length + 1, ...input };
      state.leads.push(row);
      return row;
    }),
    createEcosystemProposalRequest: vi.fn(async (input: Record<string, unknown>) => {
      const row = { id: state.proposals.length + 1, ...input };
      state.proposals.push(row);
      return row;
    }),
    getCustomDiscoveryByToken: vi.fn(async (token: string) => {
      return state.sessions.get(token) ?? null;
    }),
    upsertCustomDiscoverySession: vi.fn(
      async (token: string, patch: Record<string, unknown>) => {
        const prev = state.sessions.get(token) ?? { token, status: "in_progress" };
        const merged = { ...prev, ...patch, token };
        state.sessions.set(token, merged);
        return merged;
      },
    ),
    listRecentEcosystemClicks: vi.fn(async () => state.clicks),
    listEcosystemProposalRequests: vi.fn(async () => state.proposals),
    listCustomDiscoverySessions: vi.fn(async () =>
      Array.from(state.sessions.values()),
    ),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(async () => true),
}));

// We need to import after vi.mock has been registered.
import { solutionsRouter } from "./routers/solutions";
import * as dbMock from "./db";
import { notifyOwner } from "./_core/notification";

// Minimal context — matches what the public/protected procedures need.
function makeCtx(role: "admin" | "user" | null = null) {
  return {
    req: {
      headers: { "user-agent": "vitest", "x-forwarded-for": "1.2.3.4" },
      socket: { remoteAddress: "127.0.0.1" },
    } as unknown as Express.Request,
    res: {} as unknown as Express.Response,
    user: role
      ? { id: 1, openId: "vitest", name: "vitest", role }
      : null,
    impersonation: null,
  };
}

describe("solutionsRouter.recordClick", () => {
  beforeEach(() => {
    // reset internal state between tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.clicks.length = 0;
    st.leads.length = 0;
    st.proposals.length = 0;
    st.sessions.clear();
    vi.mocked(notifyOwner).mockClear();
  });

  it("records a click without throwing", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());
    const r = await caller.recordClick({
      eventKey: "solutions_page_view",
      source: "solutions",
    });
    expect(r).toEqual({ ok: true });
    expect(vi.mocked(dbMock.recordEcosystemClick)).toHaveBeenCalledOnce();
  });

  it("swallows DB errors instead of breaking UX", async () => {
    vi.mocked(dbMock.recordEcosystemClick).mockRejectedValueOnce(
      new Error("db down"),
    );
    const caller = solutionsRouter.createCaller(makeCtx());
    await expect(
      caller.recordClick({ eventKey: "xxx", source: "solutions" }),
    ).resolves.toEqual({ ok: true });
  });
});

describe("solutionsRouter.requestProposal", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.clicks.length = 0;
    st.leads.length = 0;
    st.proposals.length = 0;
    st.sessions.clear();
    vi.mocked(notifyOwner).mockClear();
  });

  it("creates lead + proposal + notifies owner", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());
    const r = await caller.requestProposal({
      ecosystem: "growth",
      fullName: "Alice Test",
      email: "alice@example.com",
      company: "Acme",
    });
    expect(r.ok).toBe(true);
    expect(typeof r.proposalId).toBe("number");
    expect(vi.mocked(dbMock.createLead)).toHaveBeenCalledOnce();
    expect(vi.mocked(dbMock.createEcosystemProposalRequest)).toHaveBeenCalledOnce();
    // notification is fire-and-forget; allow one tick
    await new Promise((res) => setImmediate(res));
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it("rejects invalid email", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());
    await expect(
      caller.requestProposal({
        ecosystem: "elite",
        fullName: "Bob",
        email: "not-an-email",
      } as unknown as Parameters<typeof caller.requestProposal>[0]),
    ).rejects.toThrow();
  });
});

describe("solutionsRouter.startDiscovery + saveDiscoveryStep + submitDiscovery", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.clicks.length = 0;
    st.leads.length = 0;
    st.proposals.length = 0;
    st.sessions.clear();
    vi.mocked(notifyOwner).mockClear();
    vi.mocked(dbMock.createLead).mockClear();
    vi.mocked(dbMock.upsertCustomDiscoverySession).mockClear();
  });

  it("issues a token, persists progressive saves, and finalizes submission", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());

    // 1. start
    const started = await caller.startDiscovery({});
    expect(started.token).toMatch(/^[a-z0-9]{8,}$/);

    // 2. resume yields the same row
    const resumed = await caller.startDiscovery({ token: started.token });
    expect(resumed.token).toBe(started.token);

    // 3. save partial
    await caller.saveDiscoveryStep({
      token: started.token,
      patch: { fullName: "Carol", email: "carol@example.com" },
    });
    expect(vi.mocked(dbMock.upsertCustomDiscoverySession)).toHaveBeenCalled();

    // 4. submit
    const r = await caller.submitDiscovery({ token: started.token });
    expect(r.ok).toBe(true);
    expect(vi.mocked(dbMock.createLead)).toHaveBeenCalledOnce();
    await new Promise((res) => setImmediate(res));
    expect(notifyOwner).toHaveBeenCalledOnce();
  });

  it("blocks submission without name+email", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());
    const started = await caller.startDiscovery({});
    await expect(
      caller.submitDiscovery({ token: started.token }),
    ).rejects.toThrow(/name and email/i);
  });

  it("rejects unknown discovery token", async () => {
    const caller = solutionsRouter.createCaller(makeCtx());
    await expect(
      caller.submitDiscovery({ token: "doesnotexist" }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("solutionsRouter admin listings", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (dbMock as any).__state;
    st.clicks.length = 0;
    st.leads.length = 0;
    st.proposals.length = 0;
    st.sessions.clear();
  });

  it("requires admin role", async () => {
    const userCaller = solutionsRouter.createCaller(makeCtx("user"));
    await expect(userCaller.adminListClicks({ limit: 50 })).rejects.toThrow();
    await expect(userCaller.adminListProposals({ limit: 50 })).rejects.toThrow();
    await expect(userCaller.adminListDiscoveries({ limit: 50 })).rejects.toThrow();
  });

  it("admins can list", async () => {
    const adminCaller = solutionsRouter.createCaller(makeCtx("admin"));
    await expect(adminCaller.adminListClicks({ limit: 50 })).resolves.toEqual([]);
    await expect(adminCaller.adminListProposals({ limit: 50 })).resolves.toEqual([]);
    await expect(adminCaller.adminListDiscoveries({ limit: 50 })).resolves.toEqual([]);
  });
});
