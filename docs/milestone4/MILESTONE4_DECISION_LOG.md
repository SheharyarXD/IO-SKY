# Milestone 4 decision log

Dated record of product decisions taken by engineering on the engagement lead's instruction of 2026-10-30 ("take decisions yourself; at the end we match with the document the client shared"). **Every entry is an assumption until it is compared with the client's document.** Each one lists what was chosen, why, what it changes for users, and exactly how to reverse it if the client document says otherwise.

Nothing here was approved by the client. Nothing here has been deployed.

| # | Date | Task | Decision | Status |
|---|---|---|---|---|
| D01 | 2026-10-30 | P07 | Review and Publish are separate rights; publishing needs a super admin or an explicit `report:publish` grant | Assumed |
| D02 | 2026-10-30 | N01 | Adopt the catalogue's nine family keys with engineering's display names | Assumed |
| D03 | 2026-10-30 | C01 | A lead has one owner (admin or super admin), kept in its own table | Assumed |
| D04 | 2026-10-30 | M4-04 | Keep the operator operation-to-scope mapping as it stands | Assumed, not changed |
| D05 | 2026-10-30 | G04 | Fallback only for provider failures; budget fails closed; a second AI vendor is opt-in | Assumed |
| D06 | 2026-10-30 | J04 | Finished work stays with its author; unfinished work moves; the leaver loses access at once | Assumed |
| D07 | 2026-10-30 | J03 | A developer may be in several teams; a team always has exactly one primary contact | Assumed |
| D08 | 2026-10-30 | R10 | "Verified" for CRM detail means a live Level 2 verification holding `view_own_contact_record` | Assumed |
| D09 | 2026-10-30 | R17 | The FAQ is the `knowledge_base_articles` source; the last editor cannot approve | Assumed |
| D10 | 2026-10-30 | J09/J10 | Documents reach developers only by explicit staff release of an approved document | Assumed |
| D11 | 2026-10-30 | M4-01 | Report download auditing is best effort, not fail closed | Assumed |
| D12 | 2026-10-30 | J07 | Developers and clients never talk directly; staff relay as IO SKY and the system refuses text that reveals the other party | Assumed |
| D13 | 2026-10-30 | P06 | Every engine-produced report is kept as a version; approvals are tied to the version in force at the time | Assumed |

## D01 Review and Publish (P07)

- **Chosen:** reviewing (approve, send back, archive) stays with every admin and super admin. Publishing (visible to the customer, customer emailed) needs a super admin, or an admin holding the `report:publish` right. A super admin grants it, to an admin only, with an optional expiry, and can revoke it. The same person may review and publish (no enforced second pair of eyes); the history records both.
- **Why:** BR-009 and BR-016 require a human decision before a customer sees a report, and the register note asks for a per-admin publish right. Keeping review open avoids taking away a working ability.
- **Effect on deploy:** existing admins can no longer publish until granted. Super admins are unaffected. Grant the right to the intended people at deploy time.
- **To reverse or change:** give admins publish by default by changing `authorizeReportAction` in `shared/reportPermissions.ts` (one line); add a separate review right by adding a scope beside `REPORT_PUBLISH_SCOPE`; enforce different people by comparing the approver recorded on the report with the actor.

## D02 Notification families (N01)

- **Chosen:** the catalogue's keys (discovery_calls, ai_scans, clients_accounts, projects_delivery, payments_billing, ai_operations, platform_integrations, security_access, governance_system) with the display names in `shared/notificationFamilies.ts`. The admin Notification Center shows the family and filters by it.
- **Limit:** client and developer bells store a coarser category, so they cannot filter by family without storing the event id on those notifications (a schema change, not done).
- **To change:** edit `FAMILY_LABELS`; the keys follow the catalogue document.

## D03 Lead ownership (C01)

- **Chosen:** at most one owner per lead; the owner is an admin or super admin; stored in `lead_owners` (migration 0045) so the `leads` table is untouched; assign, change and clear are audited; the CRM filters by owner (any, mine, unassigned).
- **Not done:** follow-up notifications are not routed to the owner (the admin feed has no per-user audience).
- **To change:** allow other roles in `canOwnLeads` (`shared/leadOwnership.ts`); allow several owners by dropping the unique index and changing the model.

