# IO SKY — Manus-Independence Audit

> Goal: confirm IO SKY keeps every business-critical capability running **after** your Manus subscription ends. This document lists every Manus-managed dependency, the replacement provider you can swap in, and the environment variables to set.

---

## 1. Authentication

| Surface | Today | After Manus | Action |
|---|---|---|---|
| Email + password login | `/api/auth/local/login` (bcrypt, in-house) | Same — no Manus dependency | None — already live |
| Magic-link / SSO | Manus OAuth portal (`VITE_OAUTH_PORTAL_URL`) | Optional: keep using until rotation, or wire Auth0/Clerk/Supabase Auth | Set `AUTH_PROVIDER=auth0` (or similar) and re-implement `/api/oauth/callback` |
| MFA TOTP/SMS/Email | In-house (`server/_core/mfa*`) | Same | None |
| View-As / impersonation | In-house signed cookie | Same | None |

**Bottom line:** primary login path is already Manus-independent. The OAuth portal is an optional convenience.

---

## 2. LLM (server/_core/llm.ts)

Used by AI Scan recommendations, Custom Discovery analysis, copy generation, and translation tooling.

**Today:** posts to `${BUILT_IN_FORGE_API_URL}/v1/chat/completions` with bearer key.

**Replacement:** the helper is already OpenAI-compatible. Point it at any compatible endpoint:

```env
BUILT_IN_FORGE_API_URL=https://api.openai.com
BUILT_IN_FORGE_API_KEY=sk-…
# or
BUILT_IN_FORGE_API_URL=https://api.anthropic.com   # via OpenAI-compat proxy
BUILT_IN_FORGE_API_KEY=…
```

No code changes required.

---

## 3. Image Generation (server/_core/imageGeneration.ts)

Used by Custom Discovery preview cards and a handful of marketing surfaces.

**Today:** Manus ImageService at `${BUILT_IN_FORGE_API_URL}/v1/images/generate`.

**Replacement options:**

| Provider | Endpoint | Env |
|---|---|---|
| OpenAI Images | `https://api.openai.com/v1/images/generations` | swap `BUILT_IN_FORGE_API_URL`, adapt body to `{ prompt, model: "gpt-image-1" }` |
| Replicate | `https://api.replicate.com/v1/predictions` | replace `imageGeneration.ts` body, keep helper signature |
| Stability AI | `https://api.stability.ai/v2beta/stable-image/generate/sd3` | similar |

The helper signature `generateImage({ prompt, originalImages? })` is provider-agnostic; only the body schema needs adapting.

---

## 4. File Storage (server/storage.ts + storageProxy.ts)

**Today:** Forge presigned URLs, served via `/manus-storage/*` proxy.

**Replacement:** any S3-compatible object store. Set:

```env
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com
S3_BUCKET=iosky-prod
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_REGION=eu-central-1
```

The S3 client is already installed (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). Replace `storagePut` to use `PutObjectCommand` and `storageProxy.ts` to use `getSignedUrl`. Frontend code that references `/manus-storage/…` keeps working because the URL shape is unchanged — only the implementation behind the route differs.

---

## 5. Data API (server/_core/dataApi.ts)

**Today:** unified API hub via Forge (`/v1/data_api`).

**Replacement:** call upstream providers directly. The helper has a single `invokeDataApi` function; replace its body with `fetch` to the relevant provider (SerpAPI for search, Yahoo Finance, etc.).

---

## 6. Google Maps (server/_core/map.ts + client/src/components/Map.tsx)

**Today:** Manus proxy at `${BUILT_IN_FORGE_API_URL}/v1/maps/*` (no API key required).

**Replacement:**

```env
GOOGLE_MAPS_API_KEY=AIza…
```

Update `Map.tsx` to load Google Maps JS API directly with the key. The frontend component contract (`onMapReady`) stays the same.

---

## 7. Owner Notifications (server/_core/notification.ts)

**Today:** posts to Forge owner-notify endpoint.

**Replacement:** any transactional email or chat webhook.

```env
NOTIFY_EMAIL_TO=ozayer@iosky.com
NOTIFY_SMTP_HOST=…
NOTIFY_SMTP_USER=…
NOTIFY_SMTP_PASS=…
# or Slack
NOTIFY_SLACK_WEBHOOK=https://hooks.slack.com/services/…
```

Replace `notifyOwner` with nodemailer or a Slack webhook call. All call-sites are unchanged.

---

## 8. Voice Transcription (server/_core/voiceTranscription.ts)

**Today:** Forge proxied Whisper.

**Replacement:** OpenAI Whisper directly. Same `BUILT_IN_FORGE_API_URL`/`KEY` swap as LLM.

---

## 9. Heartbeat / Scheduled Jobs (server/_core/heartbeat.ts)

**Today:** Manus Heartbeat service triggers scheduled jobs.

**Replacement:** Linux cron, GitHub Actions cron, or any external cron service hitting your `/api/cron/*` route protected by a shared secret.

```env
CRON_SHARED_SECRET=…
```

Replace `manus-heartbeat bootstrap …` with a `cron` entry that POSTs to `/api/cron/run-reminders` every 5 minutes.

---

## 10. Email / SMS for MFA

`server/email.ts` already abstracts the email channel. The current driver writes to logs; for production set up SendGrid / Resend / Postmark — they all have OpenAI-style POST APIs.

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_…
```

SMS MFA: use Twilio.

```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=…
TWILIO_AUTH_TOKEN=…
TWILIO_FROM=+31…
```

---

## 11. Deployment

The platform is just **Node.js + Vite + MySQL/TiDB + S3**. It deploys cleanly to:

- Any Linux VM (PM2 / systemd)
- Fly.io, Render, Railway, AWS ECS
- Vercel + a managed Postgres/MySQL

Run book:

```bash
pnpm install
pnpm db:push
pnpm build
NODE_ENV=production node dist/index.js
```

---

## 12. Summary

| Capability | Vendor lock-in? | Replacement effort |
|---|---|---|
| Local login | None | — |
| LLM | OpenAI-compatible | env swap |
| Image gen | Provider-specific body | small refactor |
| Storage | S3-compatible | small refactor |
| Maps | Direct Google Maps | env swap + script load |
| Notifications | Email/Slack | small refactor |
| Voice transcription | OpenAI-compatible | env swap |
| Heartbeat | Standard cron | cron entry |

**Total decoupling effort:** approximately 1-2 dev days. Once those env vars are set, IO SKY runs without any Manus subscription.
