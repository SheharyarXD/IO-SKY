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

## 7. DNS for iosky.nl and iosky.co

From the Zoho Admin Console, Domains, Email Configuration, copy the exact records Zoho shows and add them at the DNS host
(Hostinger for iosky.co):

| Record | Purpose |
|---|---|
| TXT verification | proves the domain is yours |
| MX (three records) | delivers mail to Zoho |
| TXT SPF | `v=spf1 include:zoho.eu ~all` or the include Zoho shows for your data centre |
| TXT DKIM (selector shown by Zoho) | signs outgoing mail |
| TXT DMARC at `_dmarc` | start with `p=none` and a report address, then tighten |

If any other service sends mail as iosky.nl (for example a transactional provider), it must be added to the same SPF record.
One domain can have only one SPF record.

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
