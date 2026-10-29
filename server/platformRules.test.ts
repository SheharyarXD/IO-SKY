import { describe, expect, it } from "vitest";
import {
  clientMayViewDocument,
  mayUseSecurityCenter,
  OPERATOR_SCOPES,
  OPS_OPERATION_SCOPES,
  operatorMayPerform,
  type OpsOperation,
  pickLocale,
  placeholdersIn,
  renderTemplate,
  roleMayAccessDocumentType,
  scopeIsActive,
  templateVariantId,
  validateTemplate,
} from "../shared/platformRules";
import { DEFAULT_ROUTED_MODELS, estimateCostMicros, parsePrices, routeModel } from "../shared/modelRouting";

describe("notification templates (OPD-001)", () => {
  it("builds the variant id from event, channel, language and version", () => {
    expect(templateVariantId("PAYMENT_COMPLETED", "email", "nl", 3)).toBe("PAYMENT_COMPLETED:email:nl:v3");
  });
  it("accepts only the backend derived placeholders", () => {
    expect(validateTemplate({ subject: "Hi {{recipientName}}", body: "See {{link}}" }).ok).toBe(true);
    expect(validateTemplate({ subject: "x", body: "{{password}}" }).ok).toBe(false);
  });
  it("refuses markup in template text", () => {
    expect(validateTemplate({ subject: "x", body: "<script>alert(1)</script>" }).ok).toBe(false);
  });
  it("escapes values when rendering html and leaves missing values empty", () => {
    expect(renderTemplate("Hello {{recipientName}} {{reference}}", { recipientName: "<b>A</b>" }, true)).toBe("Hello &lt;b&gt;A&lt;/b&gt; ");
    expect(placeholdersIn("{{link}} {{link}} {{date}}")).toEqual(["link", "date"]);
  });
  it("falls back to English when the preferred language has no template", () => {
    expect(pickLocale("nl-NL", ["en", "nl"])).toBe("nl");
    expect(pickLocale("de", ["en", "nl"])).toBe("en");
    expect(pickLocale("nl", ["en"])).toBe("en");
  });
});

describe("document matrix (OPD-003)", () => {
  const row = { authorizedRoles: '["super_admin","admin","client"]', clientVisible: true };
  it("allows only the listed roles", () => {
    expect(roleMayAccessDocumentType("client", row)).toBe(true);
    expect(roleMayAccessDocumentType("developer", row)).toBe(false);
  });
  it("never shows a type to a client unless it is client visible", () => {
    expect(roleMayAccessDocumentType("client", { ...row, clientVisible: false })).toBe(false);
  });
  it("is closed for unknown types except for administrators", () => {
    expect(roleMayAccessDocumentType("client", null)).toBe(false);
    expect(roleMayAccessDocumentType("admin", null)).toBe(true);
  });
});

describe("technical operator scopes (SRS 15.4)", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("treats expired and revoked grants as inactive", () => {
    expect(scopeIsActive({ scope: "security", expiresAt: null, revokedAt: null }, now)).toBe(true);
    expect(scopeIsActive({ scope: "security", expiresAt: new Date("2026-10-09T00:00:00Z"), revokedAt: null }, now)).toBe(false);
    expect(scopeIsActive({ scope: "security", expiresAt: null, revokedAt: new Date() }, now)).toBe(false);
  });
  it("does not give the Security Center to an operator by role alone", () => {
    expect(mayUseSecurityCenter("technical_operator", [], now)).toBe(false);
    expect(mayUseSecurityCenter("technical_operator", [{ scope: "backend", expiresAt: null, revokedAt: null }], now)).toBe(false);
    expect(mayUseSecurityCenter("technical_operator", [{ scope: "security", expiresAt: null, revokedAt: null }], now)).toBe(true);
  });
  it("keeps administrators and refuses every other role", () => {
    expect(mayUseSecurityCenter("admin", [], now)).toBe(true);
    expect(mayUseSecurityCenter("developer", [{ scope: "security", expiresAt: null, revokedAt: null }], now)).toBe(false);
  });
});

