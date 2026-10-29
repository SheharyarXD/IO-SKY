# Audit evidence index

## 1. Source documents

| Document | Location | Read this session |
|---|---|---|
| Consolidated Clarifications v1.3 | `IO_SKY_Platform_Final_Consolidated_Developer_Clari_261029_050646.pdf` (repo root, untracked) | Yes, all pages |
| Additional Functional Clarifications (Doc 2) | Pasted into the conversation only | Sections 1 to 20 (truncated in transit) |
| Executive Briefing Specification (Doc 3) | **Not provided anywhere** | No |
| Master SRS v1.1 | `Master_SRS_v1.1_RELEASE_CANDIDATE_DEVELOPER_BASELINE (1) (1).pdf` | **No.** Clause and page references from the 15 Oct reconciliation |
| 15 Oct reconciliation | `docs/scope-reconciliation/` (summary JSON, remaining baseline, agents audit, traceability CSV 539 rows, SRS clause coverage CSV, source register) | Read: summary, remaining baseline (first half), agents audit (most) |
| 21 Oct client reply, SRS scope verification | `docs/client/CLIENT_REPLY_2026-10-21.md`, `SRS_SCOPE_VERIFICATION_2026-10-13.md` | Read in earlier sessions |
| M4 Finalised Scope (29 Sep), M4 Extension Proposal (13 Oct), delivery report, 155-item checklist | `docs/client/`, `SRS_CHECKLIST.md`, `MILESTONE4_CHECKLIST.md` | Cited via prior documents; not re-read |
| Original three-milestone plan, AI Receptionist playbook, IVR spec, Outbound spec, Notification Center spec | `Phase 4 pdfs/`, `IO Sky project UI documents/` (IVR, Receptionist files exist) | Not re-read; cited via the 15 Oct agents audit |

Missing source documents that the 29 October text depends on: Document 3; tail of Document 2; any priced agreement for adaptive scan, Executive Briefing, report design system, redesign; the dated email and WhatsApp messages referred to in Appendix D and H; the original three-milestone plan; the exact "eight agent" list.

## 2. Repository evidence used (commit `c5bf579`)

AI: `server/aiGovernance.ts`, `server/_core/llm.ts`, `server/_core/llmUsage.ts`, `shared/modelRouting.ts`, `server/leadEvaluation.ts`, `server/_core/aiScanScoring.ts`, `server/db/srsGovernance.ts`.
Voice and messaging: `server/_core/smsSender.ts` (Twilio Messages only). Grep for VoiceResponse, TwiML, Gather, calls.create returned no matches in server, shared or client.
Scan: `shared/aiScanQuestionnaire.ts` (fixed 7, 18, 35 question bank, lines 10 to 12), `server/routers/aiScans.ts`, `server/aiScanReportPdf.ts`, `client/src/pages/AIScanResult.tsx`, `server/db/srsDelivery.ts`.
Security: `server/routers/mfa.ts` (TOTP only; no WebAuthn or passkey code found), `server/_core/trpc.ts`, `server/routers/ops.ts`, `server/db/platformGovernance.ts`, `server/db/developerWorkspace.ts`.
Billing: `server/_core/stripe.ts`, `server/paymentSync.ts`. No VIES or KvK fields found.
Revenue: `server/routers/admin.ts:387`.
Localisation: `client/src/lib/i18n/{en,nl,de,fr,es,it,pt,ar,zh,ja}.ts`, `client/src/contexts/LanguageContext.tsx` (sets `dir` for RTL). Pages under `client/src/pages/{admin,client-portal,developer-workspace,ops}` contain no translation-hook usage (grep for useLanguage, useTranslation, t() returned zero).
Email: `server/emailShell.ts`, `server/notificationDispatcher.ts`, `shared/notificationCatalogue.ts`, `docs/client/ZOHO_MAIL_SETUP_RUNBOOK.md`.
Booking: `server/routers/bookings.ts`, `server/db/bookings.ts`.
Operations: `docs/BACKUP_AND_RECOVERY.md`, `server/_core/healthRoute.ts`, `railway.toml`.
Absent by search: passkeys or WebAuthn, VIES, KvK, HeyGen or Synthesia, recording or transcript storage, calendar provider SDKs, Admin presets, manual template sending, team table, message thread tables.

## 3. Verification run on 29 October

* `npx vitest run` locally: 91 files passed, 2 skipped; 1,155 tests passed, 15 skipped, 0 failed (output saved in the system temp directory). CORRECTED 29 October (later): the shell had no `DATABASE_URL` but `.env` is loaded by the test files, so the live-database suites ran against the project's Supabase database; only legal and requireAcceptances skipped (the 15 skipped tests). With `DATABASE_URL=` blank the suite gives 1,255 passed, 57 skipped, 0 failed. Typecheck and lint were not re-run.
* Public DNS (Google resolver): iosky.nl has no MX and no SPF, and `_dmarc` and `zmail._domainkey` do not exist; only `zoho-verification=zb72195517.zmverify.zoho.eu` is present. iosky.co returns no MX or TXT.
* Not run (needs credentials, paid APIs, or production access): live AI call, telephony, Stripe live mode, email delivery, restore, load tests.

## 4. How the register was built

1. Read Document 1 chapter by chapter and appendices A to H; listed each distinct behaviour once, ignoring the repetition of the same bullet in the chapter, the "Integrated explicit requirements" block, Appendix E and Document 2.
2. Checked each behaviour against the repository by search and by reading the named files.
3. Classified status with the A to F codes and scope with S1 to S6, using the SRS references from the 15 Oct reconciliation.
4. Estimated hours per task (low, likely, high) and QA hours; totals in `EXECUTIVE_AUDIT_SUMMARY.md` are computed by script from the CSV (188 rows, no duplicate IDs).

## 5. Duplicates removed while drafting (11)

Verification states surfaced in handover merged into R11; playbook versioning merged into G06; duplicate-event protection merged into S07; per-agent operator scope merged into G09; review-versus-publish permission merged into P07; verification rate limit and replay merged into R11; document matrix fail-open merged into J11; Billing Admin scoping merged into Z06; briefing later-purchase merged into X08; international intake merged into B03; delivered dashboard tasks merged into O14 and the existing 155 criteria. Shared services are counted once: notification dispatcher, agent runtime G03, provider adapter R01.

## 6. Acceptance scenario counts

Document 1 lists ACC-01 to ACC-36 (36) and F-01 to F-34 (34): 70 stated. These F cases repeat an ACC case: F-01, 03, 04, 06, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 27, 29, 32, 33 (25). Unique: 36 + 9 = **45**, a judgement count. The "43 further demonstrations" and "16 Executive Briefing acceptance requirements" in the brief could not be verified (Document 2 tail and Document 3 unavailable). The F-34 case is a process rule, not a test.

## 7. Conflicts and version issues found

* Document 1 cover says Version 1.3, 29 October; page footers, control table and closing text say Version 1.0, 28 October; text refers to "Appendix I" that has been merged in.
* MFA mandatory for all five roles (Doc 1 section 4) versus BR-014 (mandatory for three roles, Developers encouraged, Clients may be required).
* "Eight agents" versus ten SRS examples.
* Three paid scans in Doc 1 versus a "free" tier in `shared/aiScanQuestionnaire.ts`.
* Meeting duration 75 versus 60 minutes (open since 13 October).
* Doc 1 says a short statement elsewhere must not weaken an explicit requirement, and also that the document does not replace the SRS or milestones. Both can be true only if each disputed item is reconciled individually.
