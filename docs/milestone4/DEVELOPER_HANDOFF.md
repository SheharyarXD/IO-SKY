# Developer handoff: Milestone 4 work

For an engineer picking up this repository. It describes what was added on branch `milestone4-implementation`, how to run and test it safely, what must happen before anything is deployed, and what is **not** done. Read `MILESTONE4_BLOCKERS.md` for the migration order and `MILESTONE4_DECISION_LOG.md` for the assumptions that still need to be matched against the client document.

Status words used here are the project vocabulary. Everything below is **implemented and tested locally with mocks**. Nothing has been verified against production, a real database provider, a live AI model, Stripe, telephony or email delivery.

## 1. Running and testing safely

| Command | What it does |
|---|---|
| `pnpm install` then `pnpm dev` | Development server (`NODE_ENV=development tsx watch server/_core/index.ts`) |
| `pnpm run check` | TypeScript, no emit |
| `pnpm test` (`vitest run`) | The whole suite. **Database-free by design.** |
| `pnpm run build` | Client bundle (vite) and server bundle (esbuild) into `dist/` |
| `pnpm run verify` | check, test, build and the build-artifact secret scan |
| `pnpm run test:security` | The security suite runner |

**Test safety is enforced, not requested** (`docs/TESTING_SAFETY.md`). The vitest config blanks `DATABASE_URL` and the Supabase variables in every worker, so a developer's `.env` cannot be loaded by accident. Database integration suites are skipped unless `ALLOW_DB_TESTS=1` **and** `TEST_DATABASE_URL` points at an isolated database that is not the production endpoint; the guard refuses a URL equal to production. Never run the suite against the production database. The 57 skipped tests are exactly those suites.

## 2. Repository map for the new work

Rules are **pure and shared** (`shared/`), persistence is in `server/db/`, tRPC procedures are in `server/routers/`, and tests are database-free in `server/*.test.ts`. Adding behaviour means putting the decision in a `shared/` rule, testing it directly, then wiring it.

| Area | Rules (shared) | Server | Notes |
|---|---|---|---|
| Test safety | `testDbSafety` | `testDbSafety.test.ts` | M4-05 |
| Agent runtime | `aiAgentRegistry`, `identityPolicy`, `knowledgeAccess` | `agentRuntime.ts`, `agentRuntimeWiring.ts` | Tool pipeline: actor, registry, args, identity level, knowledge source, organisation, authority, permission, execute |
| Agent tools | `crmRules`, `schedulingRules`, `discoveryQualification`, `callbackRules`, `faqRules` | `crmTools`, `schedulingTools`, `discoveryCapture`, `callbackTools`, `faqStore`, `callContext`, `supportTools`, `salesTools` | None is registered or enabled |
| Agent definitions | `supportAgent`, `salesAgent` | `adminOps.registerSupportAgent`, `registerSalesAgent` | Register **disabled** (super admin) |
| Provider routing | `providerRouting` | `llmRouter.ts`, `_core/llm.ts` | Single provider unless `LLM_PROVIDERS_JSON` or a budget is set |
| Reports | `reportPermissions`, `reportCompare` | `routers/adminOps.ts`, `db/aiScans.ts` | Publish needs a right; versions kept per engine run |
| Documents | `documentHandoff`, `uploadValidation` | `db/documentHandoff.ts` | Staff release only |
| Delivery | `taskAssignmentRules`, `teamRules`, `teamAssignment` | `db/developerWorkspace.ts`, `db/developerTeams.ts` | Reassign, replace, teams |
| Messaging | `mediatedMessaging` | `db/mediatedMessaging.ts` | Staff relay between developers and clients |
| CRM | `crmFilters`, `leadOwnership`, `profileRules`, `deadlineRules` | `db/crm.ts`, `deadlineSweeps.ts` | Filters, owner, profile, due follow-ups |
| Config | `backupPolicy`, `promptTools`, `quoteDocument`, `notificationFamilies` | `admin.ts`, `adminOps.ts` | Declared backup policy, prompt compare, quote PDF |

## 3. Background work

