# Refactoring plan (Step 7)

**Status: waiting for the owner's approval. No code has been changed.**

How Phase 2 will work, once approved:
- a new branch, `review-fixes`, made from
  `claude/community-social-network-v1-x411pw`;
- **one task = one commit**, with the full test suite run after each task;
- each task is ticked here when done;
- nothing is merged; you decide how to merge.

You can approve all of it, only some tasks (for example "do P1–P10"), or
change any of them. Tasks marked **needs you** require an owner decision or
an outside account first. They are listed so nothing is forgotten, and I
won't start them until you answer.

Each task gives:
- **What:** the change.
- **Why:** in plain words.
- **Files:** what changes.
- **Risk:** what could go wrong.
- **Verify:** how we'll know it works.

References in brackets point to the review files, for example
[N1 → 06-skeptic.md].

---

## Critical / high: before any real users

- [x] **P1. Reject images with too many pixels** [N1]
  - **What:** check width × height before the image is decoded, and refuse
    anything over about 60 million pixels with the existing
    `photo_wrong_type` code. This covers profile photos, organization
    photos and problem-report screenshots.
  - **Why:** today a 20 KB file can make the server use hundreds of MB of
    memory and crash it, even without logging in.
  - **Files:** `backend/profiles/photos.py`, plus one new test in
    `backend/profiles/tests/` and `backend/support/tests/`.
  - **Risk:** very low. Real phone photos are 12–50 MP, and images are
    already shrunk to 2048 px afterwards.
  - **Verify:** the new test uploads a tiny 13,000 × 13,000 PNG and gets
    `photo_wrong_type` quickly, and the existing photo tests still pass.

- [x] **P2. Stop clients from faking their address for rate limits** [S1]
  - **What (as built):** rate limits ignore `X-Forwarded-For` completely and
    trust only the header DigitalOcean's proxy sets itself
    (`CLIENT_IP_HEADER=DO-Connecting-IP`), or the connecting address in
    development. This replaced the planned `NUM_PROXIES` count, which
    depends on an unknown proxy chain. The owner stats page shows the
    address the server sees. Then add a test, and a README step
    to confirm the number at the first deploy.
  - **Why:** right now anyone can guess passwords without ever being slowed
    down.
  - **Files:** `backend/config/settings.py`, `.do/app.yaml`, `README.md`,
    a new test in `backend/accounts/tests/`.
  - **Risk:** medium. If the number is wrong on DigitalOcean, every user
    could share one limit (20 logins a minute for everyone). That's why the
    README step checks it right after deploy.
  - **Verify:** the test sends 30 wrong logins with changing fake headers
    and gets blocked after 20.

- [x] **P3. Make the health check reliable** [N2]
  - **What:** add a tiny `/healthz` reply that skips the host-name and HTTPS
    checks, and point `.do/app.yaml` at it.
  - **Why:** otherwise the very first deploy may fail its health check.
  - **Files:** `backend/config/` (a small middleware or view, and
    settings), `.do/app.yaml`, a test.
  - **Risk:** low. The reply contains nothing but "ok".
  - **Verify:** the test calls `/healthz` with production settings, an IP
    host and no HTTPS header, and gets 200. Confirm again on the first
    deploy.

- [x] **P4. Add automatic tests on GitHub (CI)** [O1, O2]
  - **What:** one GitHub Actions workflow on every push and pull request.
    It runs the backend tests on Postgres 16, `makemigrations --check`,
    `check --deploy`, the app's tests, TypeScript and lint, and
    `pip-audit`.
  - **Why:** merging into `main` deploys to production, so this catches
    mistakes before they go live.
  - **Files:** new `.github/workflows/ci.yml`.
  - **Risk:** none to the app. The first runs may need small fixes to the
    workflow itself.
  - **Verify:** the workflow shows green on this branch on GitHub.
  - **Then you:** turn on branch protection for `main` (05-ops.md, owner
    actions).

- [x] **P5. Password reset ("Forgot password?")** [A1] — **needs you:**
  Postmark set up for real emails (development prints them).
  - **What:**
    - backend: "email me a reset link", then "set a new password with this
      code", rate-limited, with the same reply whether or not the email
      exists. A new password logs out every device.
    - app: a "Forgot password?" link and two screens, in English and Spanish.
  - **Why:** without it, anyone who forgets their password is locked out for
    good. Milestone 1 says it's needed before real users.
  - **Files:**
    - `backend/accounts/` (views, urls, an email template, tests);
    - `mobile/src/app/` (two screens);
    - `mobile/src/api.ts`, `mobile/src/i18n/en.json` and `es.json`,
      and the app tests.
  - **Risk:** low to medium. It uses Django's built-in, well-tested reset
    tokens.
  - **Verify:** backend tests (link works once, expires, wrong code refused,
    no email leak, other devices logged out) and app tests. Then a manual
    run with the console email.

