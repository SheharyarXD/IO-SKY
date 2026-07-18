# IO SKY — MFA Implementation Report

**Track:** Developer Workspace · Step 3 (full multi-factor authentication)
**Date:** 23 May 2026
**Status:** Schema, server, UI, post-login challenge gate, and tests complete.
**Test posture:** 122 / 122 vitest specs green; TypeScript clean; dev server healthy.

---

## 1. Goals

The IO SKY platform needed end-to-end MFA covering everything the master specification calls out for the Developer Workspace, plus the post-login enforcement gate that ties OAuth, the session cookie, and the user's enrolled factors together.

The track had to deliver:

| Capability | Outcome |
| --- | --- |
| TOTP (authenticator app) enrollment, verify, primary-factor switch, delete | Live (tRPC `mfa` router, `TOTPEnrollDialog`) |
| SMS (E.164 phone, 6-digit OTP) enrollment + verify + resend | Live (pluggable sender; Twilio in prod, console in dev) |
| One-shot recovery codes (10 per user) | Live (scrypt-hashed; one redemption = `usedAt` set) |
| Post-login challenge gate: cookie-swap from `mfa_pending` to real session | Live (`/api/mfa/challenge`, `/mfa-challenge`) |
| Failed-attempt lockout + audited security events | Live (5 failures → 5-minute factor lock) |
| Full audit trail in `login_audit` | Live (`reason` namespaced per flow) |
| Vitest coverage of every flow | 122 / 122 green |

---

## 2. Schema

Three tables were added on TiDB via Drizzle (portable to MySQL/Postgres):

```
mfa_factors            -- one row per enrolled factor
mfa_recovery_codes     -- 10 hashed recovery codes per user
mfa_challenges         -- (reserved) audit row per challenge attempt
```

The `mfa_factors` row carries the AES-GCM-encrypted `secret` blob (TOTP secret or JSON-encoded SMS envelope), a public `phoneHint` (last-4 digits only), `verifiedAt`, `primary`, `failedAttempts`, and `lockedUntilMs`.

Recovery codes are stored as `scrypt(code, perRowSalt)` hashes; the plaintext is shown to the user exactly once at enrollment time and is unrecoverable after that.

---

## 3. Crypto

All MFA secrets are protected with envelope encryption:

| Layer | Algorithm | Source |
| --- | --- | --- |
| Key derivation | HKDF-SHA256 | Input: `JWT_SECRET` (already a managed secret) |
| Symmetric encryption | AES-256-GCM | 96-bit IV, 128-bit auth tag |
| Phone hash | salted SHA-256 | Salt: per-record 16-byte random |
| Recovery codes | scrypt | N=2^14, r=8, p=1, 16-byte salt per row |

Functions: `envelopeEncrypt`, `envelopeDecrypt`, `hashPhone`, `generateRecoveryCodes`, `hashRecoveryCode`, `verifyRecoveryCode` in `server/_core/mfaCrypto.ts`.

---

## 4. TOTP flow

```
enrollTotpBegin → otpauth:// URI + factorId (un-verified)
  ↓ user scans in authenticator app
enrollTotpVerify(factorId, 6-digit code)
  ↓ on success
  → mark verifiedAt
  → set primary if it's the user's first verified factor
  → generate + return 10 recovery codes (shown once)
```

Library: `otplib` v13 (functional API: `generateSecret`, `generateURI`, `verifyToken`). The verify step uses constant-time compare and a ±1-window tolerance for clock drift.

UI: `client/src/pages/developer-workspace/components/TOTPEnrollDialog.tsx` renders the QR code with `qrcode`, exposes the manual secret as a fallback, and shows the recovery codes on a "store them now" panel.

---

## 5. SMS flow

```
enrollSmsBegin(phone, label?)
  → validate E.164
  → generate 6-digit OTP, encrypt envelope { phone, pendingCode, pendingExpiresAt }
  → store factor as un-verified
  → SmsSender.sendOtp({to, code, body})
enrollSmsVerify(factorId, code)
  → constant-time compare against pendingCode
  → if expired or wrong: bumpMfaFactorFailure, lock after 5 misses
  → on success: mark verified, set primary if first, issue recovery codes
requestSmsCode(factorId)
  → re-mint OTP for an already-pending SMS factor
```

