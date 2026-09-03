# Deployment & Secrets Reference

**Milestone 3 §3.2 (RM-81, RM-75, RM-76).** Everything needed to deploy IO SKY,
independent of which host is chosen.

> **Status.** The application is container-ready and every command below has
> been run and verified locally — except the container build itself, which
> could not be executed here (no Docker CLI available). Nothing has been
> deployed. Under the agreed vocabulary: **implemented and tested, not
> verified against a real host, not production-ready.**
>
> The one genuinely open decision is the hosting provider (RM-74). It has been
> open since Milestone 1 §1.3 and is the last thing standing between this
> document and a running environment.

---

## 1. What the host must provide

The plan's only hard requirement is a **long-lived Node process** — the app
holds a database pool and serves both the API and the built client from one
process. That rules out pure edge/lambda runtimes without a persistent
container, and rules in essentially everything else.

| Requirement | Why |
|---|---|
| Long-lived Node 22 process | Database pool, in-process rate limiter |
| Explicit port binding via `PORT` | The app's port-scan fallback is for local dev only |
| TLS termination + `X-Forwarded-Proto` | Session cookies need `Secure`; see §4 |
| Environment/secret injection at runtime | Secrets must never be baked into the image |
| Outbound HTTPS | Supabase, email, OpenAI, Stripe |
| ≥ 512 MB RAM | Node plus the pool; the build needs more, but builds elsewhere |

Any container host satisfies this: Fly, Railway, Render, Cloud Run, ECS,
a plain VPS with Docker. The included `Dockerfile` is host-agnostic on purpose.

---

## 2. Build and run

```bash
docker build -t iosky:latest \
  --build-arg GIT_COMMIT_SHA="$(git rev-parse HEAD)" \
  --build-arg BUILD_TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)" .

docker run -p 3000:3000 --env-file .env iosky:latest
```

The build runs `pnpm run check`, `pnpm run build` and the RM-82 artifact secret
scan **inside** the image build, so an image containing a leaked credential
cannot be produced, let alone pushed to a registry.

Without Docker:

```bash
pnpm install --frozen-lockfile
pnpm run build
NODE_ENV=production PORT=3000 node dist/index.js
```

---

## 3. Environment variables

`ENV_TEMPLATE.txt` remains the authoritative list. This is the deployment view:
what must be set, and what breaks when it is not.

### Required — the app will not work without these

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase Postgres. **See §5 on pooling — this one has a sharp edge.** |
| `JWT_SECRET` | Signs session cookies. ≥16 chars; the app fails fast rather than signing with a weak key. Rotating it invalidates every session. |
| `SUPABASE_URL` | |
| `SUPABASE_PUBLISHABLE_KEY` | Safe client-side by design |
| `SUPABASE_SECRET_KEY` | **Server-only. Never give this a `VITE_` prefix** — Vite inlines every `VITE_`-prefixed variable into the client bundle, which would publish it. RM-82's scan exists to catch exactly this. |
| `NODE_ENV=production` | Gates CSP and HSTS (RM-86) |
| `PORT` | Bind explicitly |

### Strongly recommended in production

| Variable | Default | Why it matters |
|---|---|---|
| `TRUST_PROXY=true` | off | Behind TLS termination, without this the app reads plain HTTP and **downgrades the session cookie's `Secure` flag**. Opt-in because trusting the header when *not* behind a proxy lets a client spoof it. |
| `SESSION_TTL_HOURS` | 12 | RM-89. Clamped to [5min, 30d]. |
| `DATABASE_POOL_MAX` | 20 | RM-110. See §5. |
| `RATE_LIMIT_STORE=postgres` | `memory` | RM-88. **Required if running more than one instance** — the default is per-process, so N instances give a caller N× the intended allowance. |
| `CORS_ALLOWED_ORIGINS` | none | Only if the client is served from a different origin. Deny-by-default otherwise. Never `*`. |

### Optional