- [x] **P6. "Block this member"** [S3] — **needs you:** confirm you want
  it now. It's mainly to pass Apple's review.
  - **What:**
    - backend: a block list; a blocked member's events and member page are
      hidden from the blocker;
    - app: "Block" on a member's page and on their event, plus a "Blocked
      members" list in Settings to undo it.
  - **Why:** Apple asks apps where people post content to let users block
    others, and apps get rejected without it.
  - **Files:**
    - `backend/` (a new small model and migration, `events/views.py`
      filtering, `badges/views.py`, tests);
    - `mobile/` (2–3 screens, translations, tests).
  - **Risk:** medium, because it touches the events list filter. The tests
    cover the existing list.
  - **Verify:** new tests show blocked members' events vanish for the
    blocker only, and all existing event tests pass.

- [x] **P7. "Please update the app" switch** [A3]
  - **What:** `/api/config` returns `min_app_version`, set from an
    environment variable. The app shows a "Please update" screen with a
    store link when it's older. Also write the "only add fields, never
    rename" rule in the README.
  - **Why:** once people have the app installed, it's the only way to stop
    old copies breaking after a server change.
  - **Files:** `backend/config/views.py`, `backend/config/settings.py`,
    `mobile/src/app/index.tsx` plus a new screen, translations, tests,
    `README.md`.
  - **Risk:** low. The default is "no minimum".
  - **Verify:** backend test for the config field; app test that an old
    version shows the update screen.

## Medium: soon after launch

- [x] **P8. Organization admins: invite instead of add** [S2]
  - **What:** adding an admin sends the member an invitation they accept in
    the app. The reply no longer shows whether the email exists or the
    person's name. It's only allowed for approved organizations.
  - **Why:** today anyone can make someone an admin without asking, or use
    the form to look up a person's name by email.
  - **Files:**
    - `backend/organizations/` (model and migration, views, tests);
    - `mobile/src/app/organizations/` (an invitation card), translations,
      tests.
  - **Risk:** medium; it changes an existing flow.
  - **Smaller first step (if you prefer):** only allow approved orgs, give
    the same reply whether or not the email exists, and don't return the
    name. That's backend only.
  - **Verify:** tests for invite, accept and decline, and that unknown and
    known emails get identical replies.

- [x] **P9. Refuse cancelling an event that has ended** [N3]
  - **What:** cancel returns `event_past` once the event is over.
  - **Why:** stops pointless "cancelled" notifications for past events, and
    stops a host from wiping attendees' badge progress.
  - **Files:** `backend/events/views.py`, a test.
  - **Risk:** very low.
  - **Verify:** the new test passes, and the existing cancel tests still
    pass.

- [x] **P10. Count a hosted event only after it ends** [G2]
  - **What:** the "counted as hosted" step, and Day One, happen only after
    the end time. The 15-minute job picks up events that ended with 2+
    attendees.
  - **Why:** it matches the badge rules (`BADGES.md`), and a later
    cancellation can no longer leave credit behind.
  - **Files:** `backend/badges/engine.py`, `backend/notifications/`
    (the job), tests.
  - **Risk:** medium. It's the badge engine, but the engine has 60 tests
    to lean on.
  - **Verify:** new tests that credit appears only after the end, and every
    badge test still passes, on SQLite and Postgres.

- [x] **P11. One deletion routine for the app and the admin** [N4, N8]
  - **What:**
    - move the "Delete account" cleanup into one function, and make the
      admin's delete use it too;
    - when an organization is hidden because its last admin left, keep its
      earlier status, so staff can't approve it by accident [G4].
  - **Why:** staff deleting a member in the admin today leave photos, live
    events and live organizations behind.
  - **Files:** `backend/accounts/views.py` plus a new `accounts/deletion.py`,
    `backend/accounts/admin.py`, `backend/organizations/admin.py`, tests.
  - **Risk:** medium; it touches account deletion. The existing deletion
    tests cover it.
  - **Verify:** the existing deletion tests pass, plus new tests that admin
    deletion does the same cleanup.

- [x] **P12. Admin screens follow the same rules as the app** [G3, G5, G9]
  - **What:**
    - events can't be hard-deleted (cancel instead);
    - an organization needs 1–5 admins and at least 1 neighborhood;
    - an organization's link must be https;
    - the Follows screen no longer shows which member follows;
    - the Tokens screen is hidden, so staff can't copy members' logins [A2].
  - **Why:** staff mistakes can't break the app's promises.
  - **Files:** `backend/events/admin.py`, `backend/organizations/admin.py`,
    `backend/organizations/models.py` (a validator, no database change),
    `backend/accounts/admin.py`, tests.
  - **Risk:** low.
  - **Verify:** admin tests for each rule.

