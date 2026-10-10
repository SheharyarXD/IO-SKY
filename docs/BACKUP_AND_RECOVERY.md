# Backup and recovery (SRS 25, 19.3)

Status as of 11 October 2026. This records what exists and what is not yet done.

## What is protected

| Data | Where | Protection today |
|---|---|---|
| Application data | Supabase Postgres | Provider managed backups. Retention and point in time recovery depend on the Supabase plan, which has not been confirmed against current Supabase terms |
| Uploaded files | Supabase Storage, four private buckets | Provider managed. Storage objects are not part of a database restore |
| Application code | Git repositories | Full history, two remotes |
| Configuration and secrets | Railway variables | Not backed up by the platform. A copy of the variable names (not values) is in the deployment notes |
| Audit history | Append only tables | Protected from change by database triggers, restored with the database |

## Known gaps

1. There is one database for local development and production. A staging and a production project are needed so a restore test can be run without risk.
2. No restore has been rehearsed. Until one is, recovery time is unproven.
3. Files are not included in database backups, so a file restore needs its own procedure and test.
4. Backup and restore events are not logged inside the platform. The Supabase dashboard is the only record.

## Recovery procedure (to be rehearsed)

1. Stop writes: switch maintenance mode on in Governance, Configuration.
2. Restore the database to a new Supabase project from the latest backup or the chosen point in time.
3. Point `DATABASE_URL` and the Supabase variables at the restored project in Railway.
4. Run `GET /health/ready` and the integration tests in Governance, Platform, Integrations.
5. Restore files from the storage backup into the matching buckets.
6. Switch maintenance mode off and record the incident in the incident register.

## Decisions needed

- The Supabase plan for production and whether point in time recovery is required. No upgrade will be chosen without approval.
- Target recovery time and acceptable data loss, so the plan can be sized.
