# 04 – Tests (Step 4)

## Summary in plain language

All tests pass:

| Suite | Command | Result |
| --- | --- | --- |
| Backend, SQLite (development database) | `cd backend && python manage.py test` | **297 tests, all passed**, 1 skipped (the two-people-at-once test, which needs Postgres) |
| Backend, PostgreSQL 16 (same kind as production) | `DATABASE_URL=postgres://… python manage.py test` | **297 tests, all passed**, none skipped |
| Phone app | `cd mobile && npx jest` | **179 tests in 9 files, all passed** |

All three were run on 2026-10-19 on the branch as committed.

**Coverage (backend):** the tests run **94%** of the backend's code lines,
not counting tests and migrations. That's high. Most of what isn't run is
in four places: organization photo and translate endpoints, the admin
approve/reject actions for organization *changes*, the Expo error handling,
and one unused function (see below). Coverage was measured with
`coverage` 7, installed outside the project so nothing in the repo changed.

**Good:**
- Every test list the milestone docs ask for exists. Step 1's tables give
  file:line for each one.
- The privacy promises have real tests: the address is never stored or
  logged, check-in takes no location, and push text has no meeting spot.
- No test talks to the real internet: the geocoder, Partiful and Expo are
  all faked.

**Missing:**
- A handful of specified badge cases.
- Tests for the gaps found in this review (throttle bypass, `Retry-After`,
  admin hard-delete).
- No automatic test run on GitHub (Step 5).

## Coverage by area

| Area | Coverage | Not run by any test (file:lines) | What that code does |
| --- | --- | --- | --- |
| `organizations/views.py` | 79% | 297-310, 381-401, 341-345, 371-373, 260-270 | Organization photo upload, description translate, the *successful* removal of an admin, report-reason checks, some change-request field paths |
| `organizations/admin.py` | 71% | 98-124, 80-85 | Approve/reject buttons for organization **change requests**; the reject-without-reason message |
| `notifications/push.py` | 74% | 25-35 | What happens when Expo is down or replies with an error |
| `notifications/scheduling.py` | 82% | 89-96, 56-57 | `schedule_upcoming_reminders` (dead code, Step 1), one time-change branch |
| `config/errors.py` | 89% | 48, 64, 69, 82 | Rare error-shape branches |
| `badges/engine.py` | 98% | 322-327 | Declining an event twice, or declining after collecting |
| everything else | 93–100% | — | — |
| `config/asgi.py`, `config/wsgi.py` | 0% | — | Server start-up files, normally untested |
| **Total** | **94%** (2,616 lines, 169 not run) | | |

Coverage only shows a line *ran*, not that its result was checked. The
mapping below is the better measure.

## Acceptance criteria → tests

This is a summary by feature. The row-by-row evidence, with file:line for
every test, is in `review/01-acceptance.md`, under each milestone's
"tests" table.

