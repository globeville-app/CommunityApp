# Review progress

Instructions: the developer's review brief (Phase 1 = review only, no code
changes until the owner approves `review/PLAN.md`).

| Step | Status | Output |
| --- | --- | --- |
| 0 – Orientation | done | `review/00-overview.md` |
| 1 – Requirements vs code | done | `review/01-acceptance.md` |
| 2 – Architecture | done | `review/02-architecture.md` |
| 3 – Security & compliance | done | `review/03-security.md` |
| 4 – Tests | done | `review/04-tests.md` |
| 5 – CI/CD & operations | done | `review/05-ops.md` |
| 6 – Skeptic pass | done | notes added to each file + `review/06-skeptic.md` |
| 7 – Refactoring plan | done: waiting for approval | `review/PLAN.md`, then STOP for approval |

## Key decisions

- Branch reviewed: `claude/community-social-network-v1-x411pw`. Compared
  against `origin/main` (GitHub), because the local `main` is older still.
- The review files in `review/` are committed and pushed to the current
  branch after each step, so a new session can pick up where this one left
  off (the cloud container is temporary). Only files in `review/` are
  committed in Phase 1; no code is changed.
- The reviewer is the same AI agent that wrote the code (see the note in
  `00-overview.md`).
- Step 1 was split across four read-only helper agents, one per milestone.
  The most important gaps (G1–G4, G10, and the dead code) were then
  re-checked in the code by hand. Phone-app rows are pointed to but not
  reviewed, as the brief limits this review to the backend.
- Step 3: the throttle bypass (S1) was proven with a local script, and no
  code was changed. `pip-audit` was installed in a throwaway environment in
  the session's scratch folder, not in the project.
- Step 4: `coverage` was used from that same throwaway environment. The
  Postgres run used a temporary local Postgres 16 server
  (`/var/lib/postgresql/review-test`, port 5499), which disappears with the
  container.
- Step 6 was done by a separate, independent agent told to disprove the
  findings. It confirmed 11 of 13, rated 2 lower, and found 8 new ones
  (N1–N8). N1, the image memory crash, was reproduced by hand. Its Sentry
  suggestion conflicts with `docs/STORE_PRIVACY.md`, so that is now an
  owner decision (PLAN P14).

## Next action

**Owner decisions recorded in PLAN.md (2026-10-19). Still waiting for: a
clear go-ahead for the whole plan (P1–P27), and confirmation of the
P26 retention table.**

Original note: STOP, waiting for the owner to approve `review/PLAN.md` (all of it, or
a list of task numbers, plus answers to the "needs you" items).

After approval (Phase 2):
1. `git checkout claude/community-social-network-v1-x411pw && git checkout -b review-fixes`
2. Do the approved tasks in the suggested order. One task = one commit.
   Run `python manage.py test` (and `npx jest` for app changes) after each.
3. Tick each task in `PLAN.md` and update this file after every task.
4. Push `review-fixes`. Don't merge anything.
