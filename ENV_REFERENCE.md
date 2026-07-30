# IO SKY — Environment Variable Reference (deprecated — see ENV_TEMPLATE.txt)

**This file is deprecated as of the Phase 1 repository cleanup and is kept only so old
links don't 404.** It previously disagreed with the actual code in two places (SMTP
variable shape, S3 variable naming) and documented several variables with zero code
references. **`ENV_TEMPLATE.txt` at the repo root is now the single authoritative
source** for every environment variable this application actually reads.

## What changed and why

- SMTP: this file documented `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`. The real
  code (`server/email.ts:69`) only ever reads a single `SMTP_URL` connection string.
  `ENV_TEMPLATE.txt` was already correct on this point.
- S3: this file documented `S3_ACCESS_KEY`/`S3_SECRET_KEY`. `ENV_TEMPLATE.txt` uses the
  correct AWS-standard names (`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`) — though note
  neither shape is actually read by any code path today; storage is still 100%
  Forge-proxy-backed. See `ENV_TEMPLATE.txt`'s OBJECT STORAGE section.
- The following variables documented here have **zero references anywhere in the
  codebase** and were removed from the authoritative template rather than carried
  forward as if they did something: `TRUST_PROXY`, `BOOKING_ADAPTER` and its four
  calendar-adapter companions (`GOOGLE_CALENDAR_CLIENT_ID`/`_SECRET`,
  `MICROSOFT_GRAPH_CLIENT_ID`/`_SECRET`, `CALCOM_API_KEY`), `OWNER_NOTIFY_WEBHOOK`,
  `HEARTBEAT_MODE`. None of these have a code path behind them — setting them does
  nothing. If any of this functionality is built in a future milestone, it should be
  reintroduced into `ENV_TEMPLATE.txt` at that point, alongside the code that reads it.
- `VITE_APP_TITLE`/`VITE_APP_LOGO` are commented out (not deleted) in the template for
  the same reason — no current code path reads either one.

**Go to `ENV_TEMPLATE.txt` for the current, accurate list.**