describe("AI model routing (SRS 19.6, 19.25)", () => {
  it("uses the configured model for each class", () => {
    const env = { LLM_MODEL_SIMPLE: "small", LLM_MODEL_COMPLEX: "big" };
    expect(routeModel("simple", env).model).toBe("small");
    expect(routeModel("complex", env).model).toBe("big");
  });
  it("lets a single LLM_MODEL pin every class, as before routing existed", () => {
    expect(routeModel("simple", { LLM_MODEL: "one" })).toMatchObject({ model: "one", source: "pinned" });
    expect(routeModel("complex", { LLM_MODEL: "one" }).model).toBe("one");
  });
  it("falls back to the defaults and treats an unknown class as complex", () => {
    expect(routeModel("simple", {}).model).toBe(DEFAULT_ROUTED_MODELS.simple);
    expect(routeModel("nonsense", {})).toMatchObject({ complexity: "complex", model: DEFAULT_ROUTED_MODELS.complex });
  });
  it("prices a call only when the model has a configured price", () => {
    const prices = parsePrices('{"m":{"in":2,"out":8},"bad":{"in":"x"}}');
    expect(Object.keys(prices)).toEqual(["m"]);
    expect(estimateCostMicros("m", 1000, 500, prices)).toBe(6000);
    expect(estimateCostMicros("other", 1000, 500, prices)).toBeNull();
    expect(parsePrices("not json")).toEqual({});
  });
});

// P0-03 / J11, SRS 18.8, GOV-08: the matrix lookup fails closed.
describe("client document visibility fails closed (GOV-08)", () => {
  const allowed = new Set(["proposal", "invoice"]);
  it("shows a typed document only when the matrix opens its type to clients", () => {
    expect(clientMayViewDocument({ documentType: "proposal" }, allowed)).toBe(true);
    expect(clientMayViewDocument({ documentType: "internal_note" }, allowed)).toBe(false);
  });
  it("hides a type that has no matrix row at all", () => {
    expect(clientMayViewDocument({ documentType: "brand_new_type" }, allowed)).toBe(false);
    expect(clientMayViewDocument({ documentType: "proposal" }, new Set())).toBe(false);
  });
  it("hides every typed document while the matrix cannot be read (null)", () => {
    expect(clientMayViewDocument({ documentType: "proposal" }, null)).toBe(false);
  });
  it("leaves untyped documents on their organisation scoped visibility", () => {
    expect(clientMayViewDocument({ documentType: null }, allowed)).toBe(true);
    expect(clientMayViewDocument({ documentType: undefined }, null)).toBe(true);
  });
});

describe("operator operation scopes (GOV-06, Z09)", () => {
  const g = (scope: string, o: { expiresAt?: Date | null; revokedAt?: Date | null } = {}) => ({ scope, expiresAt: o.expiresAt ?? null, revokedAt: o.revokedAt ?? null });
  const ops = Object.keys(OPS_OPERATION_SCOPES) as OpsOperation[];
  it("maps every operation to at least one real scope", () => {
    for (const op of ops) {
      expect(OPS_OPERATION_SCOPES[op].length).toBeGreaterThan(0);
      for (const s of OPS_OPERATION_SCOPES[op]) expect(OPERATOR_SCOPES).toContain(s);
    }
  });
  it("never lets the role alone open an operation", () => {
    for (const op of ops) expect(operatorMayPerform("technical_operator", [], op)).toBe(false);
  });
  it("opens an operation only for a listed, active scope", () => {
    expect(operatorMayPerform("technical_operator", [g("infrastructure")], "system_health")).toBe(true);
    expect(operatorMayPerform("technical_operator", [g("security")], "system_health")).toBe(false);
    expect(operatorMayPerform("technical_operator", [g("ui_ux")], "security")).toBe(false);
  });
  it("honours expiry and revocation", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(operatorMayPerform("technical_operator", [g("security", { expiresAt: new Date("2026-10-30T11:59:59Z") })], "security", now)).toBe(false);
    expect(operatorMayPerform("technical_operator", [g("security", { expiresAt: new Date("2026-10-30T12:00:01Z") })], "security", now)).toBe(true);
    expect(operatorMayPerform("technical_operator", [g("security", { revokedAt: new Date("2026-10-30T11:00:00Z") })], "security", now)).toBe(false);
  });
  it("lets another valid grant carry the operation when one grant is revoked", () => {
    expect(operatorMayPerform("technical_operator", [g("infrastructure", { revokedAt: new Date() }), g("backend")], "email_log")).toBe(true);
  });
  it("does not scope limit admins and refuses every other role", () => {
    for (const op of ops) {
      expect(operatorMayPerform("admin", [], op)).toBe(true);
      expect(operatorMayPerform("super_admin", [], op)).toBe(true);
      expect(operatorMayPerform("client", [g("infrastructure"), g("security")], op)).toBe(false);
      expect(operatorMayPerform("developer", [g("infrastructure"), g("security")], op)).toBe(false);
    }
  });
  it("refuses an unknown operation", () => {
    expect(operatorMayPerform("technical_operator", [g("infrastructure"), g("security")], "not_a_real_op" as OpsOperation)).toBe(false);
  });
});
