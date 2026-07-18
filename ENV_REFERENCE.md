# IO SKY — Environment Variable Reference

This document describes every environment variable used by IO SKY and how to swap providers when running without Manus. Actual values must be configured through the secrets management UI; this file is documentation only.

## Required core variables

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | MySQL/TiDB connection string. Format: `mysql://user:pass@host:port/db?ssl={"rejectUnauthorized":true}` | Auto-injected | Any MySQL 8 / TiDB / PlanetScale instance |
| `JWT_SECRET` | Yes | 32+ char random secret. Signs session cookies, impersonation tokens and HMAC booking action tokens. Rotate carefully — invalidates all sessions and pending booking links. | Auto-injected | Generate with `openssl rand -base64 48` |
| `VITE_APP_TITLE` | Yes | Browser tab title and email "from" name. | Auto-injected | Any string (e.g. `IO SKY`) |
| `VITE_APP_LOGO` | No | Override default logo URL. | Auto-injected | Public HTTPS URL to a PNG/SVG |

## LLM and image generation

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `BUILT_IN_FORGE_API_URL` | Yes | Base URL of an OpenAI-compatible chat completions endpoint. The helper appends `/v1/chat/completions`. | Manus Forge | `https://api.openai.com` / Azure OpenAI / OpenRouter / Together |
| `BUILT_IN_FORGE_API_KEY` | Yes | Bearer token for the LLM endpoint. | Manus Forge | `sk-...` from your provider |
| `VITE_FRONTEND_FORGE_API_URL` | No | Frontend-side LLM URL. Only required if the browser calls LLM directly. | Manus Forge | Same as above, restricted-scope key |
| `VITE_FRONTEND_FORGE_API_KEY` | No | Frontend-side bearer token. Keep limited scope. | Manus Forge | Restricted key |

## Object storage

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `S3_ENDPOINT` | If standalone | S3-compatible endpoint URL. | Not used (Forge proxy) | `https://s3.eu-west-1.amazonaws.com` or MinIO endpoint |
| `S3_BUCKET` | If standalone | Bucket name. | Not used | `io-sky-prod` |
| `S3_ACCESS_KEY` | If standalone | Access key id. | Not used | AWS IAM access key |
| `S3_SECRET_KEY` | If standalone | Secret access key. | Not used | AWS IAM secret |
| `S3_REGION` | If standalone | Region. | Not used | `eu-west-1` |

When `S3_*` are set, `server/storage.ts` should be updated to use the AWS SDK directly instead of the Forge proxy. See `INDEPENDENCE_AUDIT.md` for the diff.

## Authentication

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `OAUTH_SERVER_URL` | Optional | Manus OAuth backend. Set to empty to disable SSO. | Auto-injected | Leave empty; users sign in via `/api/auth/local/login` |
| `VITE_OAUTH_PORTAL_URL` | Optional | Manus login portal URL for the frontend. | Auto-injected | Leave empty |
| `VITE_APP_ID` | Optional | Manus OAuth application id. | Auto-injected | Leave empty |
| `OWNER_OPEN_ID` | Optional | OAuth open id of the default super admin (used by the OAuth callback to auto-promote). | Auto-injected | Leave empty; promote via SQL `UPDATE users SET role='admin' WHERE email='...'` |
| `OWNER_NAME` | Optional | Default owner display name. | Auto-injected | Leave empty |

## Notifications

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | If standalone | SMTP server hostname. | Not used (Forge notification channel) | `smtp.resend.com`, `smtp.postmarkapp.com`, `email-smtp.eu-west-1.amazonaws.com` |
| `SMTP_PORT` | If standalone | SMTP port. | Not used | `587` for STARTTLS, `465` for TLS |
| `SMTP_USER` | If standalone | SMTP user. | Not used | API user or username |
| `SMTP_PASS` | If standalone | SMTP password. | Not used | API key |
| `SMTP_FROM` | If standalone | From address used by booking and admin notification emails. | Not used | `IO SKY <ops@iosky.com>` |
| `OWNER_NOTIFY_WEBHOOK` | Optional | Slack/Teams incoming webhook for `notifyOwner`. | Not used | `https://hooks.slack.com/...` |

## Booking adapter

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `BOOKING_ADAPTER` | No | Selects the active booking backend. Valid: `native` (default), `google`, `microsoft`, `calcom`. | `native` | `native` (recommended); other values require implementing the corresponding adapter |
| `GOOGLE_CALENDAR_CLIENT_ID` | If adapter=google | OAuth client id for Google Calendar. | — | From Google Cloud Console |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | If adapter=google | OAuth client secret. | — | From Google Cloud Console |
| `MICROSOFT_GRAPH_CLIENT_ID` | If adapter=microsoft | Azure AD app id. | — | From Azure portal |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | If adapter=microsoft | Azure AD secret. | — | From Azure portal |
| `CALCOM_API_KEY` | If adapter=calcom | Cal.com API key. | — | From your Cal.com workspace |

## Analytics and observability

| Key | Required | Description |
| --- | --- | --- |
| `VITE_ANALYTICS_ENDPOINT` | No | Optional beacon endpoint for page-view tracking. |
| `VITE_ANALYTICS_WEBSITE_ID` | No | Site identifier for analytics service. |

## Heartbeat / cron

| Key | Required | Description | Manus-default | Standalone replacement |
| --- | --- | --- | --- | --- |
| `HEARTBEAT_MODE` | No | `manus` (default) or `node-cron`. | `manus` | Set to `node-cron` and the heartbeat module starts an in-process scheduler. |

## Operational notes

- Rotating `JWT_SECRET` invalidates every active session, every impersonation token, and every outstanding HMAC-signed cancel/reschedule booking link in delivered emails. Schedule a maintenance window.
- The frontend reads only variables prefixed with `VITE_`. Never put secrets behind a `VITE_` prefix unless they are intentionally public (logo URLs, public app ids).
- Local-password authentication does not require any Manus variable. Seeded accounts work as soon as `DATABASE_URL` and `JWT_SECRET` are set.
- For production deployment behind a reverse proxy, set `TRUST_PROXY=1` so Express trusts `X-Forwarded-*` headers for cookie security flags.