- [x] **P13. Shared rate-limit counts** [G1]
  - **What:** store the counts in the database (Django's database cache),
    so both server processes and restarts share them. The migrate job
    creates the cache table.
  - **Files:** `backend/config/settings.py`, `.do/app.yaml`, `README.md`.
  - **Risk:** low. It adds one small table and one query per limited
    request.
  - **Verify:** the throttle tests pass with the database cache.

- [x] **P14. Alerts when something breaks** [O8] — **needs you:** decide
  whether the privacy promise "no third-party crash reporting"
  (`docs/STORE_PRIVACY.md:26`) stays.
  - **What:**
    - add DigitalOcean alerts (deploy failed, app down) to `.do/app.yaml`;
    - the reminder job records "last ran OK", shown on the owner stats page
      in red if it's more than an hour old;
    - optionally email staff on server errors (Django's built-in
      `ADMINS` email, with personal data removed).
  - **Files:** `.do/app.yaml`, `backend/notifications/`,
    `backend/stats/`, `backend/config/settings.py`, tests.
  - **Risk:** low.
  - **Verify:** a stats test shows the warning when the job is stale.

- [x] **P15. A login per device, expiring after 90 days unused** [A2, N5]
  - **What:** replace the single shared token with one token per device,
    stored hashed. Logout ends only that device and removes its push token.
    A password reset ends all of them.
  - **Why:** logging out of one phone no longer logs out the others, and a
    lost phone's login stops working by itself.
  - **Files:** `backend/accounts/` (a model and migration, authentication,
    views, tests), plus a small change in `mobile/src/api.ts`.
  - **Risk:** medium. Everyone gets logged out once when this ships, unless
    the old tokens are migrated; the plan is to migrate them.
  - **Verify:** auth tests for two devices, logout and expiry. Then the
    full suite.

- [x] **P16. Clean up dead phone tokens using Expo's receipts** [G6]
  - **What:** a small step in the 15-minute job asks Expo which sends
    failed, and deletes tokens for uninstalled apps.
  - **Files:** `backend/notifications/push.py`, `sending.py`, tests with
    Expo faked.
  - **Risk:** low.
  - **Verify:** a test where Expo reports `DeviceNotRegistered` and the
    token is removed.

## Low: tidy-ups

- [x] **P17. Error replies keep their headers; JSON for 404/500** [A4, A5]
  - **Files:** `backend/config/errors.py`, `backend/config/urls.py`, tests.
  - **Risk:** very low.
  - **Verify:** tests for `Retry-After` on 429 and JSON on a 500.

- [ ] **P18. Production is safe if a setting is missing** [N6]
  - **What:** inside the Docker image `DJANGO_DEBUG` defaults to off.
    Development still defaults to on.
  - **Files:** `Dockerfile`, a test.
  - **Risk:** very low.
  - **Verify:** the production-settings test.

- [ ] **P19. Fix the small race conditions** [N7]
  - **What:** a duplicate email at signup returns `email_taken`, not a
    500. Admin limits are checked inside a lock.
  - **Files:** `backend/accounts/serializers.py`,
    `backend/organizations/views.py`, tests.
  - **Risk:** low.

- [ ] **P20. Remove dead code and fix the docs**
  - **What:**
    - delete the unused `schedule_upcoming_reminders`;
    - fix `README.md:241`, either with a read-only "Scheduled notifications"
      admin screen or by changing the instructions;
    - update the Milestone 4 API notes for the photo endpoint and
      `?neighborhood=` [G10, G11].
  - **Files:** `backend/notifications/scheduling.py`, `README.md`,
    `docs/REVIEWERS_GUIDE.md`, and possibly `backend/notifications/admin.py`.
  - **Risk:** very low.

- [ ] **P21. Add the missing tests** [04-tests.md]
  - **What:** tests for:
    - higher Host Reach and Day One stages;
    - the community group rules;
    - over-long `description_alt`;
    - organization change-request approve and reject;
    - Expo errors;
    - a successful admin removal;
    - organization photo and translate.
  - **Files:** tests only.
  - **Risk:** none. If a test exposes a bug, I'll stop and report it rather
    than fix it silently.

- [ ] **P22. Small notification and stats fixes** [G7, G8]
  - **What:**
    - a reminder sent after midnight says "Today", not "Tomorrow";
    - "notifications on" counts members with reminders switched on.
  - **Files:** `backend/notifications/sending.py`, `texts.py`,
    `backend/stats/numbers.py`, tests.
  - **Risk:** low.

- [ ] **P23. Protect against a double tap creating two events** [A7]
  - **What:** an optional `Idempotency-Key` header on event create and
    problem reports, with a matching change in the app.
  - **Risk:** low.

- [ ] **P24. Dockerfile runs as a non-root user** [O5]
  - **Risk:** low.
  - **Verify:** a CI `docker build` (P4).

## Owner decisions (2026-10-19)

- P5 approved. It is built with the email printed to the console. Real
  emails start once Postmark is set up.
- P6 (Block this member) approved.
- P14 approved, and the "no third-party crash reporting" promise is kept:
  DigitalOcean alerts, a job heartbeat and Django's own error emails only.
  No Sentry.
- D1 (email verification) approved.
- D4: **don't record attendance at sensitive events at all.** Added as task
  P25.
- D2: data requests are handled **by email for now**. An in-app "Download
  my data" button is listed under "Later" (the owner likes the idea).
- D3: **keep everything needed for participation history and impact for as
  long as the account exists. Delete everything else once its job is
  done.** The proposed rules are in P26, waiting for the owner to confirm
  the table.
- D5: **set up the foundation for a staging server** (P27).

- [ ] **P25. Don't record attendance at sensitive events** [D4]
  - **What:** collect and check-in at resource fairs and donation drives
    are accepted, but nothing is stored; the server answers "ok, nothing
    to collect". Existing rows are removed by a data migration. Hosting
    them still counts, using the attendee count at the moment of check-in.
  - **Why:** whether someone went to a food or resource event can reveal
    that they needed help. Not storing it at all is the safest choice.
  - **Files:** `backend/badges/engine.py`, a migration, tests, and
    `docs/BADGES.md` (rule wording).
  - **Risk:** medium. Hosting credit for these events needs the attendee
    count from somewhere, so the design is settled in the commit and
    described in its message.
  - **Verify:** new tests that no attendance row exists after collecting a
    sensitive event, and that every badge test still passes.

- [ ] **P26. Automatic cleanup of data that's no longer needed** [D3]
  - **What:** a daily job deletes what has done its job. Kept for the life
    of the account: the account, profile, attendance, badges, keepsakes,
    follows, organization roles, and each event's title, category,
    neighborhood, time and host.
  - **Deleted after the period shown:**

    | Data | When |
    | --- | --- |
    | Meeting spot and descriptions of past events | 1 year after the event |
    | Their cached translations | 1 year after the event |
    | "I'm going" taps | 1 year after the event (check the re-offer rule first) |
    | Reminders that were sent | 30 days after sending |
    | Phone push tokens | not used for 90 days |
    | Celebrations already seen | 90 days after being seen |
    | Event and organization reports | 1 year after being filed |
    | Organization change requests that were decided | 1 year after the decision |
    | Problem reports | 1 year after being filed |

  - **Files:** a new `cleanup_old_data` command, `.do/app.yaml` (a daily
    job), `README.md`, tests.
  - **Risk:** medium, because it deletes data. Every rule gets a test that
    proves what is kept as well as what goes, and the job has a
    `--dry-run` mode that only counts.
  - **Verify:** tests per rule. Then run the command with `--dry-run` on a
    copy of the data.

- [ ] **P27. Foundation for a staging server** [D5]
  - **What:**
    - a second DigitalOcean spec, `.do/staging.yaml`, that deploys a
      `staging` branch to its own small app, database and Spaces folder,
      and sends **no real push notifications**;
    - a setting that names the environment (`APP_ENVIRONMENT`), shown in
      the admin header so nobody confuses the two;
    - an app build profile (`eas.json` "staging") that points at the
      staging server;
    - README steps.
  - **Files:** `.do/staging.yaml`, `backend/config/settings.py`,
    `mobile/eas.json`, `mobile/app.config.ts`, `README.md`, tests.
  - **Risk:** low. It changes nothing for production.
  - **Verify:** a settings test for the environment name. Creating it on
    DigitalOcean is an owner step.

## Later (not in this round)

- In-app "Download my data" button (D2).

## Needs your decision first (not code yet)

- [x] **D1. Email verification at signup.** Approved; built together with P5. Recommended with P5, but it
  adds a step for new members.
- [x] **D2. "Download my data" (GDPR-style export).** Answer requests by
  email for now, or build an endpoint?
- [x] **D3. How long to keep data** (problem reports, old events, logs).
  A cleanup job follows once you decide.
- [x] **D4. Attendance at sensitive events.** Decided: don't record (P25). (resource fairs, donation
  drives): keep storing it, or don't record it at all?
- [x] **D5. A staging server for the beta** (optional, about $5–12 a month).

The non-code owner actions (privacy policy, terms, minimum age, store
forms, DigitalOcean alerts, branch protection, backup drill) are listed in
`03-security.md` and `05-ops.md` under "Actions for the owner".

## Suggested order

**P1 → P3 → P2 → P4 → P9 → P12 → P17**

These are all small and backend-only, and they remove the crash, deploy
and security risks first. After that come P5, P6 and P7 (they include app
screens), then the rest.
