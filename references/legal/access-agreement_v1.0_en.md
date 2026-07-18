# Access Agreement

**Version:** 1.0
**Effective from:** 2026-05-25
**Document kind:** `access-agreement`
**Parties:** IO SKY B.V. and the engaged Developer or Contractor (the "User").

This Access Agreement defines the technical and operational rules that govern the User's access to IO SKY systems, environments and data. It complements the [Developer Agreement](/legal/developer-agreement) and the [NDA](/legal/nda).

---

## 1. Scope of access

* The User is granted **scoped, time-bounded** access to the resources required to perform the assigned work, and nothing more (principle of least privilege).
* Access scope is recorded as a permissions snapshot in the Developer Workspace and audit-logged on grant, revocation and modification.
* The User must not attempt to access, view or copy data outside the assigned scope. Unauthorised access is a material breach.

---

## 2. Authentication and MFA

* The User must enrol at least one strong second factor (TOTP via authenticator app, or SMS as a fallback) before any project access is granted.
* Recovery codes must be stored securely and never shared.
* Trusted-device enrolment is permitted for up to 30 days; re-verification is enforced after that.
* Suspicious-login signals (new IP, unusual country, new user agent) trigger an MFA re-challenge and a notification to the IO SKY security team.

---

## 3. Acceptable use

The User agrees to:

1. Use only IO SKY-issued credentials and not share them.
2. Use approved development devices kept patched and encrypted at rest.
3. Use approved networks; avoid public Wi-Fi for production access unless using an IO SKY-approved VPN.
4. Not copy production data to personal devices or third-party cloud services.
5. Use only approved AI tools for IO SKY work; never paste IO SKY confidential information into public AI chats.
6. Comply with the [Acceptable Use](/terms#section-4) section of the Terms of Service.

---

## 4. Audit and monitoring

* All access is logged. The User accepts that login events, action events, file accesses and submissions are recorded in `developer_audit`, `login_audit` and other audit tables in line with the [Privacy Policy](/privacy).
* The User has read-only access to their own audit history through the Workspace's "Security" section.
* IO SKY may inspect audit logs for security investigations, compliance reviews, or to resolve disputes about deliverables.

---

## 5. Data handling

* The User must treat any client data accessed through the Workspace as Confidential Information under the NDA.
* The User must not export, screenshot, or transmit client data outside the Platform unless explicitly authorised in writing for a defined purpose.
* When operating on real customer data is necessary, the User must use the smallest possible dataset and prefer anonymised or synthetic data where feasible.

---

## 6. Revocation and termination

* IO SKY may revoke access **immediately and without prior notice** if there is a reasonable basis to suspect a security incident, NDA breach, or violation of this Access Agreement.
* Routine access expires automatically when the engagement ends. Temporary access grants (for a specific incident or hotfix) auto-expire at the timestamp recorded in the access record.
* Upon termination the User must surrender any IO SKY-issued credentials and confirm destruction of any local copies of confidential information.

---

## 7. Incident response

* The User must report any suspected security incident, lost device, unauthorised disclosure or phishing attempt to security@io.sky within **24 hours** of becoming aware.
* The User must cooperate with IO SKY's incident-response process, including preserving relevant logs and devices for forensic review.

---

## 8. Liability for misuse

* The User is liable for damages caused by wilful misconduct, gross negligence, or breach of this Access Agreement.
* IO SKY may pursue injunctive relief and damages, in addition to revoking access and terminating the engagement.

---

## 9. Acceptance and audit

Acceptance is captured at onboarding by clicking "I agree" on the agreement screen. The acceptance is recorded in `agreement_acceptances` with a timestamp, IP address and version. The User can review the version history in the Workspace's "Agreements" section.
