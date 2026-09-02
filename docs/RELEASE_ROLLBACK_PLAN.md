# Release & Rollback Plan

**Milestone 3 §3.5 (RM-118)** — documented rollback plan, required before go-live.

> **Status: written, not yet exercised.** Nothing in this document has been
> rehearsed against real infrastructure, because the hosting provider is still
> an open client decision (RM-74) and no deployed environment exists. Under the
> delivered / tested / verified / production-ready vocabulary agreed with the
> client, this plan is **implemented, not verified**. It must be rehearsed once
> before it is relied on — a rollback plan whose first execution is during a
> real incident is not a rollback plan.

---

## 1. What can be rolled back, and how fast

| Layer | Mechanism | Target time | Reversible? |
|---|---|---|---|
| Application code | Redeploy the previous image/build | < 5 min | Yes, cleanly |
| Static client bundle | Served from the same artifact as the app | < 5 min | Yes, cleanly |
| Environment/config | Revert the value in the host's secret manager, restart | < 5 min | Yes |
| DNS | Revert the record; bounded by TTL | TTL-bound | Yes |
| Database schema | Forward-fix or a written down-migration | Varies | **Often not** |
| Storage objects | Supabase bucket versioning / restore | Varies | Partially |

**The asymmetry is the important part.** Code rolls back in minutes. A schema
change frequently cannot roll back at all once data has been written under it.
The plan below is shaped around that: the release order exists so that a
rollback almost never has to touch the database.

---

## 2. Pre-release gates

All of these are already automated in `.github/workflows/ci.yml`. None is a
manual judgement call.

- [ ] `pnpm run check` — typecheck clean
- [ ] `pnpm run test` — full suite green
- [ ] `pnpm run test:security` — auth/RBAC/tenant suite green, **non-zero test count**
- [ ] `pnpm run build` — production build succeeds
- [ ] `pnpm run scan:artifact` — no secrets in the build output (RM-82)
- [ ] `pnpm run test:e2e` — golden paths green against staging
- [ ] Database migrations applied to **staging** and verified there first
- [ ] Backup taken and **restore rehearsed** (RM-79) — not merely configured

---

## 3. Release order

The sequence is deliberate. Each step is independently reversible, and the
irreversible one is placed where it can be verified before anything depends
on it.

1. **Take a database backup.** Record the snapshot id in the release log.
2. **Apply migrations** — additive only (see §4). Verify against staging first.
3. **Deploy the application** to the new version.
4. **Smoke-check** — §5 below.
5. **Cut DNS** (only on first go-live) with a low TTL — see §6.
6. **Watch** for the 48-hour stability window (RM-117).

Migrations run *before* the deploy so the new code never meets an old schema.
That only works because migrations are additive; see the next section.

---

## 4. Migration discipline (why rollback stays cheap)

**Every migration must be backwards compatible with the currently-running
application version.** Additive only: new nullable columns, new tables, new
indexes. No drops, no renames, no type narrowing in the same release that ships
the code using them.

This is not theoretical. It was violated during Milestone 3 and caught by the
E2E suite:

> `sessionsRevokedAtMs` was added to `drizzle/schema.ts` while migration 0016
> had not yet been applied to the live database. Drizzle immediately began
> selecting the column, and **every local login failed** with
> `DrizzleQueryError`. The unit tests did not catch it — they stub the DB
> layer. The E2E run did, because it drove a real login against a real
> database.

The lesson is encoded in the rule above: schema and code must be able to run
one version apart in **either** direction. A column removal is therefore a
two-release operation — stop reading it, ship, then drop it in a later release.

**Down-migrations.** Where a migration cannot be additive, a corresponding
`*_down.sql` must be written *and tested against a restored backup* in the same
PR. An untested down-migration is worse than none, because it invites use
during an incident.

---

## 5. Post-deploy smoke check

Fast, deliberately shallow, run immediately after every deploy. Anything
failing here triggers §7.

- [ ] Health endpoint returns 200
- [ ] Homepage renders; no console errors
- [ ] `/login` renders and rejects a known-bad credential pair
- [ ] A staging account signs in and reaches its portal
- [ ] Logout clears the session **and** the portal is no longer reachable (RM-90)
- [ ] One tRPC read (e.g. `bookings.listSlots`) returns 200
- [ ] Security headers present: CSP, HSTS, `X-Content-Type-Options` (RM-86)
- [ ] No `URIError`/500 in the first minute of logs
- [ ] Error rate and p95 latency within baseline

`pnpm run test:e2e` against the deployed URL covers most of this
(`E2E_BASE_URL=https://…`).

---

## 6. DNS cutover (first go-live only)

- Lower the TTL to **60 seconds at least 24 hours before** the cutover. TTL is
  the rollback speed limit and cannot be changed retroactively — a 3600s TTL
  set on the day means a one-hour rollback no matter how fast the team reacts.
- Keep the previous target alive and serving for the full stability window. Do
  not decommission anything on release day.
- Revert = point the record back. Bounded by the TTL now in effect.
- Restore the normal TTL only after the 48-hour window closes.

---

## 7. Rollback triggers

Roll back without further debate if any of these hold:

- Authentication is broken for any role
- Any cross-tenant data exposure, however small
- Error rate above baseline for more than 5 consecutive minutes
- A core workflow (login, booking, document, messaging) is unusable
- Data is being written incorrectly — **roll back immediately**; every further
  minute enlarges the corrupted set and makes restore costlier

Debugging forward is acceptable only for a cosmetic or single-page defect with
no data impact.

---

## 8. Rollback procedure

1. **Declare it.** One named person owns the rollback; announce in the incident
   channel. Ambiguity about who is acting is the main cause of two people
   acting at once.
2. **Redeploy the previous version.** The artifact from the prior release is
   retained; do not rebuild from source during an incident.
3. **Leave the schema alone** if migrations were additive — old code ignores
   new columns. This is the whole point of §4.
4. **Verify** with the §5 smoke check.
5. **Only if data is corrupted:** restore from the §3 backup. This loses every
   write since the snapshot, so it needs an explicit decision from the client,
   not a unilateral engineering call.
6. **Write it up** within 24 hours: what shipped, what broke, what the signal
   was, what the fix is, and what would have caught it earlier.

---

## 9. Known gaps

Listed explicitly rather than left for the client to discover.

| Gap | Consequence | Resolves with |
|---|---|---|
| Never rehearsed | First execution would be during a real incident | RM-74 hosting, then a drill |
| No backup restore test | "Backups configured" is not "backups work" | RM-79 |
| No staging environment | Cannot verify a release before production | RM-74 |
| No automated deploy/rollback | Every step here is manual and human-paced | RM-80 |
| No alerting thresholds agreed | "Above baseline" has no baseline yet | RM-110 load test |
| Single-instance rate limiting | Default store is in-memory | RM-88 — set `RATE_LIMIT_STORE=postgres` |

---

## 10. Sign-off

Not to be signed until the plan has been **rehearsed once** end to end
against real infrastructure, including a backup restore.

| Item | Owner | Date | Status |
|---|---|---|---|
| Plan reviewed | | | ☐ |
| Rehearsed on staging | | | ☐ |
| Backup restore verified | | | ☐ |
| Client sign-off | | | ☐ |
