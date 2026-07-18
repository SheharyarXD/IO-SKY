# Developer Agreement

**Version:** 1.0
**Effective from:** 2026-05-25
**Document kind:** `developer-agreement`
**Parties:** IO SKY B.V. ("IO SKY") and the engaged Developer (the natural or legal person who accepts this Agreement in the IO SKY Developer Workspace).

This Developer Agreement governs the engagement between IO SKY and an external engineer ("Developer") who is invited into the IO SKY Developer Workspace to deliver work on identified projects. It complements but does not replace any individually signed master services agreement, statement of work or employment contract.

---

## 1. Engagement model

* The Developer is engaged on an **independent contractor** basis. Nothing in this Agreement creates an employer–employee relationship, partnership or agency.
* The Developer determines time, place and tools used to perform the work, subject to security and access requirements set out in the [Access Agreement](/legal/access-agreement).
* The Developer is responsible for own taxes, insurance and statutory obligations.

---

## 2. Scope of work

The Developer will perform the work specified in the Developer Workspace under "Assigned Projects" and "Tasks". Each project lists deliverables, acceptance criteria, deadlines and the responsible IO SKY contact. The Developer must not work on areas outside the assigned scope without written assignment.

---

## 3. Deliverables and acceptance

* All deliverables must follow the IO SKY engineering standards documented in the workspace handbook.
* Submissions are made through the Workspace "Submissions" surface, which records commits, pull-request links, files and review comments. A submission becomes "accepted" only when an authorised IO SKY reviewer marks it as such.
* IO SKY may reject submissions that do not meet acceptance criteria; the Developer will rework at no additional cost up to two cycles per submission unless otherwise agreed.

---

## 4. Intellectual property assignment

* All deliverables, including source code, documentation, designs, configuration, schemas, test code and AI-generated artefacts produced during the engagement, are deemed **work made for hire** under Dutch and EU copyright law.
* To the extent assignment is not automatic, the Developer hereby irrevocably **assigns** all worldwide rights, title and interest in the deliverables to IO SKY at the moment of creation, including the right to register, license and modify them.
* The Developer waives any moral rights to the extent permitted by law.
* If the Developer incorporates pre-existing materials owned by the Developer or by third parties (open-source components, libraries, prior art), the Developer warrants that such materials are clearly identified, properly licensed under terms compatible with IO SKY's commercial use, and disclosed in a project README or `LICENSES.md`.

---

## 5. Confidentiality and NDA

The Developer must accept the [Non-Disclosure Agreement](/legal/nda) before being granted access to any IO SKY system. The NDA survives termination of this Agreement. Breach of confidentiality is a material breach and may result in immediate termination, revocation of access and legal remedies.

---

## 6. Non-solicitation

For the duration of the engagement and for **twelve (12) months** after its end, the Developer will not, directly or indirectly:

* Solicit IO SKY clients with whom the Developer had material contact during the engagement to obtain services that compete with IO SKY's offering.
* Recruit IO SKY employees or other engaged contractors with whom the Developer worked.

These restrictions apply only to actively soliciting; responding to a publicly advertised role or to an unsolicited approach is not a breach.

---

## 7. Compensation

Fees, payment cadence and currency are set out in the project record or in a separate signed engagement letter. Unless otherwise agreed, invoices are submitted monthly and paid within 14 days.

---

## 8. Compliance with security and platform rules

The Developer must:

1. Complete the onboarding flow (NDA → Developer Agreement → Access Agreement → MFA enrolment → scope grant) before accessing any project.
2. Use only the credentials issued to them, never share them, and rotate them on request.
3. Use approved devices and networks; not store production data on personal devices.
4. Report any suspected security incident within 24 hours to security@io.sky.
5. Follow the IO SKY [Acceptable Use](/terms#section-4) rules.

---

## 9. Subcontracting

The Developer may not subcontract any portion of the work without IO SKY's **prior written consent**. Approved subcontractors must sign back-to-back NDA, Developer Agreement and Access Agreement terms.

---

## 10. Termination

* Either party may terminate the engagement on **fifteen (15) days written notice**.
* IO SKY may terminate immediately for material breach of confidentiality, security, acceptable use, or repeated failure to meet acceptance criteria.
* Upon termination, the Developer will return or destroy all IO SKY confidential information, transfer source code in progress to the IO SKY repository, and cease using IO SKY credentials and systems.

---

## 11. Liability

The Developer is liable for damages caused by wilful misconduct, gross negligence or breach of confidentiality. Other liability is capped at the fees paid by IO SKY to the Developer in the **six (6) months** preceding the event.

---

## 12. Governing law and disputes

This Agreement is governed by Dutch law and disputes will be brought before the courts of Amsterdam, unless arbitration under NAI rules is mutually agreed in writing.

---

## 13. Acceptance and audit

Acceptance is captured in the Workspace by clicking "I agree" on the agreement screen. The acceptance is recorded in `agreement_acceptances` with a timestamp, IP address and version, and is mirrored in the audit log. A signed PDF can be generated on demand by IO SKY for compliance purposes.