`STAGING_MODE` / `STAGING_PASSWORD` / `STAGING_SECRET` (the pre-launch gate),
`VITE_ANALYTICS_ENDPOINT`, `OWNER_NOTIFY_EMAIL`, `RESEND_API_KEY`,
`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `GIT_COMMIT_SHA`, `BUILD_TIMESTAMP`.

---

## 4. Secrets handling (RM-81)

**Rules, in order of importance.**

1. **Secrets are injected at runtime, never built in.** `.dockerignore` excludes
   `.env*`, `*.pem` and `.npmrc`. Deleting a secret in a later Docker layer does
   **not** remove it from the image — anyone who pulls the image can recover it
   from history. Keep it out of the context in the first place.
2. **Store them in the host's secret manager**, not in a dashboard's plain
   environment field where they render in logs and screenshots.
3. **CI reads from GitHub repository secrets.** The workflows already reference
   them; they still need to be *created* in repo settings by someone with admin
   access. Until then CI exercises only the non-live subset.
4. **The `VITE_` prefix is a publication decision, not a naming convention.**
   Anything so prefixed ends up in the client bundle.
5. **Rotate on exposure, always.** Revoking is cheap; assuming a leaked key was
   never used is not.

### Outstanding

A `.env` containing live Supabase credentials was committed to this repository
earlier in the project. It has since been untracked and `.gitignore` corrected
(the bare filename was missing while every variant was listed — that is how it
happened). **It remains in git history.** Two actions are still required and
both need explicit client sign-off:

- **Rotate** the exposed Supabase keys and database password.
- **Purge** the file from history (`git filter-repo` or BFG), which rewrites
  published history and requires a coordinated force-push.

---

## 5. Database connection — read this before sizing anything

`DATABASE_URL` currently points at Supabase's **transaction pooler**
(`aws-0-*.pooler.supabase.com:6543`), which requires `prepare: false` — already
set.

**Measured behaviour (RM-110):** concurrent queries beyond the pool size do not
queue and drain. They hang.

| Pool | Burst | Result |
|---|---|---|
| 5 | 10 | still pending after 15s |
| 20 | 10 | 1.7s |

postgres.js defaults to `max: 10`, so the **11th concurrent request would never
return** — holding its slot and converting load into an outage rather than
latency. `DATABASE_POOL_MAX` now defaults to 20, with idle/lifetime/connect
timeouts so a stuck connection is recycled.

**This mitigates the cliff; it does not remove it.** Before go-live, set
`DATABASE_POOL_MAX` against the production Supabase tier's actual pool
allowance and re-run `server/concurrency.test.ts`. That sizing is RM-77 and is
still open.

---

## 6. Health checks (RM-76)

| Endpoint | Purpose | Point the host at |
|---|---|---|
| `GET /health` | Liveness — process alive, touches nothing external | restart probe |
| `GET /health/ready` | Readiness — checks the database, 503 when not | load-balancer probe |
| `GET /health/version` | Reports the running commit | deploy/rollback confirmation |

**Do not point a restart probe at `/health/ready`.** Liveness deliberately
ignores the database: an orchestrator restarts whatever fails liveness, so a
DB-dependent liveness check turns a brief database blip into a simultaneous
restart of every instance — a recoverable dependency failure becomes a total
outage.

All three sit before the staging gate, so an uptime monitor needs no password.

---

## 7. First deployment

1. Choose the host (**RM-74 — the open decision**).
2. Create the environment and load the secrets from §3.
3. Apply migrations: `pnpm run db:push`, or apply `drizzle/*.sql` in order.
   Migrations `0016`–`0019` are already applied to the current project.
4. Deploy the image; confirm `/health` → 200 and `/health/version` → your commit.
5. Seed staging accounts: `pnpm run seed`.
6. Point DNS at it — **lower the TTL to 60s at least 24h beforehand**; TTL is
   the rollback speed limit and cannot be changed retroactively.
7. Work through `docs/PRE_LAUNCH_WALKTHROUGH.md`.
8. Keep `docs/RELEASE_ROLLBACK_PLAN.md` to hand — and rehearse it once first.

---

## 8. Still open

| Item | Blocks | Owner |
|---|---|---|
| Hosting provider (RM-74) | Everything in this document | Client |
| Supabase production tier + pool size (RM-77) | §5 sizing | Client |
| Automated backups + tested restore (RM-78/79) | Go-live | Client + us |
| GitHub repository secrets | Live CI verification | Client |
| Credential rotation + history purge | Security | Client sign-off |
| Notification specification (RM-64) | All of §3.1 | Client |
| Audit-log integrity decision (RM-94) | RM-95 | Client |
| Container image never built | Confidence in the Dockerfile | Needs Docker |
