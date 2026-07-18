---
title: "IO SKY — Manus Independence Map"
author: "Manus AI"
date: "2026-06-03"
---

# IO SKY — Manus Independence Map

This document lists **every dependency the IO SKY platform currently has on the Manus runtime**, together with the purpose, concrete replacement options, and the exact migration path for each. The goal is unambiguous: the codebase can be lifted to any third-party host without losing functionality. Where a dependency is just an HTTP call to a Manus-managed proxy, the migration path is usually a one-file change.

## 1. Forge LLM Proxy — `server/_core/llm.ts`

Today the `invokeLLM()` helper posts chat completions to `${BUILT_IN_FORGE_API_URL}/v1/chat/completions` with `Authorization: Bearer ${BUILT_IN_FORGE_API_KEY}`. The Manus proxy normalises model routing and billing across OpenAI, Anthropic and others, and the request payload mirrors the OpenAI Chat Completions schema. Replacement requires swapping a single base URL and a single bearer token. Recommended targets are direct OpenAI (`https://api.openai.com/v1/chat/completions` with an `OPENAI_API_KEY`), Anthropic Messages API (slightly different payload shape — add a thin adapter), or an open-weights provider such as Together AI or Groq. Migration time is roughly one hour: edit `llm.ts` to read `OPENAI_API_KEY` and `OPENAI_API_BASE`, replace the two env reads, run the existing tests, done.

## 2. Forge Image Generation — `server/_core/imageGeneration.ts`

`generateImage()` posts to `${BUILT_IN_FORGE_API_URL}/v1/images/generate` and returns a hosted URL. Replacement is straightforward with OpenAI Images (`/v1/images/generations`), Replicate (Stable Diffusion family), or Together AI's FLUX endpoint. The platform stores the resulting URL into the database, so as long as the returned URL is permanent or you persist the bytes via the storage layer the rest of the code is unaffected. Migration time: one to two hours.

## 3. Forge Voice Transcription — `server/_core/voiceTranscription.ts`

`transcribeAudio()` calls `${BUILT_IN_FORGE_API_URL}/v1/audio/transcriptions`. The native target is OpenAI Whisper (`/v1/audio/transcriptions`) which is the same wire format — only the base URL and key need to change. Alternative providers are Deepgram and AssemblyAI which need a thin response-shape adapter. Migration time: under one hour.

## 4. Forge Storage Proxy — `server/storage.ts` plus `server/_core/storageProxy.ts`

`storagePut()` uploads bytes through the Manus storage proxy and returns a stable `key` that the rest of the platform stores in the database. Downloads go through `/manus-storage/{key}` which the server redirects to a short-lived signed URL. The migration target is **direct S3/R2** using the `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages that are already in `package.json`. The replacement is a drop-in `storagePut/storageGet` implementation that signs URLs against your own S3-compatible bucket and serves `/manus-storage/{key}` as a 307 redirect to the presigned download URL. Recommended providers are Cloudflare R2 (cheapest, no egress), Backblaze B2 (cheap), or AWS S3 (most ecosystem support). Migration time: half a day including testing the upload flows.

## 5. Forge Maps Proxy — `server/_core/map.ts`

`makeRequest()` for Google Maps APIs is proxied through Manus to avoid exposing the API key on the frontend. The replacement is the standard Google Maps Platform setup: provision a Google Cloud API key, restrict it to your domain in the GCP console, and either expose it directly to the frontend (with referrer-locked restrictions) or keep the same proxy pattern using your own Express handler. The component `client/src/components/Map.tsx` does not need to change. Migration time: one hour.

## 6. Forge Notifications — `server/_core/notification.ts`

`notifyOwner({ title, content })` pushes operational alerts to the project owner via the Manus mobile/email channel. The migration target is your own notification stack: SendGrid or Postmark for owner email, Twilio for SMS to the founder, and optionally a Slack incoming webhook for the operations channel. The function signature stays identical so every call site (admin user activity, booking confirmations, AI Scan completions) continues to work unchanged.

## 7. Manus OAuth Portal — `server/_core/oauth.ts` plus `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, `OAUTH_SERVER_URL`

The platform supports two parallel auth flows: **Manus OAuth** (production) and **local email/password** (already implemented end to end with bcrypt, MFA, audit logging, and rate limiting in `server/_core/localAuthRoute.ts`). For a fully independent deployment, simply rely on the local-auth flow and stop exposing the "Sign in with Manus" button. No code needs to be deleted — the local flow is feature-complete and is what powers the seeded admin and client accounts today. If you later want a hosted identity provider, the Manus OAuth client is structured around standard OAuth 2.0 + PKCE so it can be repointed at Auth0, Clerk, WorkOS, or Keycloak by changing the three env vars and adjusting `parseState()`.

## 8. Heartbeat / Scheduled Tasks — `server/_core/heartbeat.ts`

The platform's heartbeat helper pings Manus to register scheduled jobs (recurring AI scans, reminder emails, MFA secret rotation hints). On an independent host the migration target is a standard **node-cron** or **BullMQ** worker. The wrapper signature is small enough to re-implement in a single file. A pragmatic minimum is `node-cron` in the same Express process for low-volume jobs; for higher volume a Redis-backed BullMQ worker is the standard choice.

