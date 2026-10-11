# IO SKY email setup on Zoho Mail: runbook

Written for the person who administers the Zoho account. Prepared 11 October 2026.
Menu names in Zoho change over time, so check them against the current Zoho help if one is missing.

## 1. Mailboxes and aliases

Five paid users. Everything else is an alias, so it costs nothing extra.

| User (licence) | Aliases on this user | Server side folder per address |
|---|---|---|
| General | support@, contact@, info@, no-reply@ | Support, Contact, Info |
| Technical | projects@, development@, engineering@ | Projects, Development, Engineering |
| Sensitive | security@, privacy@, billing@ | Security, Privacy, Billing |
| Personal | the personal @iosky.nl address | none |
| Outbound | personal address on iosky.co | none |

no-reply@ is an alias of the General user and has no folder. It exists only so the platform may send as it.
Replies to it land in the General inbox, so platform emails carry a Reply-To of support@.

## 2. Add the aliases

Zoho Mail Admin Console, Users, select the user, Email Aliases, add each address.
The domain must be verified first (Domains, iosky.nl, verified). Do the same for iosky.co on the Outbound user.

## 3. Folders and filters, on the server

Filters are stored per mailbox in Zoho, not in Outlook, and they run when mail arrives, so Outlook only shows the result.

For each of the three shared users (General, Technical, Sensitive), signed in as that user:

1. Settings, Folders, create one folder per address (Support, Contact, Info and so on).
2. Settings, Filters, New filter. Name it after the address.
3. Condition: **To** contains `security@iosky.nl`. Add a second condition with **Cc** contains the same address, joined by OR, so copied mail is filed too.
4. Action: **Move to folder** Security.
5. Save, then repeat for each address of that user.
6. Order the filters so none of them stops processing others, and leave "keep a copy in Inbox" off.

Check: send a test message to each alias from an outside address and confirm it lands in the right folder.

## 4. Make Outlook see the same folders

For each user, Zoho Mail, Settings, Mail Accounts, IMAP Access: **enable IMAP**.
IMAP is not available on the free plan, so the paid plan is required.

If two factor authentication is on (it should be), create an app password:
Zoho Accounts, Security, App Passwords, generate one named "Outlook". Use it as the Outlook password.

Outlook settings per account:

| Setting | Value (EU data centre) | Value (global data centre) |
|---|---|---|
| Incoming IMAP | imap.zoho.eu, port 993, SSL | imap.zoho.com, port 993, SSL |
| Outgoing SMTP | smtp.zoho.eu, port 465 SSL (or 587 STARTTLS) | smtp.zoho.com, port 465 SSL |
| Username | the full primary address of that user | same |

The data centre is visible in the address bar when signed in to Zoho Mail (zoho.eu or zoho.com).
In Outlook, enable "Show all folders" so the server side folders appear, and subscribe to them.

## 5. Reply as the alias

Zoho Mail, Settings, Mail Accounts, **Send Mail As**: confirm each alias is listed as a sending address.
In Zoho webmail, replying picks the alias the message was sent to.

In Outlook with IMAP, the From field only offers addresses it knows. Two options, to be tested during setup:

1. Add each alias as an additional email address on the same Outlook account, or
2. Add the alias as its own account entry using the same SMTP server and the same app password.

Replying with the alias in the From field works because Zoho accepts any alias of the signed in user.

## 6. Platform sending (no-reply@iosky.nl)

The platform sends over SMTP as the General user, From no-reply@iosky.nl, Reply-To support@iosky.nl.
Development needs, through a private channel:

- SMTP host and port (see section 4)
- the SMTP username (the General user address) and an app password
- confirmation that no-reply@iosky.nl exists as an alias on that user

Development then sets them as Railway variables and sends a test message.
Zoho limits how many messages a mailbox may send per day, so platform email must stay well inside that limit.

## 7. DNS records (values read from the Zoho console on 11 October 2026)

The organisation uses the **Zoho EU data centre** and the DNS host for both domains is **Hostinger**. Add these at Hostinger,
DNS Zone, for each domain. Use the lowest TTL offered while setting up.

### iosky.nl (domain verified on 13 August 2026, MX still to be pointed)

| Type | Host | Priority | Value |
|---|---|---|---|
| MX | @ | 10 | mx.zoho.eu |
| MX | @ | 20 | mx2.zoho.eu |
| MX | @ | 50 | mx3.zoho.eu |
| TXT (SPF) | @ | | v=spf1 include:zohomail.eu ~all |
| TXT (DKIM) | zmail._domainkey | | the value shown in Zoho, Domains, iosky.nl, Email configuration, DKIM |
| TXT (DMARC) | _dmarc | | v=DMARC1; p=none; rua=mailto:the report address chosen in Zoho |

