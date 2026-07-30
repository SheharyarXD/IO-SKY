# Contributing to IO SKY

This document defines the branching, PR, and commit conventions adopted as part of the
Milestone 1 (Phase 1) repository cleanup. See `PHASE1_CHECKLIST.md` for the full list of
Phase 1 work and its current status.

## Branching model

Trunk-based development:

- `main` is the protected, always-deployable branch. No direct pushes — everything lands
  via pull request.
- One short-lived feature branch per task. Name branches after the task ID from
  `PHASE1_CHECKLIST.md`/the implementation roadmap where one exists, e.g.:
  - `feat/rm-37-storage-proxy-auth`
  - `fix/rm-31-booking-slot-release`
  - `chore/rm-05-remove-unused-deps`
- Branch off the latest `main`, keep the branch focused on one task, and open a PR as soon
  as the change is ready for review rather than batching multiple unrelated tasks into one
  branch.

## Pull requests

- CI (`.github/workflows/ci.yml` — typecheck + test) must pass before merge.
- PR titles should reference the task ID where applicable, e.g. `RM-37: require auth on
  the storage proxy`.
- Keep PRs scoped to a single task/concern. A security fix and an unrelated refactor
  should be two PRs, not one — this matches how the Phase 1 work itself was sequenced
  (see `PHASE1_CHECKLIST.md`'s per-task breakdown).
- Squash-merge to `main` so the commit history stays one entry per completed task.

## Commit messages

No strict format is enforced, but commits should:

- Explain *why*, not just *what* (the diff already shows what changed).
- Reference the task ID when the change maps to one.
- Be scoped to one logical change — avoid bundling an unrelated fix into a commit for a
  different task.

## Before opening a PR

- Run `pnpm run check` (typecheck) and `pnpm run test` locally — the same two steps CI
  runs. Note: as of this writing `node_modules` needs a working `pnpm install` first; see
  `PHASE1_CHECKLIST.md`'s environment note if that fails with `ENOSPC` or similar.
- If the change touches a security-sensitive area (auth, RBAC, tenant isolation, secrets),
  call that out explicitly in the PR description — per `PHASE1_CHECKLIST.md`, changes in
  Milestone 2's Authentication & RBAC workstream in particular warrant a dedicated
  security-focused review, not just a standard pass.
