# Archived MySQL/TiDB migrations

These 13 migration files (`0000`–`0012`) and their snapshots are the pre-Milestone-1 schema
history, back when the application ran on MySQL/TiDB via `drizzle-orm/mysql2`.

Kept here for historical reference only — **do not apply these to the Supabase Postgres
database**, they are not compatible with the `postgresql` dialect now configured in
`drizzle.config.ts`. The Postgres-native migration history starts fresh in `drizzle/` (the
parent folder), generated from the translated `drizzle/schema.ts` (see RM-43 in
`PHASE1_CHECKLIST.md`).

Full git history of the original MySQL schema and every migration that produced it remains
available via `git log -- drizzle/` regardless of this archive.
