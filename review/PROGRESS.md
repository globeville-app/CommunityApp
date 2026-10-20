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
| 7 – Refactoring plan | done, approved by the owner (all of P1–P27) |
| Phase 2 – Fixes | **done**: P1–P27 on branch `review-fixes`, one commit per task | `review/PLAN.md`, then STOP for approval |

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

## Phase 2 (done, 2026-10-20)

- Branch `review-fixes`, made from `claude/community-social-network-v1-x411pw`
  and pushed to GitHub. Nothing was merged.
- Every task in `PLAN.md` is ticked, with one commit each. There is also
  one follow-up commit: "P22 follow-up" fixed a test that P22 broke, which
  turned CI red on P22 and P23 for a few minutes.
- Final state: 383 backend tests pass on SQLite and on Postgres 16, 191 app
  tests pass, types and lint are clean, there are no missing migrations, and
  CI is green on the last commit.
- Deviations from the plan's wording, explained in the commits:
  - P2 trusts DigitalOcean's `DO-Connecting-IP` header instead of a proxy
    count.
  - P6 puts "Block" on the member page; the event's "Posted by" name leads
    there.
  - P25 counts sensitive events toward the host's event-count badges but
    not toward Host Reach.
- Known open item: during this work the backend suite failed twice in
  about 30 runs, with a failure I could not reproduce afterwards (16 normal
  runs and 6 shuffled runs all passed). CI will show the test's name if it
  happens again; fix it then. Never skip it.

## Next action (owner)

1. Decide how to merge `review-fixes`. Merging into `main` deploys, so only
   merge when you're ready for the first deploy.
2. At the first deploy, check these (README, "Going live"):
   - "Your address as the server sees it" on the owner stats page (P2);
   - the `/healthz` health check (P3);
   - the alerts under Settings → Alerts (P14);
   - the `cleanup-old-data` and `send-notifications` jobs.
3. Set up Postmark. Until then, email codes print in the server log, or set
   `REQUIRE_EMAIL_VERIFICATION=0` on a server that can't send email.
4. The "Actions for the owner" in `03-security.md` and `05-ops.md` (privacy
   policy, terms, minimum age, store forms, branch protection, and the
   rest).