The pluggable sender (`server/_core/smsSender.ts`) auto-selects the Twilio adapter when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER` are present, otherwise falls back to the console sender which masks the OTP in the log.

UI: `SMSEnrollDialog.tsx` walks the user through phone → OTP → recovery codes with a resend control.

---

## 6. Post-login challenge gate

This is the headline piece of Step 3d. After a successful OAuth callback we no longer set the long-lived session cookie immediately — instead:

```
OAuth callback
  ├── if user has at least one VERIFIED factor:
  │     issue io_sky_mfa_pending cookie (signed JWT, typ="mfa_pending", TTL 5 min)
  │     redirect 302 → /mfa-challenge?next=<destination>
  │
  └── otherwise:
        issue real session cookie, redirect to role destination
```

The `/mfa-challenge` page polls `GET /api/mfa/challenge/status` to discover which factors the pending user has, then the user picks a factor and submits a code (or a recovery code) to `POST /api/mfa/challenge`.

On success, the route:

1. Verifies the code (TOTP via `verifyChallengeCode`, SMS via the envelope's `pendingCode`/`pendingExpiresAt`, or burns one unused recovery row).
2. Clears the pending cookie (`maxAge: 0`).
3. Mints a real `sdk.createSessionToken` and sets it under `COOKIE_NAME`.
4. Writes a success row to `login_audit` (`reason: "mfa_challenge_passed (factor=totp)"` / `_via_recovery`).
5. Returns 200 with the sanitised `next` destination so the SPA can route there.

On failure, the route bumps `failedAttempts` and locks the factor for 5 minutes after the fifth miss, writing the failure to `login_audit`.

---

## 7. Security controls

| Concern | Control |
| --- | --- |
| Replay attacks | TOTP relies on the 30-second window; SMS codes carry `pendingExpiresAt` (5 min) and are wiped on success. |
| Stale pending cookie | `mfa_pending` JWT has a 5-minute exp; `verifyMfaPending` rejects anything older or with a non-`mfa_pending` `typ`. |
| Hostile redirect | `sanitiseNext` requires the `next` path to start with `/` and not `//`. |
| Brute force | 5 consecutive failures → factor locked for 5 minutes. |
| Recovery code reuse | Each row carries `usedAt`; verification reads only unused rows and marks the redeemed row used inside the same transaction. |
| Cookie smuggling | The challenge route swaps cookies atomically; the original session cookie is overwritten with `maxAge: 0` on the OAuth side before redirect. |
| Cross-user factor use | Route compares `factor.userId` against the pending JWT's `userId`; mismatch returns 404. |
| Audit trail | Every TOTP enroll, SMS enroll, challenge attempt, recovery redeem, and admin-notify event writes to `login_audit` with a namespaced `reason`. |

### Lockout escalation

On the fifth consecutive failure for a factor the route stamps `lockedUntilMs = now + 5min`. Subsequent attempts short-circuit with HTTP 429 `factor_locked`. The lockout window is intentionally short — a malicious actor still has to win a brute-force race inside one OAuth pending window (5 min), and the failure trail in `login_audit` is searchable.

Admin alerts on lockouts are wired through the existing audit channel (every failure already lands in `login_audit`, which the admin Bookings + Security overview reads). A dedicated `notifyOwner` push on lockout is intentionally deferred to Step 3e (admin MFA management UI) to keep the volume reasonable; the current behaviour is "audit, never silent fail".

---

## 8. Test coverage