All in-process, single instance safe, no external scheduler:

- `server/_core/index.ts`: booking reminders every 5 minutes; failed-email retry every 5 minutes.
- `server/_core/operations.ts` tick, every 5 minutes: security policy refresh, alert rules, scheduled reports, scheduled workflows, expired AI Scan draft purge, Stripe reconciliation, payment reminders, **deadline sweeps** (follow-ups due, task deadlines), **callback escalation**.

Each job is idempotent: the notification dispatcher de-duplicates on a reference, and escalation levels are claimed in the database so two instances announce once. Each is a quiet no-op without a database or before its migration.

## 4. Configuration

Names only; never commit values. The variables the code reads: `DATABASE_URL`, `DATABASE_POOL_MAX`, `JWT_SECRET`, `SESSION_TTL_HOURS`, `PUBLIC_BASE_URL`, `VITE_PUBLIC_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `CSP_EXTRA_CONNECT_ORIGINS`, `TRUST_PROXY`, `RATE_LIMIT_STORE`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SMTP_URL`, `SMTP_HOST`, `SMTP_FROM`, `BOOKING_FROM_EMAIL`, `OWNER_NOTIFY_EMAIL`, `OWNER_NOTIFY_SLACK_WEBHOOK_URL`, `OWNER_OPEN_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_AUTOMATIC_TAX`, `STRIPE_TAX_CODE`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `AI_SCAN_CURRENCY`, `STAGING_MODE`, `STAGING_PASSWORD`, `STAGING_SECRET`, `GIT_COMMIT_SHA`, `RAILWAY_GIT_COMMIT_SHA`, `PORT`, `NODE_ENV`, and the legacy `BUILT_IN_FORGE_API_URL`/`BUILT_IN_FORGE_API_KEY`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_ANALYTICS_ENDPOINT`.

AI: `OPENAI_API_KEY` alone, or `LLM_API_URL` + `LLM_API_KEY` + `LLM_MODEL`; optional `LLM_MODEL_<SIMPLE|MEDIUM|COMPLEX>`, `LLM_TIMEOUT_MS`, `LLM_PRICES_JSON`. **New and optional:** `LLM_PROVIDERS_JSON` (a list of providers by priority; each names the environment variable that holds its key, keys never go in the JSON), `LLM_BUDGET_DAILY_USD`, `LLM_BUDGET_MONTHLY_USD`. With none of the three set, behaviour is exactly the single-provider behaviour from before. Test only: `TEST_DATABASE_URL`, `TEST_DB_MODE`, `ALLOW_DB_TESTS`.

## 5. Before any deployment

1. **Read the migration order table** in `MILESTONE4_BLOCKERS.md`. Migrations 0037 to 0048 are written and **none is applied**. Apply each to a non-production database first, verify, then production, then deploy the code. **0038 must be applied before deploying** the code that reads the agent registry; the others fail closed or do nothing until applied.
2. The SQL in 0037, 0040 to 0048 has **never run against PostgreSQL**. The isolated database that would allow it is task M4-03 and does not exist yet.
3. **Behaviour change on deploy:** admins can no longer publish AI Scan reports until a super admin grants `report:publish` (P07). Super admins are unaffected.
4. Nothing needs to be enabled for the new features to be harmless: the AI agents are registered disabled by a super admin and no agent is operational.
5. Follow `docs/RELEASE_ROLLBACK_PLAN.md` and use the release note template in `RELEASE_NOTE_PROCESS.md`.

## 6. What is not done

- **No agent is operational.** There is no live model call, no telephony, no conversation layer applying the hand-over checks, and no flow that verifies a caller (R11), so Level 2 tools refuse everyone.
- Warm transfer, IVR and call analytics (R05, R22 to R24) are not built; callbacks come from staff and the receptionist tool only.
- Messaging has no attachments; per-developer milestones, quotation emailing, and the remaining 38 catalogue notification events are not built.
- Guided restore, the Stripe Tax setup (B05) and the isolated staging environment (I01) need the client or an external resource.
- Every product decision in the decision log is an assumption.
