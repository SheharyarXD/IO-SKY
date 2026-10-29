# Client dependencies checklist, 29 October 2026

Status was checked on 29 October with a read-only public DNS lookup and repository inspection. Credentials are never listed here.

| # | What is needed | From | Priority | Blocks | State today |
|---|---|---|---|---|---|
| 1 | MX, SPF, DKIM and DMARC records for iosky.nl at Hostinger (values in `docs/client/ZOHO_MAIL_SETUP_RUNBOOK.md` section 7) | Client | **P0** | Every email test, booking confirmations, routing and Outlook demo (N08 to N10, S08, ACC-20) | iosky.nl shows no MX, SPF, DKIM or DMARC. Only the Zoho verification TXT exists. |
| 2 | iosky.co: verification TXT `zoho-verification=zb74405463.zmverify.zoho.eu`, then MX, SPF, DKIM, DMARC | Client | P1 | AI Sales Outbound sending (O05, O12) | No records at all on iosky.co. |
| 3 | OpenAI credit on the supplied key | Client | **P0** | First live AI Scan analysis (A10), lead evaluation, real generation matrix (A11), adaptive engine testing | Key accepted by provider, account has no credit. |
| 4 | Telephony provider decision, account, number, voice budget | Client | **P0** for voice | R01 to R06, ACC-05 to ACC-17, F-06 to F-11 | No Voice code and no account. Existing Twilio code is SMS only. |
| 5 | Stripe live keys, Stripe Tax registration and tax code confirmation | Client | P0 | Live payments, tax breakdown (B05, B10) | Test mode verified only. |
| 6 | VAT identification number and KvK number for invoice footer and Stripe | Client | P1 | Invoice verification (B08), international intake (B03) | Not supplied. |
| 7 | Decision and approval for AI Receptionist, IVR and Outbound scope and price (M4 workstreams 4.1, 4.2, 4.5) | Client | **P0** | Whether R, O series are baseline or paid | Open. |
| 8 | Written answers to the 11 F items: agent roster (ten SRS examples versus "eight"), meeting-duration policy (75 vs 60 min), calendar provider, recording consent rules, passkey and universal MFA policy | Client | P1 | G12 to G17, S03, S05, R13, Z01 to Z03 | Open. |
| 9 | Remainder of Document 2 (text stopped in section 20) and Document 3 (Executive Briefing) | Client | P1 | X11, X12, the "43 further demonstrations" | Not received. |
| 10 | Video provider account (HeyGen or Synthesia) and generation budget | Client | P2 | X01 to X10 | None. |
| 11 | Calendar provider access (Google or Microsoft) | Client | P2 | S03, S04 | None. |
| 12 | Client-owned GitHub organisation and repository access model | Client | P2 | Z11, Z12, I06, T10 | Not established. |
| 13 | Supabase plan decision and an isolated staging project | Client | P0 | I01, I05, T09, I08 | Open. |
| 14 | Native-speaker review of nine non-English locales | Client | P2 | L01 and L02 to L06 | Not arranged. |
| 15 | Original approved email, WhatsApp and Product Owner messages with dates | Client | P1 | Traceability T01, scope classification of S4 and S5 tasks | Referenced in Document 1 Appendix D and H, none attached. |
| 16 | Mailbox 5 sender address on iosky.co, and the lcorreiad@iosky.nl alias on the existing user | Client | P3 | O12 | Open. |
| 17 | Reference materials for the approved report design (book-style examples, table of contents) | Client | P1 | P01 to P03 | Referenced as "previously delivered"; confirm which files. |