| Spec file | Tests | What it proves |
| --- | --- | --- |
| `server/mfaCrypto.test.ts` | 4 | Envelope round-trip, phone hash determinism, recovery code generation + verify, tampered ciphertext is rejected. |
| `server/mfaTotp.test.ts` | 2 | otplib functional integration: generated secret + URI match, verify accepts a fresh token and rejects garbage. |
| `server/mfa.test.ts` | 12 | TOTP enroll/verify, SMS enroll/verify, list/delete/set-primary, regenerate recovery codes, redeem recovery code, lockout after 5 misses. |
| `server/mfaChallenge.test.ts` | **14 (new)** | `verifyChallengeCode` pure unit (TOTP + SMS + expiry + non-verified factor), `POST /api/mfa/challenge` happy path, wrong-code failure path, factor-locked path, wrong-owner path, recovery code one-shot + replay denial, status endpoint factor list. |

Run: `pnpm test` → **122 / 122 green**, TypeScript clean.

---

## 9. Files added / changed

| File | Purpose |
| --- | --- |
| `drizzle/schema.ts` | `mfa_factors`, `mfa_recovery_codes`, `mfa_challenges` tables. |
| `server/_core/mfaCrypto.ts` | AES-256-GCM envelope, HKDF, phone hash, recovery code generation/verify. |
| `server/_core/mfaTotp.ts` | otplib v13 wrappers. |
| `server/_core/smsSender.ts` | Pluggable SMS abstraction with Twilio + console adapters. |
| `server/_core/mfaChallenge.ts` | Short-lived `mfa_pending` JWT (sign/verify) + `sanitiseNext`. |
| `server/_core/mfaChallengeRoute.ts` | Express `POST /api/mfa/challenge` + `GET /api/mfa/challenge/status`. |
| `server/_core/oauth.ts` | MFA detection + redirect to `/mfa-challenge` when factors exist. |
| `server/_core/index.ts` | Mounts `registerMfaChallengeRoutes(app)`. |
| `server/routers/mfa.ts` | tRPC `mfa.*` router (enroll/verify/list/delete/setPrimary/regenerate/redeem). |
| `server/db.ts` | MFA helpers (getMfaFactorById, listVerifiedMfaFactorsForUser, bumpMfaFactorFailure, clearMfaFactorFailure, listUnusedRecoveryCodesForUser, markRecoveryCodeUsed, replaceMfaRecoveryCodes, …). |
| `client/src/pages/developer-workspace/components/TOTPEnrollDialog.tsx` | QR-based TOTP enrollment dialog. |
| `client/src/pages/developer-workspace/components/SMSEnrollDialog.tsx` | Phone → OTP enrollment dialog. |
| `client/src/pages/developer-workspace/sections/DeveloperSecurity.tsx` | Factor list, add/remove, recovery code regen, audit timeline. |
| `client/src/pages/MfaChallenge.tsx` | Post-login challenge page at `/mfa-challenge`. |
| `client/src/App.tsx` | Registers the `/mfa-challenge` route. |
| `server/mfaChallenge.test.ts` | 14 specs for the challenge route + helper. |

---

## 10. Known follow-ups (deferred, tracked)

1. **Client Portal enrollment UI.** Today only the Developer Workspace surfaces TOTP/SMS dialogs. The Client Portal Security Center still exposes only the legacy "email-MFA" toggle. The backend (`mfa.*` router) is role-agnostic and ready — we just need to drop the same dialogs into `client/src/pages/client-portal/sections/Security.tsx`.
2. **Admin MFA management.** A small admin surface to inspect a user's factors, see lockouts, reset failed counters, and force-disable a factor is the natural next step. The data is already in `mfa_factors` + `login_audit`.
3. **Push-style `notifyOwner` on lockout.** Currently lockouts only show up in `login_audit`. A targeted owner notification on the 5th consecutive failure would shorten incident-response time.
4. **Forced re-enrollment on suspicious activity.** The challenges table reserves a row per attempt, ready to be promoted into a "trusted device" model.
5. **WebAuthn / passkeys.** Out of scope here, but `mfa_factors.kind` is an open enum — a third value `webauthn` would slot in cleanly.

---

## 11. Verification log

```
$ cd /home/ubuntu/io-sky && pnpm test
 Test Files  10 passed (10)
      Tests  122 passed (122)
TypeScript: clean
Dev server: running on port 3000
```