| Requirement (doc) | Tests that check it | Verdict |
| --- | --- | --- |
| Sign up, log in, log out kills the token (M1, SETTINGS) | `accounts/tests/test_auth_api.py:11,51,66` | covered |
| Address → neighborhood, outside Denver, boundaries, LoHi (M1) | `neighborhoods/tests/test_denver_data.py:29-124`, `test_match_api.py:15-119`, `test_geo.py:28` | covered |
| Geocoder success, no match, timeout (M1) | `geocoding/tests/test_client.py:13,27,31` | covered |
| **Address never stored or logged** (M1) | `config/tests/test_privacy.py:36,88,93` | covered, and the test checks that its own search works |
| Profile, aliases, neighborhood not settable (M1) | `profiles/tests/test_profile_api.py:70,75,101,114` | covered |
| Photo type, size, EXIF stripped (M1) | `profiles/tests/test_profile_api.py:134,160,166,181` | covered |
| App name only in shared config (M1) | `config/tests/test_app_name.py:36` | covered |
| Language and error codes (LANGUAGE A) | `config/tests/test_language.py:29-97` | covered |
| Problem reports, limits, email, screenshot privacy (SETTINGS) | `support/tests/test_reports.py:66-169` | covered. "No endpoint returns screenshots" only checks two replies. |
| Account deletion and what it removes (SETTINGS, M2, M4) | `accounts/tests/test_delete_account.py:53-87`, `events/tests/test_events_api.py:286-308`, `organizations/tests/test_organizations.py:115` | covered |
| Event create/edit/cancel/permissions/limits (M2) | `events/tests/test_events_api.py:14-264` | covered, except over-long `description_alt` |
| Interests and migration (M2) | `profiles/tests/test_interests.py:20-67` | covered. The migration is tested as a function, not as a real migration run. |
| Partiful (M2) | `events/tests/test_partiful.py:27-101` | covered |
| Translation cache (LANGUAGE B) | `events/tests/test_translate.py:23-75` | covered, with a fake translator |
| Map pins and timing rules (M3) | `events/tests/test_pins_and_timing.py:14,51,66` | covered |
| Badge engine: record, reject, idempotent (M3) | `badges/tests/test_engine.py:15-134` | **partially.** Host Reach and Day One past the first stage, and the hosted side of group badges past Seed, are not tested. |
| Sensitive categories, keepsakes, never demote, Grove (M3) | `badges/tests/test_engine.py:138-266` | covered |
| Impact numbers (M3) | `badges/tests/test_impact.py:13-45` | covered |
| Check-in takes no location; geofences ≤ 20 (M3) | `badges/tests/test_api.py:89,104` | covered |
| Member badges 404 and "only me" (M3) | `badges/tests/test_api.py:135,139` | covered |
| Community badges (M3) | `badges/tests/test_community.py:14-39` | **partially.** The group rule (6 events, 20 neighbors) and "Known for showing up" aren't tested. |
| Two people collecting at once (review fix) | `badges/tests/test_concurrency.py:20` | covered on Postgres only. It was shown to fail without the lock. |
| Reminders at 5 PM, untap, run twice, cancel notice, push text (M4) | `notifications/tests/test_notifications.py:36-168` | covered. Expo failure handling isn't tested (push.py:25-35). |
| Organizations: pending, approval, 404, change requests, admins (M4) | `organizations/tests/test_organizations.py:19-115` | **partially.** Change-request approve/reject in admin, photo upload and successful admin removal aren't tested. |
| Posting as an organization (M4) | `organizations/tests/test_organizations.py:154-179` | covered |
| Organization badges (M4) | `organizations/tests/test_org_badges.py:14-86` | covered |
| Following, follower count (M4) | `organizations/tests/test_organizations.py:192,207` | covered |
| Owner stats (M3, M4, GO_LIVE) | `organizations/tests/test_owner_stats.py:16,41`, `badges/tests/test_community.py` | covered, apart from the M3 stage-up counts |
| Production settings pass `check --deploy` (GO_LIVE) | `config/tests/test_production.py` | covered |
| Phone app screens and flows (all milestones) | `mobile/__tests__/*.test.ts(x)` (9 files) | app – not reviewed in detail, all passing |
| Real phones: push arriving, geofencing, maps, share sheet | — | **not verifiable by automated tests.** These need EAS development builds. |

## Tests missing for findings in this review

None of these have a test yet. Each fix in the plan should add one:

| Finding | Test to add |
| --- | --- |
| S1 throttle bypass | A wrong-login loop with different `X-Forwarded-For` values is still blocked. |
| A4 `Retry-After` dropped | A throttled reply carries a `Retry-After` header. |
| G3 admin hard-delete of events | The admin has no delete permission for events. |
| G4 pending org approved without review | A pending org that loses its admin stays pending. |
| G5 admin bypasses 1–5 admins and the https link | Admin forms reject 6 admins, 0 neighborhoods, an http link. |
| G2 hosted counts before the event ends | Host credit only appears after the end time. |

## Notes on how the tests are set up

- **Throttles and the cache:** the tests replace the cache with a dummy
  (`backend/config/settings.py:168-174`), so rate limits are mostly off in
  tests. The throttle tests switch them back on themselves. That's why the
  S1 bypass wasn't caught.
- **Fast password hashing in tests** (MD5) keeps the suite fast. It's
  correctly limited to test runs.
- **No linter or formatter** runs on the backend code (the app has ESLint
  and TypeScript checks). Adding `ruff` is cheap.
- **One command each**, as the milestones require.