## D04 Operator scope mapping (M4-04)

- **Chosen:** keep `OPS_OPERATION_SCOPES` exactly as written. Operators with no relevant grant lose access to the ops panels, as the register note warned; this is treated as intended because it is the fail-closed reading of SRS 5.7 and 13.8.
- **Status stays awaiting the client's written approval**; the table is in `shared/platformRules.ts`.

## D05 AI provider routing (G04)

- **Chosen:** fall back to another provider only for failures about the provider (unreachable, timeout, rate limit, server error, rejected credentials); never replay a rejected request to another vendor; skip a provider after three consecutive failures for a growing cooldown; a daily or monthly budget blocks calls and, if spend cannot be read, blocks them too.
- **Opt-in:** nothing changes until `LLM_PROVIDERS_JSON` or a budget is configured. Using a second vendor sends the same prompts to that vendor, which is a data-processing and contract decision for the owner.

## D06 Reassignment and replacement (J04)

- **Chosen:** a reason is required; a finished task is never moved; unfinished tasks keep their status and content; the removed developer loses the project and all its tasks immediately (BR-018); every move is in an append-only history.
- **Not decided:** whether the incoming developer should accept the work first. Currently they receive it directly.

## D07 Teams (J03)

- **Chosen:** a developer may belong to several teams; the primary contact need not be a lead; removing the primary contact needs a named successor; members are removed, not deleted.

## D08 What "verified" means (R10)

- **Chosen:** a caller is verified only by a live, interaction-bound Level 2 verification that holds the named permission for the organisation. A phone number, a spoken name or a company name never verifies anyone. The flow that produces a verification (secure link, portal sign-in with MFA or passkey, R11) is not built.

## D09 FAQ (R17)

- **Chosen:** the approved FAQ is exposed as the `knowledge_base_articles` source; editing an approved entry returns it to draft; whoever last edited the wording cannot approve it. The store starts empty, so assistants decline every question until staff add and approve entries.

## D10 Document handoff (J09, J10)

- **Chosen:** a document reaches developers only if staff release it, it is approved, it belongs to the same organisation as the linked developer project, and the developer holds an active assignment. Revocation is immediate. The direction developer to client is not built.

## D11 Report download audit (M4-01)

- **Chosen:** every download and refused attempt is recorded, but a failure to record does not block a legitimate download. Switch to fail-closed in `safeAudit` in `server/routers/aiScans.ts` if the client requires it.

## D12 Mediated messaging (J07)

- **Chosen:** developers and clients never message each other. Staff relay a point in each direction; the message arrives from "IO SKY", written by staff, never under the original sender's name. A relay is refused if its text contains the other party's full name, email, phone or company name (a bare first name only warns). A developer can be relayed to a client only if they actively work on a developer project staff linked to that client's project. Staff can also message one developer, a team, or everyone active on a project (each in their own thread). Every relay and broadcast is logged with who and how many, never the text.
- **Not built:** attachments, and internal staff notes as a message type (internal notes stay in the existing staff tools).
- **Limit:** the client side is identified by company name and the sender's name on the message; client email and phone are not checked.
- **To change:** edit `findIdentityLeaks` or make a first-name mention blocking in `shared/mediatedMessaging.ts`.

## D13 Report versions (P06)

- **Chosen:** every report the engine produces is kept as a numbered, append-only version; approvals, publications and revision requests are attached to the newest version produced before the decision. Versions exist only from when migration 0046 is applied.

## Still genuinely open (need the client or an external resource)

- How free guest AI Scan reports are delivered without a public link (M4-02). The current public report token is unchanged.
- Whether untyped documents are visible to clients. They are hidden (fail closed).
- Anonymous denial retention period. Volume is bounded; no deletion period is set.
- Antivirus engine for uploads. Validation is by real content type, not malware scanning.
- Stripe Tax registration (B05), a recovery target (I05), an isolated database (I01, M4-03).
