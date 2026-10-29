/*
 * G02 (SRS 19.17, 19.18, 19.20; 29 Oct Doc 1 ACC-36): the AI Agent Registry
 * carries the minimum fields, validates them, reports what is still missing,
 * and never lets an update silently blank a field it did not mention.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTHORITY_LEVELS,
  KNOWLEDGE_SOURCES,
  missingRegistryFields,
  parseStringList,
  validateRegistryFields,
  type RegistryRowLike,
} from "../shared/aiAgentRegistry";

const complete: RegistryRowLike = {
  key: "ai_scan_analyst", name: "AI Scan analyst", purpose: "Drafts reports", businessFunction: "AI Scan report drafting", supportedModules: ["ai_scan"],
  capabilities: ["draft_scan_report"], permissions: ["generate_scan_report"], escalationRules: "Held for expert review", responsibleAdminUserId: 3, activePromptVersion: 1, status: "active",
};

describe("validateRegistryFields", () => {
  it("accepts a well formed entry and an empty one (every field is optional)", () => {
    expect(validateRegistryFields({})).toEqual({ ok: true });
    expect(validateRegistryFields({ businessFunction: "Support", supportedModules: ["crm", "support"], tools: ["search_documents"], knowledgeSources: ["business_rules"], maxAuthority: "draft_only", requiresHumanApproval: true, responsibleAdminUserId: 4 })).toEqual({ ok: true });
  });

  it("only the SRS 19.20 knowledge sources are accepted, and each once", () => {
    expect(KNOWLEDGE_SOURCES).toContain("ai_scan_reports");
    expect(validateRegistryFields({ knowledgeSources: ["made_up_source"] })).toMatchObject({ ok: false });
    expect(validateRegistryFields({ knowledgeSources: ["business_rules", "business_rules"] })).toMatchObject({ ok: false });
  });

  it("modules, tools and capabilities must be clean identifiers, without duplicates, within limits", () => {
    for (const bad of [["Has Space"], ["UPPER"], ["1starts_digit"], ["a"], ["x".repeat(70)], ["ok_one", "ok_one"]]) {
      expect(validateRegistryFields({ tools: bad }), JSON.stringify(bad)).toMatchObject({ ok: false });
    }
    expect(validateRegistryFields({ supportedModules: Array.from({ length: 31 }, (_, i) => `module_${i}`) })).toMatchObject({ ok: false });
  });

  it("maximum authority must be a known level, and the least is the safe default to choose", () => {
    for (const lvl of AUTHORITY_LEVELS) expect(validateRegistryFields({ maxAuthority: lvl })).toEqual({ ok: true });
    expect(validateRegistryFields({ maxAuthority: "root" })).toMatchObject({ ok: false });
  });

  it("an agent that needs human approval cannot also have autonomous authority", () => {
    const r = validateRegistryFields({ maxAuthority: "act_autonomously", requiresHumanApproval: true });
    expect(r).toMatchObject({ ok: false });
    expect((r as { errors: string[] }).errors.join(" ")).toMatch(/cannot have autonomous authority/);
    expect(validateRegistryFields({ maxAuthority: "act_autonomously", requiresHumanApproval: false })).toEqual({ ok: true });
    expect(validateRegistryFields({ maxAuthority: "act_with_approval", requiresHumanApproval: true })).toEqual({ ok: true });
  });

  it("length limits and the responsible admin id are checked", () => {
    expect(validateRegistryFields({ businessFunction: "x".repeat(161) })).toMatchObject({ ok: false });
    expect(validateRegistryFields({ escalationRules: "x".repeat(2001) })).toMatchObject({ ok: false });
    expect(validateRegistryFields({ responsibleAdminUserId: 0 })).toMatchObject({ ok: false });
    expect(validateRegistryFields({ responsibleAdminUserId: 1.5 })).toMatchObject({ ok: false });
    expect(validateRegistryFields({ responsibleAdminUserId: null })).toEqual({ ok: true });
  });
});

describe("missingRegistryFields", () => {
  it("is empty for a complete entry", () => {
    expect(missingRegistryFields(complete)).toEqual([]);
  });

  it("lists exactly what is still empty, and empty tools or knowledge sources are not 'missing'", () => {
    const m = missingRegistryFields({ ...complete, businessFunction: "  ", supportedModules: [], escalationRules: null, responsibleAdminUserId: null, activePromptVersion: null });
    expect(m).toEqual(["business function", "supported modules", "escalation rules", "responsible admin", "active prompt (version information)"]);
  });

  it("an agent with nothing filled in reports every minimum field", () => {
    const blank: RegistryRowLike = { key: "x", name: "X", purpose: null, businessFunction: null, supportedModules: [], capabilities: [], permissions: [], escalationRules: null, responsibleAdminUserId: null, activePromptVersion: null, status: "active" };
    expect(missingRegistryFields(blank)).toHaveLength(8);
  });
});

describe("parseStringList", () => {
  it("reads a JSON list of strings and treats anything else as empty", () => {
    expect(parseStringList('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStringList('["a",1,null,"b"]')).toEqual(["a", "b"]);
    for (const bad of ["{}", "nope", "", null, undefined, "42"]) expect(parseStringList(bad as never)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Data layer, with a fake query builder (logic only; the SQL is not run)
// ---------------------------------------------------------------------------

const m = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/connection", () => ({ getDb: m.getDb }));

import { aiAgents, aiPromptVersions, users } from "../drizzle/schema";
import { listAiAgents, upsertAiAgent } from "./db/srsGovernance";

function fakeDb(tables: Map<unknown, unknown[]>) {
  const captured: Array<{ values: Record<string, unknown>; set: Record<string, unknown> }> = [];
  return {
    captured,
    db: {
      select: () => {
        let t: unknown;
        const chain: Record<string, unknown> = {
          from: (tb: unknown) => ((t = tb), chain),
          where: () => chain,
          orderBy: () => chain,
          limit: () => chain,
          then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(tables.get(t) ?? []).then(res, rej),
        };
        return chain;
      },
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: (o: { set: Record<string, unknown> }) => ({
            returning: async () => {
              captured.push({ values, set: o.set });
              return [{ id: 1, key: values.key, status: values.status, registryVersion: 2, ...values }];
            },
          }),
        }),
      }),
    },
  };
}

const base = { key: "support_scribe", name: "Support scribe", purpose: null, permissions: ["draft_reply"], requiresHumanApproval: true, status: "active" as const };
beforeEach(() => vi.clearAllMocks());

describe("upsertAiAgent keeps what it was not told to change", () => {
  it("omitting the registry fields leaves them out of the write entirely, so an older caller cannot blank them", async () => {
    const f = fakeDb(new Map());
    m.getDb.mockResolvedValue(f.db);
    await upsertAiAgent(base);
    const { values, set } = f.captured[0];
    for (const col of ["businessFunction", "capabilitiesJson", "supportedModulesJson", "toolsJson", "knowledgeSourcesJson", "escalationRules", "maxAuthority", "responsibleAdminUserId"]) {
      expect(values, col).not.toHaveProperty(col);
      expect(set, col).not.toHaveProperty(col);
    }
  });

  it("supplied fields are written, lists are de-duplicated and stored as JSON, and every upsert bumps the registry version", async () => {
    const f = fakeDb(new Map());
    m.getDb.mockResolvedValue(f.db);
    await upsertAiAgent({ ...base, businessFunction: "Support", supportedModules: ["crm", "crm", "support"], tools: [], knowledgeSources: ["business_rules"], maxAuthority: "draft_only", escalationRules: "Hand over to Support lead" });
    const { values, set } = f.captured[0];
    expect(values).toMatchObject({ businessFunction: "Support", supportedModulesJson: '["crm","support"]', toolsJson: "[]", knowledgeSourcesJson: '["business_rules"]', maxAuthority: "draft_only", escalationRules: "Hand over to Support lead" });
    expect(set).toHaveProperty("registryVersion"); // sql`registryVersion + 1`
    expect(set).toMatchObject({ supportedModulesJson: '["crm","support"]' });
  });

  it("a responsible admin must exist and be an admin or super admin", async () => {
    for (const rows of [[], [{ role: "client" }], [{ role: "developer" }], [{ role: "technical_operator" }]]) {
      const f = fakeDb(new Map([[users, rows]]));
      m.getDb.mockResolvedValue(f.db);
      expect(await upsertAiAgent({ ...base, responsibleAdminUserId: 9 })).toBe("invalid_responsible_admin");
      expect(f.captured).toHaveLength(0); // nothing written
    }
    const ok = fakeDb(new Map([[users, [{ role: "admin" }]]]));
    m.getDb.mockResolvedValue(ok.db);
    expect(await upsertAiAgent({ ...base, responsibleAdminUserId: 9 })).toMatchObject({ key: "support_scribe" });
    expect(ok.captured[0].values).toMatchObject({ responsibleAdminUserId: 9 });
  });

  it("clearing the responsible admin (null) is allowed and writes null", async () => {
    const f = fakeDb(new Map());
    m.getDb.mockResolvedValue(f.db);
    await upsertAiAgent({ ...base, responsibleAdminUserId: null });
    expect(f.captured[0].values).toMatchObject({ responsibleAdminUserId: null });
  });

  it("without a database nothing is written", async () => {
    m.getDb.mockResolvedValue(null);
    expect(await upsertAiAgent(base)).toBeNull();
  });
});

describe("listAiAgents", () => {
  const row = (over: Record<string, unknown>) => ({
    id: 1, key: "a", name: "A", purpose: "p", status: "active", permissionsJson: '["do_it"]', requiresHumanApproval: true, businessFunction: "F", capabilitiesJson: '["c"]',
    supportedModulesJson: '["m"]', toolsJson: "[]", knowledgeSourcesJson: "[]", escalationRules: "e", maxAuthority: "draft_only", responsibleAdminUserId: 5, registryVersion: 3,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  });

  it("returns parsed lists, the responsible admin, the active prompt version and what is missing", async () => {
    const f = fakeDb(new Map<unknown, unknown[]>([
      [aiAgents, [row({}), row({ id: 2, key: "b", businessFunction: null, supportedModulesJson: "[]", responsibleAdminUserId: null })]],
      [aiPromptVersions, [{ agentKey: "a", version: 2 }]],
      [users, [{ id: 5, name: "Ada", email: "ada@example.com" }]],
    ]));
    m.getDb.mockResolvedValue(f.db);
    const [a, b] = await listAiAgents();
    expect(a).toMatchObject({ permissions: ["do_it"], capabilities: ["c"], supportedModules: ["m"], tools: [], activePromptVersion: 2, responsibleAdmin: { id: 5, name: "Ada" }, registryVersion: 3, missingFields: [] });
    expect(a).not.toHaveProperty("permissionsJson");
    expect(b.missingFields).toEqual(expect.arrayContaining(["business function", "supported modules", "responsible admin", "active prompt (version information)"]));
    expect(b.responsibleAdmin).toBeNull();
  });

  it("a corrupt stored list becomes an empty list instead of an error", async () => {
    const f = fakeDb(new Map<unknown, unknown[]>([[aiAgents, [row({ toolsJson: "{{{", supportedModulesJson: "nope" })]]]));
    m.getDb.mockResolvedValue(f.db);
    const [a] = await listAiAgents();
    expect(a.tools).toEqual([]);
    expect(a.supportedModules).toEqual([]);
  });
});
