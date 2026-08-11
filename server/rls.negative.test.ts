/**
 * RM-60 — RLS negative test suite, run against the REAL live Supabase
 * project (drizzle/0004_rls_policies.sql), not mocked assumptions.
 *
 * Every assertion below goes through Supabase's actual PostgREST API using
 * the `anon`/`authenticated` Postgres roles — the same path a real browser
 * client (or anyone holding the public publishable key) would use. This is
 * deliberately NOT run through the app's own privileged `postgres-js`
 * connection (server/db/connection.ts), which owns the tables and bypasses
 * RLS by design — that would prove nothing about RLS itself.
 *
 * SKIPS CLEANLY when live credentials aren't configured (e.g. CI, which
 * has no DATABASE_URL/SUPABASE_* secrets) — this suite needs real
 * infrastructure, not something CI can fabricate. Runs for real whenever
 * `.env` is present, as it is in this development environment.
 *
 * All fixtures (2 orgs, 2 client users, 2 developer users, an admin user,
 * report/invoice/lead/legal-document rows) are created via the Supabase
 * service-role client in `beforeAll` and deleted in `afterAll` — nothing
 * is left behind in the live database after this file runs.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

const liveConfigured = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SECRET_KEY && DATABASE_URL,
);

if (!liveConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[rls.negative.test] Skipping RM-60 live RLS suite - DATABASE_URL/SUPABASE_* not configured in this environment.",
  );
}

describe.skipIf(!liveConfigured)("RM-60: RLS negative tests (live Supabase project)", () => {
  // NOTE: describe.skipIf still runs this callback body synchronously
  // during test collection (only the it()/beforeAll() callbacks
  // themselves are skipped) - so nothing that touches the network or
  // requires the env vars to be non-null can live at this level. Every
  // live client/connection is constructed inside beforeAll below.
  let admin: SupabaseClient;
  let sql: ReturnType<typeof postgres>;

  const stamp = Date.now();
  const pw = "Rls-Test-Passw0rd!";

  let orgA: number, orgB: number;
  let userAAuthId: string, userBAuthId: string;
  let devXAuthId: string, devYAuthId: string;
  let adminAuthId: string;
  let userAId: number, userBId: number, devXId: number, devYId: number, adminId: number;
  let devXProfileId: number, devYProfileId: number;
  let reportAId: number, invoiceAId: number, leadId: number;
  let legalDocId: number, publishedVersionId: number, draftVersionId: number;

  let clientA: SupabaseClient; // signed in as User A (org A)
  let clientB: SupabaseClient; // signed in as User B (org B)
  let devClientX: SupabaseClient; // signed in as Developer X
  let devClientY: SupabaseClient; // signed in as Developer Y
  let anonClient: SupabaseClient; // never signed in

  async function createAuthUser(email: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser(${email}) failed: ${error?.message}`);
    return data.user.id;
  }

  async function signedInClient(email: string): Promise<SupabaseClient> {
    const client = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password: pw });
    if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
    return client;
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    sql = postgres(DATABASE_URL!, { prepare: false });

    // --- organizations (two separate tenants) ---
    const orgs = await sql`
      insert into organizations (slug, name) values
        (${"rls-test-org-a-" + stamp}, ${"RLS Test Org A"}),
        (${"rls-test-org-b-" + stamp}, ${"RLS Test Org B"})
      returning id`;
    orgA = orgs[0].id;
    orgB = orgs[1].id;

    // --- auth users + linked public.users rows ---
    userAAuthId = await createAuthUser(`rls-usera-${stamp}@example.invalid`);
    userBAuthId = await createAuthUser(`rls-userb-${stamp}@example.invalid`);
    devXAuthId = await createAuthUser(`rls-devx-${stamp}@example.invalid`);
    devYAuthId = await createAuthUser(`rls-devy-${stamp}@example.invalid`);
    adminAuthId = await createAuthUser(`rls-admin-${stamp}@example.invalid`);

    const users = await sql`
      insert into users ("openId", "authUserId", email, role, "organizationId") values
        (${"supabase:" + userAAuthId}, ${userAAuthId}, ${"rls-usera-" + stamp + "@example.invalid"}, 'client', ${orgA}),
        (${"supabase:" + userBAuthId}, ${userBAuthId}, ${"rls-userb-" + stamp + "@example.invalid"}, 'client', ${orgB}),
        (${"supabase:" + devXAuthId}, ${devXAuthId}, ${"rls-devx-" + stamp + "@example.invalid"}, 'developer', null),
        (${"supabase:" + devYAuthId}, ${devYAuthId}, ${"rls-devy-" + stamp + "@example.invalid"}, 'developer', null),
        (${"supabase:" + adminAuthId}, ${adminAuthId}, ${"rls-admin-" + stamp + "@example.invalid"}, 'admin', null)
      returning id, role`;
    userAId = users[0].id;
    userBId = users[1].id;
    devXId = users[2].id;
    devYId = users[3].id;
    adminId = users[4].id;

    const devProfiles = await sql`
      insert into developer_profiles ("userId", "fullName") values
        (${devXId}, ${"Developer X"}),
        (${devYId}, ${"Developer Y"})
      returning id`;
    devXProfileId = devProfiles[0].id;
    devYProfileId = devProfiles[1].id;

    // --- tenant-scoped fixture rows (Org A only) ---
    const report = await sql`
      insert into client_reports ("organizationId", "publicRef", title, score)
      values (${orgA}, ${"RLS-" + stamp}, ${"RLS Test Report"}, 80)
      returning id`;
    reportAId = report[0].id;

    const invoice = await sql`
      insert into client_invoices ("organizationId", number, description, "amountCents", "issuedMs")
      values (${orgA}, ${"RLS-INV-" + stamp}, ${"RLS test invoice"}, 1000, ${Date.now()})
      returning id`;
    invoiceAId = invoice[0].id;

    // --- admin-only table fixture ---
    const lead = await sql`
      insert into leads (source, "fullName", email)
      values (${"rls-test"}, ${"RLS Lead"}, ${"rls-lead-" + stamp + "@example.invalid"})
      returning id`;
    leadId = lead[0].id;

    // --- legal documents: one published (anon-readable), one draft (not) ---
    const doc = await sql`
      insert into legal_documents (kind, slug, title, status)
      values (${"rls-test-doc-" + stamp}, ${"rls-test-doc-" + stamp}, ${"RLS Test Policy"}, 'active')
      returning id`;
    legalDocId = doc[0].id;

    const versions = await sql`
      insert into agreement_versions ("documentId", version, "bodyMd", "bodyHash", status) values
        (${legalDocId}, ${"1.0"}, ${"published body"}, ${"hash1"}, 'published'),
        (${legalDocId}, ${"2.0-draft"}, ${"draft body"}, ${"hash2"}, 'draft')
      returning id, status`;
    publishedVersionId = versions[0].id;
    draftVersionId = versions[1].id;

    clientA = await signedInClient(`rls-usera-${stamp}@example.invalid`);
    clientB = await signedInClient(`rls-userb-${stamp}@example.invalid`);
    devClientX = await signedInClient(`rls-devx-${stamp}@example.invalid`);
    devClientY = await signedInClient(`rls-devy-${stamp}@example.invalid`);
    anonClient = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }, 60_000);

  afterAll(async () => {
    try {
      await sql`delete from agreement_versions where "documentId" = ${legalDocId}`;
      await sql`delete from legal_documents where id = ${legalDocId}`;
      await sql`delete from leads where id = ${leadId}`;
      await sql`delete from client_invoices where id = ${invoiceAId}`;
      await sql`delete from client_reports where id = ${reportAId}`;
      await sql`delete from developer_profiles where id in (${devXProfileId}, ${devYProfileId})`;
      await sql`delete from users where id in (${userAId}, ${userBId}, ${devXId}, ${devYId}, ${adminId})`;
      await sql`delete from organizations where id in (${orgA}, ${orgB})`;
    } finally {
      for (const authId of [userAAuthId, userBAuthId, devXAuthId, devYAuthId, adminAuthId]) {
        await admin.auth.admin.deleteUser(authId).catch(() => {});
      }
      await sql.end({ timeout: 1 });
    }
  }, 60_000);

  // -------------------------------------------------------------------
  // Cross-tenant reads
  // -------------------------------------------------------------------

  it("client A can read their own org's report", async () => {
    const { data } = await clientA.from("client_reports").select("id").eq("id", reportAId);
    expect(data).toHaveLength(1);
  });

  it("client B CANNOT read client A's org report (cross-tenant read denied)", async () => {
    const { data } = await clientB.from("client_reports").select("id").eq("id", reportAId);
    expect(data ?? []).toHaveLength(0);
  });

  it("client B CANNOT read client A's org invoice (cross-tenant read denied)", async () => {
    const { data } = await clientB.from("client_invoices").select("id").eq("id", invoiceAId);
    expect(data ?? []).toHaveLength(0);
  });

  it("client B CANNOT read client A's organization row directly", async () => {
    const { data } = await clientB.from("organizations").select("id").eq("id", orgA);
    expect(data ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Cross-tenant writes (update / delete)
  // -------------------------------------------------------------------

  it("client B CANNOT update client A's org invoice (cross-tenant update denied)", async () => {
    const { error, count } = await clientB
      .from("client_invoices")
      .update({ description: "hacked" })
      .eq("id", invoiceAId)
      .select("id", { count: "exact" });
    // RLS makes the target row invisible, so this affects 0 rows rather
    // than erroring - either signal (error OR zero rows) proves the write
    // didn't land. Confirmed unchanged directly below via the admin client.
    expect(error || (count ?? 0) === 0).toBeTruthy();
    const check = await sql`select description from client_invoices where id = ${invoiceAId}`;
    expect(check[0]?.description).toBe("RLS test invoice");
  });

  it("client B CANNOT delete client A's org report (cross-tenant delete denied)", async () => {
    await clientB.from("client_reports").delete().eq("id", reportAId);
    const check = await sql`select id from client_reports where id = ${reportAId}`;
    expect(check).toHaveLength(1); // still there
  });

  // -------------------------------------------------------------------
  // Unauthorized access to admin-only tables
  // -------------------------------------------------------------------

  it("client A CANNOT read the admin-only leads table", async () => {
    const { data } = await clientA.from("leads").select("id").eq("id", leadId);
    expect(data ?? []).toHaveLength(0);
  });

  it("developer X CANNOT read the admin-only leads table", async () => {
    const { data } = await devClientX.from("leads").select("id").eq("id", leadId);
    expect(data ?? []).toHaveLength(0);
  });

  it("unauthenticated (anon) request CANNOT read leads at all", async () => {
    const { data } = await anonClient.from("leads").select("id").eq("id", leadId);
    expect(data ?? []).toHaveLength(0);
  });

  it("unauthenticated (anon) request CANNOT read client_reports at all", async () => {
    const { data } = await anonClient.from("client_reports").select("id").eq("id", reportAId);
    expect(data ?? []).toHaveLength(0);
  });

  it("unauthenticated (anon) request CANNOT read organizations at all", async () => {
    const { data } = await anonClient.from("organizations").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // Developer <-> developer boundary
  // -------------------------------------------------------------------

  it("developer Y CANNOT read developer X's developer_profiles row", async () => {
    const { data } = await devClientY.from("developer_profiles").select("id").eq("id", devXProfileId);
    expect(data ?? []).toHaveLength(0);
  });

  it("developer X can read their OWN developer_profiles row", async () => {
    const { data } = await devClientX.from("developer_profiles").select("id").eq("id", devXProfileId);
    expect(data).toHaveLength(1);
  });

  it("client A (not a developer) CANNOT read any developer_profiles row", async () => {
    const { data } = await clientA.from("developer_profiles").select("id").eq("id", devXProfileId);
    expect(data ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // MFA tables: strictly self-only, not even readable cross-tenant/admin
  // -------------------------------------------------------------------

  it("client B CANNOT read client A's mfa_factors (even though none exist, the query must return empty, not error, and must not leak existence)", async () => {
    const { data, error } = await clientB.from("mfa_factors").select("id").eq("userId", userAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------
  // The one deliberate anon-readable carve-out: published legal docs only
  // -------------------------------------------------------------------

  it("unauthenticated (anon) CAN read a PUBLISHED agreement version (deliberate public carve-out)", async () => {
    const { data } = await anonClient
      .from("agreement_versions")
      .select("id")
      .eq("id", publishedVersionId);
    expect(data).toHaveLength(1);
  });

  it("unauthenticated (anon) CANNOT read a DRAFT agreement version (carve-out is narrowly scoped, not USING(true))", async () => {
    const { data } = await anonClient.from("agreement_versions").select("id").eq("id", draftVersionId);
    expect(data ?? []).toHaveLength(0);
  });

  it("unauthenticated (anon) CAN read the active legal_documents row itself", async () => {
    const { data } = await anonClient.from("legal_documents").select("id").eq("id", legalDocId);
    expect(data).toHaveLength(1);
  });
});