## 9. Built-In Data API — `server/_core/dataApi.ts`

`dataApi.ts` proxies Manus's external data hub for things like enriched company lookups. None of the four core platform workflows (Free AI Scan, Paid AI Scan, Strategy Call, Proposal) depend on `dataApi.ts` for their critical path — it is an enrichment helper. On an independent host the migration target is whichever data vendor you choose for enrichment (Clearbit, Lusha, Apollo). The function can also be safely left stubbed.

## Environment Variable Migration Matrix

The following table is the authoritative checklist of every env var the codebase reads. The "Manus-managed" column indicates whether Manus auto-injects the variable today; the "Independent host" column gives the equivalent variable name you should provision yourself.

| Variable | Purpose | Manus-managed | Independent host equivalent |
|---|---|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string | Yes | PlanetScale, AWS RDS MySQL, DigitalOcean Managed MySQL |
| `JWT_SECRET` | Signs session + MFA + staging cookies | Yes | Generate with `openssl rand -hex 32` |
| `OAUTH_SERVER_URL` | Manus OAuth backend | Yes | Remove if using local-auth only |
| `VITE_APP_ID` | Manus OAuth application id | Yes | Remove if using local-auth only |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal | Yes | Remove if using local-auth only |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Owner identity for notifications | Yes | Replace with your own admin user id |
| `BUILT_IN_FORGE_API_URL` | Forge proxy base URL | Yes | `OPENAI_API_BASE`, image+voice providers as documented above |
| `BUILT_IN_FORGE_API_KEY` | Forge proxy server token | Yes | `OPENAI_API_KEY`, provider keys per service |
| `VITE_FRONTEND_FORGE_API_KEY` | Forge proxy frontend token | Yes | Only needed for direct frontend LLM calls — IO SKY does not use this pattern |
| `VITE_FRONTEND_FORGE_API_URL` | Forge frontend URL | Yes | Same as above |
| `STAGING_MODE` | Enables staging gate (server side) | No | Set yourself in any host |
| `VITE_STAGING_MODE` | Enables noindex meta on client | No | Set yourself in any host |
| `STAGING_PASSWORD` | Pre-launch screen passphrase | No | Set yourself; rotate when sharing |
| `STAGING_SECRET` | Optional staging-cookie HMAC secret | No | Defaults to JWT_SECRET if unset |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | MFA SMS sender | No | Provision your own Twilio account |

## Code Ownership Confirmation

The entire codebase under `/home/ubuntu/io-sky` is **standard open-source TypeScript** with no proprietary Manus runtime calls baked into the framework itself. The "Manus-ness" of the platform lives exclusively in the seven adapters listed above plus the env vars. Replacing them does not require restructuring routes, the database schema, the tRPC layer, the auth middleware, the staging gate, or any UI. Every file in the project is yours to edit, host, fork, or migrate, including the framework files under `server/_core/`. There is no license restriction on the application code.

## 10. AI Scan Report PDF — `server/aiScanReportPdf.ts`

The AI Scan PDF export is rendered server-side with **`pdfkit`**, an ordinary open-source npm package with no Manus dependency. The only platform touch-point is the storage layer (section 4): the generated bytes are uploaded via `storagePut()` and the cached key is persisted in `ai_scans.reportPdfKey`. On an independent host the PDF generation works unchanged; only the storage adapter needs the S3/R2 swap already described. There is nothing Manus-specific in the report layout, fonts, or generation path.

## 11. Transactional Email Localisation — `server/email.ts` plus `server/email-i18n.ts`

The three transactional emails (booking, contact, engineering-access) are localised into nine locales (EN, NL, DE, FR, ES, IT, AR with RTL, ZH, JA) entirely in application code — the translation tables live in `server/email-i18n.ts` and carry no runtime dependency. Email **delivery** itself uses the notification/email channel covered in section 6; swapping to SendGrid or Postmark does not affect the localisation layer. The locale is passed from the frontend and falls back to English.

## 12. Owner / Admin MFA — `mfa.*` procedures and Admin Security Center

Multi-factor authentication (TOTP + SMS) is implemented in standard application code with bcrypt-hashed secrets, audit logging, and the SMS channel backed by Twilio (env vars in the matrix). The Round 6 addition of an **Admin Security Center** (`client/src/pages/admin/sections/AdminSecurityCenter.tsx`) simply reuses the existing portal-agnostic `mfa.*` tRPC procedures, so it introduces no new Manus dependency. On an independent host, MFA continues to work as long as Twilio (or any SMS provider you adapt) is provisioned for the SMS factor; TOTP needs no third party at all.

## Recommended Migration Order

If you decide to leave Manus entirely, the lowest-risk order is the following: provision your own MySQL/TiDB and copy the schema with `pnpm db:push`, swap storage to R2/S3 (largest impact on user-facing flows), swap LLM to direct OpenAI (highest cost lever), swap voice + image to direct OpenAI (cheap, easy), replace the notification helper with SendGrid or Postmark, optionally re-implement heartbeat with node-cron, and finally retire the OAuth integration in favour of the already-shipped local-auth flow. End-to-end, an experienced developer can complete this migration in two to three working days. A more conservative schedule is one week of staged cut-overs with a parallel run of the old and new providers during each transition.
