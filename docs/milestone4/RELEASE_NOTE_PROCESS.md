# Release note process (per delivery unit)

Every unit of work that reaches a staging or production environment gets one release note, written **before** it is deployed and completed **after** it is verified. The note exists so that anyone can answer, months later: what changed, what had to happen first, what was checked, and how to undo it.

This process does not deploy anything. It is the checklist a deployment follows. It complements `docs/RELEASE_ROLLBACK_PLAN.md` (how to undo) and `docs/DEPLOYMENT.md` (how to ship).

## Rules

1. **One note per unit**, named `RELEASE_<date>_<unit>.md`, kept with the other milestone documents.
2. **Status words are exact.** Use only: NOT_STARTED, IN_PROGRESS, IMPLEMENTED_TESTING_PENDING, TESTED_LOCAL, LIVE_VERIFICATION_PENDING, COMPLETED_VERIFIED, BLOCKED_EXTERNAL, AWAITING_CLIENT_DECISION. A test run with mocks is **TESTED_LOCAL**, never verified. COMPLETED_VERIFIED needs evidence from the environment named in the note.
3. **Say what was not checked.** A note that lists only what passed is incomplete.
4. **Migrations are listed in order, with their effect if absent.** Copy the row from `MILESTONE4_BLOCKERS.md`.
5. **Every behaviour change a user will notice is listed**, including permissions that become stricter.
6. **Assumptions are listed with their decision number** from `MILESTONE4_DECISION_LOG.md`, so a reviewer can compare them with the client document.
7. **No secrets, no real customer data, no production identifiers** in a note.
8. A note is **never edited after release**; corrections are added as dated lines at the end.

## Template

```
# Release note: <unit name>

Date prepared: <YYYY-MM-DD>        Prepared by: <name>
Target environment: <staging | production>        Commit: <short sha>
Tasks: <register ids, for example P07, J07>

## What changes
- <one line per user-visible change>

## Behaviour changes to expect
- <anything that becomes stricter, slower, or different for existing users>

## Before deploying
| Step | Done by | Done |
|---|---|---|
| Apply migration <file> to a non-production database and verify | | |
| Apply migration <file> to production | | |
| Set or change configuration <names only> | | |
| Grant <right> to <role>, if the release needs it | | |

## Migrations (apply in this order)
| File | Must be applied before deploy? | If the code runs without it |
|---|---|---|

## Assumptions in this release
- <decision number>: <one line>

## Verification
| Check | Environment | Result | Evidence |
|---|---|---|---|
| Typecheck, tests, build | local | | |
| <manual or automated check> | <environment> | | |

## Not verified
- <what was not exercised, and why>

## Rollback
- Code: <how, how long>
- Data: <what cannot be rolled back, and the forward fix>

## Sign-off
Verified by: <name>      Date: <YYYY-MM-DD>      Final status: <status word>
```

## Worked example (this branch)

A note for the report-permissions unit (P07) would list, under *Behaviour changes*: "Admins can review reports but can no longer publish them until a super admin grants `report:publish`"; under *Before deploying*: "Grant the publish right to the intended admins"; under *Assumptions*: "D01"; under *Not verified*: "the grant lookup has not run against PostgreSQL"; and under *Rollback*: "redeploy the previous build; no migration to undo (the existing operator_scopes table is reused)".