Remove any older MX record that points elsewhere, otherwise mail still goes to the old provider.
Keep any existing A or CNAME records for the website. They are not touched by this change.
If another service also sends mail for iosky.nl, add its include to the same SPF record. A domain may have only one SPF record.

### iosky.co (added to Zoho on 11 October 2026, ownership not yet verified)

| Type | Host | Value |
|---|---|---|
| TXT (verification) | @ | zoho-verification=zb74405463.zmverify.zoho.eu |

After verification Zoho shows the MX, SPF and DKIM values for iosky.co in the same way. Add them, then click Verify in Zoho.

## 8. The outbound domain iosky.co

- A new domain has no sending reputation. Start with a handful of messages a day and raise the limit over several weeks.
- Zoho Mail is a correspondence service. Large automated cold outbound through a normal mailbox can breach its acceptable use terms
  and the daily sending limits, and risks the account being limited. Confirm the current Zoho terms before running campaigns.
  A sending service built for outbound volume is the safer base if volume grows. The campaign engine keeps sender mailboxes
  configurable, so changing the sender later does not need a rebuild.
- Never send campaign mail from iosky.nl.

## 9. Limitations to know about

- Filters are per mailbox. They cannot be set once for the whole organisation.
- Outlook does not create rules here, so changing the folder logic means editing Zoho filters, not Outlook.
- A filter that moves mail out of the Inbox also hides it from unread counters on the Inbox. Outlook shows the counter per folder.
- The no-reply alias is not a mailbox for people. Anything addressed to it is read by whoever owns the General user.
- Sending as an alias from Outlook depends on the Outlook version and needs the test in section 5.

## 10. State of the account on 11 October 2026

| Item | State |
|---|---|
| Plan | Mail Lite, 5 licences, all 5 now in use, valid until 11 October 2027 |
| Data centre | EU (zoho.eu). DNS host: Hostinger |
| Mailbox 1, General | `support@iosky.nl` created, aliases `contact@`, `info@`, `no-reply@` added |
| Mailbox 2, Projects | `projects@iosky.nl` created, aliases `development@`, `engineering@` added |
| Mailbox 3, Sensitive | `security@iosky.nl` created, aliases `privacy@`, `billing@` added |
| Mailbox 4, Personal | existing user `leeroy.correiadjalo@iosky.nl`. The client wants `lcorreiad@iosky.nl` with the display name "Leeroy Correia Djalo \| IO SKY". Add it as an alias and make it the mailbox address when ready |
| Mailbox 5, Outbound | the existing user `loubna.maghnouj@iosky.nl` occupies the fifth licence. The final iosky.co sender is confirmed by the client on 12 October 2026 |
| Domains | iosky.nl verified, MX not yet pointed. iosky.co added, ownership not yet verified |
| Folders on support@ | Support, Contact, Info created |
| Folders on projects@ and security@ | still to create |
| Server side filters | still to create on all three shared mailboxes |
| Time zone | new users default to Asia/Karachi. Set Europe/Amsterdam in each mailbox under Settings, System |

Zoho limits sign in attempts per day. Sign in once per mailbox and do all work in that session.
New users must change their temporary password at the first sign in, and the welcome tour must be dismissed before the
settings dialog responds to clicks.

## 11. Routing as specified by the client

| Address | Purpose | Folder |
|---|---|---|
| support@ | customer support, portal and Scan support, tickets | Support |
| contact@ | enquiries, Discovery Call requests and confirmations | Contact |
| info@ | general information requests | Info |
| no-reply@ | automated platform messages, no human reply | none |
| projects@ | project communication, milestones, deliverables, handoff, 30 day monitoring | Projects |
| development@ | developer invitations, onboarding, access, offboarding | Development |
| engineering@ | architecture, infrastructure, technical escalation | Engineering |
| security@ | security reports, vulnerability reports, Cyber Scan escalations | Security |
| privacy@ | GDPR and data requests | Privacy |
| billing@ | payments, invoices, receipts, subscriptions | Billing |

Sender per message type, for platform emails about an AI Scan: billing@ for payments and invoices, no-reply@ for automated
status and report notices, support@ for human help, security@ for Cyber Scan security escalations, contact@ for Discovery Call
follow up.
