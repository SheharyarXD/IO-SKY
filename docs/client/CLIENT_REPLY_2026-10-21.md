# Client reply, 21 October 2026

Subject: Re: SRS baseline acceptance, documentary reconciliation

Hello,

Thank you. We agree that new requirements are not defects of the SRS delivery and that genuine extensions are handled under Milestone 4 or an approved change request. Our position on the Milestone 4 Finalised Scope follows, with the SRS text it rests on.

**1. The Milestone 4 Finalised Scope supports our position.**
We did not say Milestone 4 is all new scope. Our report says the opposite: the work beyond the 155 criteria is Milestone 4 and is not repriced as new work. The Finalised Scope (29 September) states three things that matter here:
- Section 4.1 (telephony and IVR), 4.2 (AI Receptionist) and 4.5 (AI Sales Outbound) are Milestone 4 workstreams. "SRS baseline" is their scope basis.
- "Nothing in this document is marked complete, because nothing in it has been built."
- Its sequence depends on credentials and accounts, including the telephony account, which are listed as prerequisites.

So "baseline" there tells you these workstreams are not extras. It does not make them part of the 155 acceptance criteria, and it does not move them into the delivery you received. The line-by-line reconciliation you quote was of the five later specification documents against the SRS. It classified each workstream. It did not declare any of them complete.

**2. What the SRS itself says (page numbers are PDF pages).**

| Topic | SRS text | What it means |
| --- | --- | --- |
| Completion standard | Every module ends with "The module shall be considered complete when:" and a list. There are 20 lists, 155 items in total (for example pp. 35 and 189). | The 155 criteria are the SRS's own completion test. None of them names telephony, an AI Receptionist or an AI Sales Agent. |
| §6.9, p. 29 | "Version 1 includes support for integrations such as ... IVR / Telephony Services. The development team is responsible for selecting the most appropriate implementation approach." | A named integration. It specifies no behaviour. |
| §17.6, p. 99 | "Version 1 shall support communication through ... IVR & own telephone system (SIP), AI Receptionists, AI Support Agents, AI Sales Agents ..." | We agree this is a baseline requirement for channel support. It defines no menus, routing, scripts, queues or recording. |
| §19.5, p. 118 | "The platform shall support multiple specialized AI Agents operating within a centralized orchestration framework. Examples include, but are not limited to: ..." | The requirement is the framework and room for further agents. The named agents are examples. |
| BR-014, p. 14 | MFA is mandatory for Super Admin, Admin and Technical Operator. Developers are "strongly encouraged". Clients "may be required". | Mandatory MFA for every role, and passkeys, are not in the SRS. |
| §12.5 and §13.5, pp. 63 and 70 | The Admin dashboard lists outstanding invoices. "Revenue overview" is listed for the Super Admin. | The restriction you describe fits the SRS. Our Admin dashboard shows a month-to-date revenue figure and will be corrected. |
| Cover page | "Approval Status: PENDING RESOLUTION OF OPEN PRODUCT OWNER DECISIONS." OPD-001 and OPD-003 are open (Appendix D). | Some matrix and template values await your decision, so they cannot count against us. |

**3. What we acknowledge as open.**
We do not claim the SRS is closed beyond its criteria. These remain open and none is a new request:
- The first live AI Scan end to end. This waits only for OpenAI credit, which you offered to fund.
- Email: see section 4.
- The telephony, AI Receptionist and AI Sales Agent workstreams, under the Milestone 4 sequence and prerequisites.
- Backup restore rehearsal and measured capacity. These wait for a staging environment and the Supabase plan decision.
- The Admin revenue visibility correction.

**4. Your two questions: mail, and what we are working on.**
- *Created:* five licences are in use. Mailboxes `support@`, `projects@` and `security@` exist with their aliases (`contact@`, `info@`, `no-reply@`, `development@`, `engineering@`, `privacy@`, `billing@`).
- *Not configured, and not by us:* public DNS checked today shows no MX record for `iosky.nl` or `iosky.co`, no SPF, no DKIM and no DMARC. The `iosky.co` domain is not verified in Zoho. The DNS is at Hostinger, under your control. Until those records exist, no mail can be received or delivered from the platform.
- *Done on our side:* each of the three shared mailboxes now has its server-side folders and one filter per address (nine filters), and every alias is listed as a sending address. These cannot be tested with real mail until the DNS records exist.
- *What we are doing now:* application work is paused on exactly the items that depend on you. As soon as the records are in place we verify the domains, set the platform sender and run real send and receive tests.

**5. What we do not accept.**
We do not accept that every later specification, product, design, policy change or performance target becomes part of the delivery already made. Please point to the exact SRS clause and the missing behaviour for any item you consider baseline. Where a baseline function is missing, it stays baseline. Where the request goes further, it needs a defined delta, a quotation and your written approval.

**6. Next steps from you.**
1. Add the DNS records at Hostinger (we will resend the exact values).
2. Fund the OpenAI account, and tell us the VAT identification number and KvK number for Stripe and the invoice footer.
3. Confirm acceptance of the 155 criteria, or name the criterion and the clause where behaviour differs.
4. Tell us which Milestone 4 additions you want quoted.

Regards,
Development Team
