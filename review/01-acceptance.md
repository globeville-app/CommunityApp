# 01 – Requirements vs code (Step 1)

Every acceptance criterion in `docs/MILESTONE_1.md` to `MILESTONE_4.md` was
checked against the code, together with the docs those milestones pull in
(`SETTINGS.md`, `LANGUAGE.md`, `BADGES.md`). The work was split across four
read-only helper agents, one per milestone. I then re-checked the most
important gaps in the code myself. Those are marked ✔ in the summary below.

**Status words used:**

| Word | Meaning |
| --- | --- |
| implemented | Built, and the code does what the requirement says. |
| partially | Built, but with a gap. The gap is described in the row. |
| missing | Not built. |
| not verifiable | Can't be checked from the code. It needs a real phone, a live server, or a person. |
| app – not reviewed | It's a phone-app feature, which is outside this backend review. The file that seems to do it is listed, but it wasn't checked. |
| changed | A later milestone deliberately changed the requirement. |

**Test runs while mapping:** backend `python manage.py test` ran 297 tests,
all passed (1 skipped; that one needs Postgres). Phone app `npx jest` ran 179
tests, all passed.

## Summary in plain language

**Nothing required for the backend is missing.** Every backend requirement is
either built or deliberately changed by a later milestone. The real gaps are
small rules that are enforced in the app's API but can be got around through
the Django admin, plus a few edge cases:

| # | Gap | Why it matters | Where |
| --- | --- | --- | --- |
| G1 ✔ | **Rate limits are kept in each server process's own memory.** Production runs 2 processes, so a limit is really about 2× what it says, and every restart resets it. | It weakens the protections against people spamming the address lookup, problem reports and logins. | `backend/config/settings.py:168-174` (`LocMemCache`), `Dockerfile` (2 workers) |
| G2 ✔ | **A hosted event counts as soon as 2 people have checked in, even while it's still going on.** `BADGES.md` says a hosted event counts only once it "has ended". | A host's badge can grow a few hours early. If the event is later cancelled, the credit stays. | `backend/badges/engine.py:292` vs `docs/BADGES.md:160` |
| G3 ✔ | **The Django admin can permanently delete an event.** That also deletes everyone's "I'm going" and attendance records. Milestone 2 says events are never hard-deleted. | A staff click could erase people's badge history. Badge counts aren't redone until that person's next collect. | `backend/events/admin.py:7` (no `has_delete_permission`) |
| G4 ✔ | **A *pending* organization whose only admin deletes their account is set to "hidden".** If staff then add an admin and press Approve, it goes live without ever being reviewed. | It's a way around the approval step, though only staff can trigger it. | `backend/accounts/views.py:142-145`, `backend/organizations/admin.py:69-76` |
| G5 | **Admin screens skip rules the API enforces:** an organization can have more than 5 admins or no neighborhoods, and its link can be plain `http`. | Staff mistakes aren't caught. | `backend/organizations/admin.py:23-34`, `backend/organizations/models.py` (link) |
| G6 | **Expo's delivery "receipts" are never checked.** Dead phone tokens are removed only when Expo rejects them straight away. | The token list slowly fills with dead phones. Harmless at first, but it wastes sends. | `backend/notifications/push.py:59-63` |
| G7 | **A reminder held up past midnight (by an outage) still says "Tomorrow".** | It's a confusing message, though rare. | `backend/notifications/sending.py:27` |
| G8 | **"Notifications on" in the owner stats counts phones with a push token.** It doesn't count members who have reminders switched on. | The number may read higher than reality. | `backend/stats/numbers.py:108-134` |
| G9 | **Staff can see who follows which organization** in the admin "Follows" screen. Milestone 4 says following is private. | It's a privacy promise that only holds in the app. | `backend/organizations/admin.py:149-156` |
| G10 ✔ | **The README points to an admin screen that doesn't exist.** It says to change a reminder's time "in admin, under Scheduled notifications", but there is no `notifications/admin.py`. | The manual test can't be followed as written. | `README.md:241` |
| G11 | **Small differences from the API spec:** the organization photo uses its own `POST …/photo` instead of `PATCH`, and `GET /api/organizations?neighborhood=` ignores the parameter. | The app works. But the spec and the code disagree, which will confuse the next developer. | `backend/organizations/views.py:188-192, 292-310` |
| G12 | **Some required tests are missing:** the higher Host Reach and Day One stages, two community-badge rules, and the long `description_alt` case. | Those rules could break without anyone noticing. Details are in Step 4. | `backend/badges/tests/` |

**Owner decisions that show up as "partially":** machine translation is
switched off until a translation provider is picked (Milestone 2 #9 and #44).

**Code that no doc asks for** is listed at the end of each milestone. Most
of it is small and sensible, such as the photo resize and the Denver box for
map pins. Two items are worth removing or changing:
- `schedule_upcoming_reminders` is dead code: nothing calls it
  (`backend/notifications/scheduling.py:87` ✔).
- The Follow admin screen goes against the privacy rule (see G9).

**Can't be verified from code at all:** push notifications and auto check-in
on real phones, the DigitalOcean scheduled job, the Spanish review by a
native speaker, and the manual phone checks in the README.

---

Paths below are relative to the repository root unless the section says
otherwise. Each section's tables were written by one helper agent, so the
path style differs a little between sections.

## Milestone 1, Settings (Milestone 1.5) and LANGUAGE.md Part A

In this section, backend paths start inside `backend/`. Paths starting with `src/` or `__tests__/` are inside `mobile/`.

### MILESTONE_1.md

| # | Criterion | Status | Evidence (file:line) | Notes |
|---|---|---|---|---|
| 1 | Done when 1: "create an account with email and password and stay logged in" | Backend implemented; app not reviewed | `accounts/views.py:22`, `:34`; `accounts/tests/test_auth_api.py:11`, `:51`; app: `__tests__/join-flow.test.tsx:55` | The server side of signup and login works and is tested. Staying logged in on a real phone needs a phone to confirm. |
| 2 | Done when 2: "type a Denver address and see which neighborhood" | Backend implemented | `neighborhoods/views.py:62`, `neighborhoods/geo.py:49`; `neighborhoods/tests/test_match_api.py:28` | The server turns the address into a neighborhood and tests check it. |
| 3 | Done when 3: "pick the name they use" (aliases) | Backend implemented | `neighborhoods/views.py:95`, `profiles/views.py:47`; `profiles/tests/test_profile_api.py:75` | The server sends the nicknames (like LoHi) and refuses a nickname that doesn't belong to that neighborhood. |
| 4 | Done when 4: "display name, optional photo, optional interests" | Backend implemented | `profiles/views.py:29-62`, `:95`; `profiles/models.py:29-36` | Only the last initial is stored, so the name shows as "Ana R." |
| 5 | Done when 5: "land on a profile screen" | App – not reviewed | `src/app/(tabs)/profile.tsx`; README.md:178-179 | The README says people now land on the Events tab first, which is a later change. The Profile tab shows the name and neighborhood. |
| 6 | Done when 6: "street address never written to the database, logs, files, or phone storage" | Implemented (server); phone side is the app's job | `geocoding/client.py:53`, `:63`; `neighborhoods/views.py:40`, `:77-81`; `config/settings.py:306-308`; `config/tests/test_privacy.py:36`; phone: `__tests__/privacy.test.ts:48` | A test runs the whole join flow, then searches every database table, every uploaded file, every response and all log output for the address. It finds nothing. |
| 7 | Done when 7: "Backend and mobile tests pass, each with one command" | Implemented | backend `manage.py test`; mobile `package.json:63` (`jest`) | Both suites passed when I ran them today. |
| 8 | Decisions: the app name lives only in `shared/app_config.json` | Implemented | `config/settings.py:32`; `config/tests/test_app_name.py:36`; `mobile/app.config.ts:27` | A test confirms "Globeville" isn't typed anywhere else in the code. |
| 9 | API table: the 8 endpoints | Implemented | `config/urls.py:23-29`; `accounts/urls.py` | All 8 endpoints exist at the paths the doc gives. |
| 10 | "Every endpoint except signup, login and config requires the token" | Implemented | `config/settings.py:236`; open endpoints are only `config/views.py:10`, `accounts/views.py:23`, `:35`, plus the problem report (`support/views.py:37`), which the Settings doc allows | Login is required by default. Only the allowed pages are open. |
| 11 | `/api/join/match`: "address is never echoed back"; the server remembers the match | Implemented | `neighborhoods/views.py:88-97`; `neighborhoods/tests/test_match_api.py:40`, `:49` | The reply contains only the neighborhood. |
| 12 | "`/api/join/match` is rate-limited per user" | Partially | `config/settings.py:248` (10 per minute), `:172`; `Dockerfile:24` (2 workers); `neighborhoods/tests/test_match_api.py:119` | It works and is tested. But the counts are kept in each server process's own memory, so a live server with 2 processes allows about twice the limit, and the counts reset on every restart. |
| 13 | `PUT /api/profile`: neighborhood "never from the app" | Implemented | `profiles/views.py:40`; `profiles/serializers.py:37`; `profiles/tests/test_profile_api.py:70` | The app can't pick its own neighborhood. |
| 14 | `GET /api/profile/me`: 404 `profile_not_found` | Implemented | `profiles/views.py:26`; `profiles/tests/test_profile_api.py:101` | Works and is tested. |
| 15 | Neighborhood data: the Denver file plus SOURCE.md (URL, date, license) | Implemented | `data/denver_statistical_neighborhoods.geojson`, `data/SOURCE.md` | The official city file is committed, with its source noted. |
| 16 | Aliases file, "seed only LoHi" | Implemented | `data/neighborhood_aliases.json`; `neighborhoods/aliases.py:21` | Only LoHi → Highland is seeded, as asked. |
| 17 | Geocoding: Census geocoder, one small interface, timeout | Implemented | `geocoding/client.py:32`, `:45`; `config/settings.py` (8-second timeout) | The address lookup service can be swapped later in one file. |
| 18 | Optional Nominatim fallback; no autocomplete | Optional, not built | — | It's optional, so not building it is fine. There is no autocomplete. |
| 19 | Data model: "No field anywhere for street address, coordinates, raw geocoder responses" | Implemented | `profiles/models.py`, `neighborhoods/models.py:26`; `config/tests/test_privacy.py:93` | A test checks that no field has an address-like name. It only looks at the 4 joining-related apps. |
| 20 | Privacy (server): "scrub them from error messages, exception handlers and DRF error responses" | Implemented | `neighborhoods/views.py:77-86`; `geocoding/client.py:53`; `config/errors.py:42`; `neighborhoods/tests/test_match_api.py:86` | An unexpected error logs only the type of error, never the address. |
| 21 | Privacy (phone): nothing stored; field cleared; no analytics | App – not reviewed | `__tests__/privacy.test.ts:23`, `:43`; `__tests__/join-flow.test.tsx:185` | The phone tests cover this and pass. |
| 22 | Photos: strip location data on the server; JPEG/PNG only; 5 MB max; random filename | Implemented | `profiles/photos.py:29-59`; `profiles/models.py:9`; `config/settings.py:273`; `profiles/tests/test_profile_api.py:134`, `:160`, `:166`, `:181` | Each photo is rebuilt from its pixels only, so hidden data such as GPS location is dropped. |
| 23 | Edge case: outside Denver, including suburbs | Implemented | `neighborhoods/views.py:37`; `neighborhoods/tests/test_denver_data.py:90` | Lakewood and Aurora are tested. Englewood isn't, but it falls outside the city boundary the same way. |
| 24 | Edge cases: no match; geocoder down or slow | Implemented | `neighborhoods/views.py:34-35`; `neighborhoods/tests/test_match_api.py:62`, `:68` | The server sends clear codes, and the app shows them in the person's language. |
| 25 | Edge case: phone offline or server unreachable | App – not reviewed | `__tests__/join-flow.test.tsx:83`, `:306` | The phone tests cover this. |
| 26 | Edge case: point exactly on a boundary | Implemented | `neighborhoods/geo.py:41`, `:60`; `neighborhoods/tests/test_geo.py:28`; `neighborhoods/tests/test_denver_data.py:101` | The lowest neighborhood ID always wins. |
| 27 | Edge case: apartment and unit numbers | Implemented | `neighborhoods/tests/test_match_api.py:15` | The test addresses include "Unit 2B" and "Apt 9". |
| 28 | Test: data loads 78 neighborhoods, all named, all valid | Implemented | `neighborhoods/tests/test_denver_data.py:29`, `:32`, `:39` | It runs against the real Denver file and is not skipped. |
| 29 | Tests: known points; outside Denver; boundary; LoHi → Highland | Implemented | `neighborhoods/tests/test_denver_data.py:79`, `:90`, `:101`, `:123` | All present. |
| 30 | Test: geocoder success, no match, timeout (all mocked) | Implemented | `geocoding/tests/test_client.py:13`, `:27`, `:31` | The tests never call the real internet. |
| 31 | Test: full API flow; endpoints reject missing tokens | Implemented | `config/tests/test_privacy.py:51-68`; `profiles/tests/test_profile_api.py:114` | Covers signup → login → match → profile → profile/me. |
| 32 | Test: "Address is never stored" | Implemented | `config/tests/test_privacy.py:36`, `:88` | There is also a check proving the search would really find a planted value. |
| 33 | Test: photo wrong type, oversized, location data stripped | Implemented | `profiles/tests/test_profile_api.py:134`, `:166`, `:181` | All present. |
| 34 | Mobile tests (screens, address cleared, error states) | App – not reviewed | `__tests__/join-flow.test.tsx` | Present and passing. |
| 35 | Both: the app name appears nowhere in code | Implemented | `config/tests/test_app_name.py:36` | One test checks both the backend and phone folders. |
| 36 | README: beginner setup plus the manual phone check | Implemented (doc); not verifiable that it was done | README.md:109 (local IP), :168 | The steps are written, but only someone with a real phone can confirm the check was done. |
| 37 | Interests list from `/api/config` ("Block parties, Food drives…") | Implemented as changed by Milestone 2 | `config/views.py:18`; `events/categories.py:51`; `profiles/tests/test_interests.py:57` | Milestone 2 replaced this list with the event categories and old picks were carried over, so the original list is correctly gone. |

### LANGUAGE.md Part A

| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 38 | Done 1–4: all text in English and Spanish; toggle; switches instantly; choice survives | App – not reviewed | `src/i18n/en.json`, `es.json`; `src/components/LanguageToggle.tsx`; `__tests__/i18n.test.ts:24`, `:57`; `__tests__/language.test.tsx:61`, `:110` | Phone tests cover each point, including the rule against fixed English text in screens. |
| 39 | Done 5: language saved for signed-in members | Implemented (stored on the account) | `accounts/models.py:17`, `:31`; `accounts/serializers.py:53` | Milestone 1 itself says to store it on the account, not the profile, because the account exists from signup. |
| 40 | Done 6 / Backend: errors are codes, not sentences | Implemented | `config/errors.py:33`, `:42`; `config/tests/test_language.py:97` | The test checks 11 different error replies. |
| 41 | Language accepted at signup and in PATCH; other values rejected | Implemented | `accounts/serializers.py:21`; `profiles/serializers.py:26`; `config/tests/test_language.py:29`, `:39`, `:52`, `:59` | Works and is tested. |
| 42 | `/api/config` returns interest keys | Implemented as changed by Milestone 2 | `config/views.py:18`; `events/tests/test_categories.py:21` | It now sends category keys, which double as interest keys. |
| 43 | Spanish reviewed by a native speaker before launch | Not verifiable | — | This is a human task for the owner. |

### SETTINGS.md (Milestone 1.5)

| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 44 | Done 1–2: gear icon; exactly 8 rows in order | App – not reviewed | `src/app/(tabs)/profile.tsx:79-83`; `src/app/settings.tsx`; `__tests__/settings.test.tsx:80`, `:87` | Tested in both languages. |
| 45 | Privacy and terms links in the shared config; "Coming soon" when empty | Implemented / app | `shared/app_config.json` (both links empty); `mobile/app.config.ts:116-117`; `src/app/coming-soon.tsx`; `__tests__/settings.test.tsx:99` | The real pages still need to be provided by the owner. |
| 46 | Done 3: report in under a minute; team gets an email and sees it in admin | Implemented (backend); timing not verifiable | `support/views.py`, `support/notify.py:8`, `support/admin.py` | The "under a minute" part needs a person timing it on a phone. |
| 47 | "Having trouble?" link on the join screens | App – not reviewed | `src/ui.tsx:355-361`; `src/app/report.tsx` | Appears to be built. |
| 48 | Form fields; auto-attached details; "never attached" items | App – not reviewed | `src/report.ts`; `__tests__/settings.test.tsx:149`, `:180` | The server stores the time itself (`support/models.py:77`). |
| 49 | ProblemReport model has all listed fields | Implemented | `support/models.py:53-77` | Every field the doc names is there. |
| 50 | Endpoint `POST /api/support/report`; login accepted but not required | Implemented | `config/urls.py:30`; `support/views.py:37` | Works signed in or signed out. |
| 51 | 5 per user per day; by IP address when signed out | Partially | `config/settings.py:250`, `:172`; `support/views.py:39`; `support/tests/test_reports.py:161`, `:169` | Works and is tested, with the same production weakness as row 12. Also, rejected tries (such as an empty message) count toward the 5. |
| 52 | Screenshot: strip location data; 5 MB; JPEG/PNG; never served to the app | Implemented | `support/views.py:67-69`; `support/models.py:20`, `:65`; `support/admin.py:51`; `support/tests/test_reports.py:85`, `:89`, `:103` | Screenshots are kept in a private folder, and only staff can view them in admin. |
| 53 | Admin: newest first; filters for status, language, version; staff edit status and notes | Implemented | `support/admin.py:13-14`, `:32`; `support/tests/test_reports.py:120` | Staff can change only the status and notes. |
| 54 | Email to everyone in `PROBLEM_REPORT_EMAILS`; first 200 characters; details; admin link; no attachment; no hard-coded addresses | Implemented | `config/settings.py:291`; `support/notify.py:13-14`, `:29`; `support/tests/test_reports.py:129` | If no addresses are set, no email is sent, but the report is still saved. |
| 55 | Development prints emails to the console; production settings from the environment | Implemented | `config/settings.py:278-286` | The production mail service is still the owner's choice. |
| 56 | Error codes `message_required`, `message_too_long`, `bad_image`, `daily_limit` | Implemented | `support/views.py:43`, `:48`, `:50`, `:69`; `support/tests/test_reports.py:66` | All four exist, plus an extra `invalid_email`. |
| 57 | Log out: server deletes the token | Implemented | `accounts/views.py:65`; `accounts/tests/test_auth_api.py:66` | A test confirms the old token stops working. |
| 58 | Log out: phone removes the token even if the server call fails; keeps the language | App – not reviewed | `__tests__/settings.test.tsx:234`; `__tests__/join-flow.test.tsx:339` | Tested. |
| 59 | Delete: needs login and password; removes user, profile, photo file, tokens | Implemented | `accounts/views.py:69`, `:89`, `:137`, `:156`; `accounts/tests/test_delete_account.py:53`, `:63`, `:67` | Everything else tied to the member is also removed. |
| 60 | Delete keeps problem reports, with user and contact email cleared | Implemented | `accounts/views.py:122`; `accounts/tests/test_delete_account.py:80` | Works and is tested. |
| 61 | Deleted email can sign up again | Implemented | `accounts/tests/test_delete_account.py:87` | Works and is tested. |
| 62 | "Former neighbor" rule written in the README | Implemented | README.md:441, :446 | Present. |
| 63 | Milestone 2 deletion rules: upcoming events cancelled; "going" records removed; past events show "Former neighbor" | Implemented | `accounts/views.py:122-137`; `events/models.py:31` | Their "I'm going" records are removed automatically along with the account. |
| 64 | Delete screen and its wording | App – not reviewed | `src/app/delete-account.tsx`; `__tests__/settings.test.tsx:258`, `:269` | Tested. |
| 65 | Backend test list (reports, logout, delete) | Implemented | rows above | One gap: the "no API endpoint returns screenshots" test only checks the report reply and the public photo web address. Searching the code, I found no other endpoint that touches screenshots. |
| 66 | Mobile test list | App – not reviewed | `__tests__/settings.test.tsx`, `__tests__/language.test.tsx:205` | Present and passing. |
| 67 | Manual phone check in the README | Implemented (doc); not verifiable | README.md:185-198 | Needs a real phone. |
| 68 | Design rules (52 pt rows, red Delete, Spanish text wraps) | App – not reviewed | `src/app/settings.tsx` | Needs a visual check on a phone. |
| 69 | Rate limits on a live server | Not verifiable here | `config/settings.py:172`; `Dockerfile:24` | Needs the deployed server. The counts would need a shared store for the limits to be exact. |

### Backend code not required by any doc in docs/

I compared all the backend code against every doc, Milestones 1–4 and GO_LIVE included. Almost everything outside the join flow is required by a later doc:
- events and translation: Milestone 2 and LANGUAGE.md Part B
- badges and the check-in features: Milestone 3, BADGES.md and BADGE_UI.md
- organizations and push notifications: Milestone 4
- owner stats, the "last seen" time stamp, the two-step admin login, the hidden admin address and the file storage setup: GO_LIVE.md

Only these small items aren't asked for anywhere. All of them are harmless:
- `neighborhoods/geo.py:72` `Boundaries.by_name`: a helper only the tests use (`neighborhoods/tests/test_denver_data.py:60`, `:124`).
- `profiles/photos.py:18`, `:51`: shrinks photos to at most 2048 pixels per side. Not in any doc, but sensible.
- `profiles/photos.py:50`: turns sideways phone photos upright. Not in any doc, but it makes up for removing the orientation data.
- `profiles/views.py:109`, `:111`: notes each photo upload's size and processing time in the server log. It never logs the image or its data.
- `support/notify.py:23`: adds a "Signed in: yes/no" line to the team email. Not asked for.
- `support/admin.py:15`: a search box for report messages in admin. Not asked for.
- `support/views.py:61`: an `invalid_email` code for a badly typed contact email, which isn't in the doc's list of codes.
- `/api/members/<id>` (`badges/views.py:110`): a neighbor's member page. No API table lists it, but MILESTONE_3.md:174 implies a neighbor's profile screen exists.
## Milestone 2 and LANGUAGE.md Part B

`B/` = `backend/`, `M/` = `mobile/src/`. Event tests are in `backend/events/tests/`. Status words here are short forms: **Impl** = implemented, **Partial** = partially, **N/V** = not verifiable, **App** = app – not reviewed, **Changed** = changed by a later milestone.

### Done when (MILESTONE_2 §Done when)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Post to own neighborhood; needs category, title, start and meeting spot; end and description optional (§DW1) | Impl | B/events/views.py:202-219, :164; validation.py:93-122 | Members can only post to their own neighborhood, because the server picks it, not the phone. |
| 2 | Two-step category picker with English and Spanish search (§DW2) | App | M/components/CategoryPicker.tsx:4-10, :49 | The server side is the category list in `/api/config` (B/config/views.py:18). |
| 3 | Paste a Partiful link: title prefilled, category suggested, "Open in Partiful" on the card (§DW3) | Impl (backend) / App | B/events/views.py:361-367; partiful.py:49-72; M/app/event/[id].tsx:278 | The server side works and is tested. |
| 4 | Events tab: upcoming events, soonest first, group filter (§DW4) | Impl (backend) / App | B/events/views.py:178-200; M/app/(tabs)/events.tsx | See #13 on what "upcoming" now means. |
| 5 | "I'm going" toggle and going count (§DW5) | Impl | B/events/views.py:268-298 | |
| 6 | Organizer can edit or cancel; cancelled events stay (§DW6) | Impl | B/events/views.py:231-265 | Cancel only changes the status; nothing is deleted. |
| 7 | Any member can report; reports show in admin (§DW7) | Impl | B/events/views.py:301-311; admin.py:16-20 | |
| 8 | Interests use event categories; old list retired; picks carried over; "For you" tag and filter (§DW8) | Impl (backend) / App | B/profiles/serializers.py:9-20; profiles/migrations/0004_interests_to_categories.py:33-64; events/views.py:147, :194-195; M/components/EventCard.tsx:50 | |
| 9 | Works in English and Spanish, including category names, "Ver en español" and alt text (§DW9) | Partial | B/events/tests/test_categories.py:35-45; events/translation.py:21-32 | Labels and organizer-written Spanish versions work. Machine translation stays off until the owner picks a provider (an owner decision). |
| 10 | Backend and mobile tests pass, one command each (§DW10) | Impl (backend) / App | `python manage.py test` gives 297 OK; mobile has `"test": "jest"` (mobile/package.json:63) | I did not run the mobile tests. |

### Decisions, data model, API and validation
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 11 | First event sets role to `organizer` (§Decisions) | Impl | B/events/views.py:215-217; profiles/models.py:39-44 | Since Milestone 4, posting for an organization does not change the role (MILESTONE_4 §79). |
| 12 | Visible to neighborhood members only; others get 404 (§Decisions, §API) | Impl / Changed | B/events/views.py:52-86 | Since Milestone 4, organization admins also see their organization's events in other neighborhoods (views.py:61-62). |
| 13 | List shows upcoming active and cancelled events, soonest first (§API) | Impl / Changed | B/events/views.py:185-199 | An event stays listed until it ends; one with no end time ends at midnight Denver time (BADGES.md:91; MILESTONE_3 §64; events/timing.py:262-271). |
| 14 | `group=` and `for_you=true` filters; `matches_interests` on each event (§API) | Impl | B/events/views.py:189-195, :147 | Unknown groups return `invalid_group`. |
| 15 | Detail includes going count and whether the caller is going (§API) | Impl | B/events/views.py:145-146, :67-68 | |
| 16 | Times stored in UTC; entered and shown in Denver time (§Decisions) | Impl | B/config/settings.py:156, :158; events/validation.py:56-66; views.py:117-118 | Tested at test_events_api.py:112-125. |
| 17 | `sponsor_name` exists, no UI, not settable or readable through the API (§Decisions, §Validation) | Impl | B/events/models.py:59; validation.py:23-39; views.py:105 | It is still editable in Django admin, which the doc allows. |
| 18 | No home addresses; event location typed by the organizer (§Decisions) | Impl | B/events/models.py:51 | |
| 19 | Categories stored as fixed keys, defined once in `categories.py`, served by `/api/config` (§Categories) | Impl | B/events/categories.py:21-28, :50-57; config/views.py:18 | The list matches the doc table exactly, with `other` separate. |
| 20 | `other` needs a write-in of 40 characters or fewer; the write-in is cleared for other categories (§Decisions, §Validation) | Impl | B/events/validation.py:100-102, :110 | |
| 21 | Labels and hints in `en.json`/`es.json`; the app keeps no copy of the list (§Categories) | Impl (files) / App | B/config/settings.py:38-41; events/categories.py:69-86 | The server reads the hints from the app's language files. |
| 22 | Interests: up to 8, no duplicates, no `other`; codes `invalid_interest` and `too_many_interests` (§Decisions, §API) | Impl | B/profiles/serializers.py:9-20, :33-34, :47-48 | Duplicates return `invalid_interest`; the doc names no separate code for them. |
| 23 | Data migration maps the five old keys, drops unknown ones, logs only a count (§Data model) | Impl | B/profiles/migrations/0004_interests_to_categories.py:33-64 | |
| 24 | Old interests list removed from `/api/config` (§Data model) | Impl | B/config/views.py:13-20; events/tests/test_categories.py:29 | |
| 25 | Event fields and length limits (§Data model) | Impl | B/events/models.py:16-68 | Event language defaults to the language on the account rather than the profile, as the build notes say (MILESTONE_2:25; views.py:209). |
| 26 | Index on (neighborhood, category, starts_at) (§Data model) | Impl | B/events/models.py:72-75; migrations/0001_initial.py:223 | |
| 27 | Going: unique per user per event; undo deletes the row (§Data model) | Impl | B/events/models.py:81-89; views.py:296 | |
| 28 | EventReport model, registered in admin (§Data model) | Impl | B/events/models.py:92-101; admin.py:16-20 | |
| 29 | TranslationCache model (§Data model) | Impl | B/events/models.py:104-116 | It is not shown in admin; the doc doesn't require that. |
| 30 | Errors are codes, e.g. `start_in_past`, `daily_limit`, `event_past` (§API, LANGUAGE A6) | Impl | B/events/validation.py:95-140; views.py:207, :275-277 | |
| 31 | New events must start in the future; end must be after start (§Validation) | Impl | B/events/validation.py:129-132 | |
| 32 | A started event can't be moved by an edit (§Validation) | Impl | B/events/validation.py:124-128 | Since Milestone 3 the map pin is also locked once the event starts, and the category once it ends (validation.py:98-99). |
| 33 | Partiful URL must be https on partiful.com or www.partiful.com (§Validation) | Impl | B/events/validation.py:42-44, :138-140 | |
| 34 | "I'm going" rejected on cancelled or past events (§Validation) | Impl / Changed | B/events/views.py:274-277 | "Past" now means ended under the midnight rule (BADGES.md:91). |
| 35 | At most 10 events per user per day (§Validation) | Impl | B/events/views.py:30, :205-207 | It counts a rolling 24 hours, not a calendar day. |
| 36 | Organizer-only edit and cancel, 403 for anyone else (§API) | Impl / Changed | B/events/views.py:74-78, :235-236, :259-260 | Since Milestone 4, any admin of the posting organization can also edit and cancel. |

### Partiful prefill
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 37 | Fetch only https on allowlisted hosts; never follow a redirect to another host (§Partiful) | Impl | B/events/partiful.py:50-60 | Redirects within Partiful are followed, up to 3. |
| 38 | 3-second timeout; stop reading after 500 KB (§Partiful) | Impl | B/events/partiful.py:21-22, :39-46, :53 | The 3-second limit applies to each network step, not to the request as a whole. |
| 39 | Read only `og:title`; store no images (§Partiful) | Impl | B/events/partiful.py:26-36 | |
| 40 | Category suggested by keyword matching in both languages; no AI (§Partiful) | Impl | B/events/categories.py:89-101 | "First match" means first in category-list order, not first word in the title. |
| 41 | Any failure returns an empty result (§Partiful) | Impl | B/events/partiful.py:61-72; views.py:364-367 | |

### LANGUAGE.md Part B
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 42 | Organizer can add an alt-language title and description (B-DW1) | Impl | B/events/validation.py:114-115; M/app/event-form.tsx:173 | |
| 43 | Neighbors see the version in their language when one exists (B-DW2) | App | M/components/EventCard.tsx:18; M/app/event/[id].tsx:104-106 | The server sends both versions; the app picks one. |
| 44 | "Ver en español" / "See in English" machine-translates on request (B-DW3) | Partial (by design) | B/events/views.py:314-358; translation.py:23-32 | All the plumbing works, but no provider is switched on, so the endpoint returns `translation_unavailable` and the app hides the button (owner decision, MILESTONE_2:15-18). |
| 45 | Translation goes through a `Translator` interface (B §Data) | Impl | B/events/translation.py:21-32 | |
| 46 | Cache per event, field and target language; clear on edit (B §Data) | Impl | B/events/views.py:352-357, :245 | |
| 47 | Failure or no provider returns a code (B §Data) | Impl | B/events/views.py:337-345 | |
| 48 | "Auto-translated" label with a link to the original (B §Mobile) | App | M/app/event/[id].tsx:201-206 | The server's `machine` flag (views.py:346) tells the app when to show it. |

### Privacy and safety (MILESTONE_2 §Privacy)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| 49 | Only the going count is shown, never who | Impl | B/events/views.py:104-148, :280-286 | |
| 50 | Display names only (first name, last initial) | Impl | B/events/views.py:93-101; profiles/models.py:70-71 | |
| 51 | Event locations and descriptions never logged at info level | Impl | B/events/partiful.py:71 (the only log line in `events/`; it records the error type only) | I found no logging of event details anywhere in the backend. |
| 52 | Cancelled events keep going records; events never hard-deleted | Partial | B/events/views.py:261; admin.py:7-13 | The app's API never deletes events, but Django admin can still hard-delete one (no `has_delete_permission` override), which also deletes its going records. |
| 53 | Deleted account: upcoming events cancelled, past ones show "Former neighbor", going records removed; test required | Impl / Changed | B/accounts/views.py:123-137; events/tests/test_events_api.py:286-308 | Events already under way when the account is deleted are not cancelled (accounts/views.py:128 checks the start time). Organization events are exempt, per MILESTONE_4:63. |
| 54 | Only title and description are sent to the translator | Impl | B/events/views.py:349-356; tests/test_translate.py:62-75 | |

### Required backend tests (MILESTONE_2 §Tests; LANGUAGE B)
| # | Test | Status | Evidence | Notes |
|---|---|---|---|---|
| 55 | Create: valid input, plus each rejection code | Impl | test_events_api.py:14, :37-66 | The over-length `description_alt` case is not tested. |
| 56 | First event sets organizer role | Impl | test_events_api.py:32 | |
| 57 | Edit and cancel 403 for non-organizers | Impl | test_events_api.py:207-214 | |
| 58 | 404 for other neighborhoods on list, detail, going, report, translate | Partial | test_events_api.py:163-182 | The list endpoint returns an empty list rather than a 404, which is the only sensible behavior for a list; the rest return 404. |
| 59 | Going: mark, unmark, one per user, rejected on cancelled or past, count | Impl | test_events_api.py:247-264 | |
| 60 | List: own neighborhood only, upcoming, soonest first, group filter | Impl | test_events_api.py:129-153 | |
| 61 | Interests accept valid keys and reject unknown, `other`, duplicates and >8 | Impl | B/profiles/tests/test_interests.py:20-53 | |
| 62 | Data migration test | Impl | B/profiles/tests/test_interests.py:57-67 | It tests the conversion function, not a run of the real migration. |
| 63 | `for_you` and `matches_interests` | Impl | test_for_you.py:15-29 | |
| 64 | Config lists every group and category with English and Spanish labels (shared test) | Impl | test_categories.py:21-45 | |
| 65 | Daily limit | Impl | test_events_api.py:92-95 | |
| 66 | `sponsor_name` can't be set or read | Impl | test_events_api.py:80-90 | |
| 67 | Partiful: mocked title, potluck/limpieza suggestions, every empty-result case, no real network calls | Impl | test_partiful.py:27-101 | |
| 68 | Translate with a fake translator: caches and clears after edit | Impl | test_translate.py:23-75; B/events/testing.py | |
| 69 | 6:00 PM Denver time stored and returned correctly | Impl | test_events_api.py:112-125 | |
| 70 | Milestone 1 tests still pass | Impl | full run: 297 OK | |
| 71 | Mobile tests (whole list) | App | mobile/__tests__/events.test.tsx | Not reviewed. |
| 72 | README manual phone check | Impl | README.md:168-206 | |
| 73 | Mobile screens, design, 44 pt touch targets, safe area (§Flow, §Design) | App | M/app/(tabs)/_layout.tsx:38-51; M/app/event-form.tsx; M/app/interests.tsx:60-61 | |

### Not required by any doc (possible extras)
None of these is dead code: everything in `events/` is used. These are small additions beyond the docs, mostly harmless:
- **Map-pin limits:** pins outside a box around Denver are rejected with `invalid_pin` / `pin_outside_denver` (B/events/validation.py:19, :69-82). Milestone 3 requires a pin, but no doc asks for these limits or codes.
- **`invalid_group` error** for an unknown group filter (B/events/views.py:191-192). No doc names this code.
- **Editing a cancelled event is refused** with `event_cancelled` (B/events/views.py:237-238). No doc states this rule.
- **The translate endpoint can return the organizer's own text** instead of translating, when the target is the original language or an alt version exists (B/events/views.py:327-334). It also returns an extra `machine` field (views.py:346), which the "Auto-translated" label relies on.
- **Report reason limits:** a 200-character maximum, plus `reason_required` / `reason_too_long` codes (B/events/views.py:31, :305-309). The doc only says "short text".
- **Partiful title cut to 80 characters** (B/events/views.py:366).
- **Same-host redirect following**, up to 3 (B/events/partiful.py:23, :54-60). Allowed, but not asked for.
- **The suggestion also matches category labels**, not only the hints (B/events/categories.py:97-99).
- **The Partiful link is checked twice**, once in views.py:365 and again in partiful.py:50. Redundant but harmless.
- **Extra fields in the event data:** `is_past` (views.py:127) and `needs_pin` (views.py:124). `needs_pin` supports Milestone 3's "Add a map pin" prompt but isn't named in any doc. `organizer_member_id` (views.py:130) presumably feeds the member-badges page in MILESTONE_3:174.
- **Extra `/api/config` keys:** `other_category`, `other_max_length`, `max_interests` (B/events/categories.py:50-57).
- **Test fakes live inside the app package** (`B/events/testing.py`), not under `tests/`. They are loaded by name from settings.
## Milestone 3 (badges, map pins, attendance)

Paths are relative to the repository root.

| # | Criterion (section) | Status | Evidence (file:line) | Notes |
|---|---|---|---|---|
| **Done when** |||||
| 1 | Events require a map pin on new/edit (DW1) | implemented | `backend/events/validation.py:69-82,123`; tests `backend/events/tests/test_pins_and_timing.py:14` | The server refuses a new or edited event without a pin. |
| 2 | Old pinless upcoming events show "Add a map pin"; collect only (DW1) | implemented (backend) / app – not reviewed | `backend/events/views.py:124` (`needs_pin`); `backend/badges/engine.py:271-272`; app: `mobile/src/app/event/[id].tsx` | The server tells the app when to show the prompt, and pinless events can still be collected. |
| 3 | "Open in" sheet, Remember my choice (DW1) | app – not reviewed | `mobile/src/maps/OpenInSheet.tsx`, `mobile/src/maps/mapsPreference.ts` | Phone-only feature. |
| 4 | Auto check-in offered on first "I'm going", toggle in Settings (DW2) | implemented (backend) / app – not reviewed | `backend/profiles/models.py:48,58`; `backend/badges/views.py:248-259`; `backend/profiles/views.py:79`; app: `mobile/src/app/checkin-offer.tsx` | The server stores the setting and remembers that the offer was shown. |
| 5 | Arriving during the window records attendance (DW2) | implemented (backend) / not verifiable | `backend/badges/views.py:183-193`; `backend/badges/engine.py:270-275` | Real arrival detection needs a phone with a development build. |
| 6 | Ready-to-collect cards, Collect / I didn't make it, expire after 7 days (DW3) | implemented | `backend/badges/engine.py:348-361,314-329`; `backend/badges/views.py:143-180` | The server builds the cards and hides them after 7 days. |
| 7 | All 15 badges awarded automatically; stages never go back (DW4) | implemented | `backend/badges/engine.py:118-155,186-240` (`211` "only ever up") | Every badge is counted at the moment attendance is recorded. |
| 8 | Profile shows badges (ring design, detail) (DW5) | app – not reviewed | `mobile/src/app/(tabs)/profile.tsx`, `mobile/src/app/badges/[key].tsx`, `mobile/src/components/badges/Badge.tsx` | Phone-only drawing. |
| 9 | Show my badges to: neighborhood / only me (DW5) | implemented | `backend/profiles/models.py:50-56`; `backend/badges/views.py:121-122` | Neighbors get an empty list when the member picks "Only me". |
| 10 | My Impact: collect cards, progress bars, 3 host numbers (DW6) | implemented (backend data) / app – not reviewed | `backend/badges/engine.py:420-451`; `backend/badges/views.py:216-219`; app: `mobile/src/app/impact.tsx` | The server supplies all the numbers; sorting closest-first happens in the app. |
| 11 | Unlock moments on next open, grouped, shareable (DW7) | implemented (backend) / app – not reviewed | `backend/badges/views.py:222-236`; app: `mobile/src/app/celebrate.tsx`, `mobile/src/app/share/[key].tsx` | The server keeps "unseen" moments; grouping and sharing happen on the phone. |
| 12 | See all badges, unearned dimmed (DW8) | implemented (backend catalog) / app – not reviewed | `backend/badges/views.py:84-102`; app: `mobile/src/app/badges/index.tsx` | |
| 13 | Owner stats gains badge and attendance counts; admin shows community badges (DW9) | implemented | `backend/stats/numbers.py:92-105`; `backend/stats/templates/stats/owner_stats.html:66-82` | The community results are a section of the owner stats page, not a separate admin page. |
| 14 | Settings: four new rows (DW10) | implemented (backend fields) / app – not reviewed | `backend/profiles/serializers.py:28-29`; app: `mobile/src/app/settings.tsx`, `mobile/src/app/maps-app.tsx`, `mobile/src/app/credits.tsx` | The maps choice is stored on the phone by design. |
| 15 | Auto check-in re-offered once, ever (DW10) | implemented | `backend/badges/engine.py:398-414`; `backend/badges/views.py:165,248-259` | |
| 16 | English/Spanish and screen-reader labels (DW11) | app – not reviewed | `mobile/src/components/badges/Badge.tsx`, `mobile/__tests__/badges.test.tsx` | Error codes from the server have no wording, as required. |
| 17 | Backend and mobile tests pass, one command each (DW12) | backend implemented / mobile not verified | 297 backend tests OK; `mobile/package.json:63` | I didn't run the mobile tests. |
| **Decisions** |||||
| 18 | Thresholds in one config file and served to the app | implemented (backend) / app – not reviewed | `backend/badges/config.py:11-16`; `backend/badges/views.py:88` | Whether the app hard-codes thresholds anywhere was not checked. |
| 19 | Never demote | implemented | `backend/badges/engine.py:211`; `backend/badges/models.py:59` | |
| 20 | Badges computed when attendance is recorded, for attendee and host, no scheduled jobs | implemented | `backend/badges/engine.py:246-311` | |
| 21 | America/Denver; no end time = midnight | implemented | `backend/config/settings.py:156`; `backend/events/timing.py:13-18` | |
| 22 | Auto check-in: 150 m, 30 min before start until end, at most 20 events | implemented (backend) / app – not reviewed | `backend/badges/config.py:48-50`; `backend/badges/engine.py:388-395`; app: `mobile/src/checkin/geofencing.ts` | The phone-side fence swapping was not reviewed. |
| 23 | Location privacy: server gets only "checked in to X" | implemented | `backend/badges/views.py:189-190` (any request body is refused) | |
| 24 | Maps / Android Google Maps key as an environment setting | app – not reviewed | `mobile/app.config.ts:15,100` | |
| 25 | Getting there: deep links, app detection, per-phone choice | app – not reviewed | `mobile/src/maps/openIn.ts`, `mobile/app.config.ts:62`, `mobile/plugins/withMapAppQueries.js` | |
| 26 | Badge visibility setting doesn't affect growth | implemented | `backend/badges/views.py:121-122` (only the neighbor view reads it) | |
| 27 | Re-offer rule (off, not yet seen, 3 expired since first offer, collectors excluded) | implemented | `backend/badges/engine.py:405-414` | |
| 28 | Share card (view-shot, sharing, invite link) | app – not reviewed | `mobile/src/components/badges/ShareCard.tsx`, `mobile/src/share/shareImage.ts` | |
| 29 | Emblems (Lucide, one `<Badge>` component) | app – not reviewed | `mobile/src/components/badges/Badge.tsx`, `mobile/src/components/badges/emblems.ts` | |
| 30 | Sensitive categories: attending never counts, hosting does | implemented | `backend/badges/config.py:44`; `backend/badges/engine.py:52,369-370` | |
| 31 | Testing auto check-in needs an EAS development build | not verifiable | — | Needs real phones. |
| **Data model** |||||
| 32 | Event latitude/longitude, 6 decimals, may be empty | implemented | `backend/events/models.py:54-55`; migration `backend/events/migrations/0002_...py` | |
| 33 | Category locks after the event ends | implemented | `backend/events/validation.py:98-99` | |
| 34 | Pin locks once the event starts | implemented, with a gap | `backend/events/validation.py:124-128` | A started pinless event can still get a first pin, and can't be edited at all without one. |
| 35 | Profile: `auto_checkin`, `badge_visibility`, the two offer timestamps | implemented | `backend/profiles/models.py:48,54-59`; migration `backend/profiles/migrations/0005_...py` | |
| 36 | Attendance model, one per user per event, the only thing that counts | implemented | `backend/badges/models.py:15-33` | There is no "removed" status for events. A deleted event takes its attendance with it, but badge counts are only redone at that person's next attendance. |
| 37 | BadgeState / Keepsake / Celebration / ShareLog | implemented | `backend/badges/models.py:45-75,78-99,102-119,122-126` | BadgeState also has `earned_at`, needed for the API's earned date. The owner field became member-or-organization for Milestone 4. |
| 38 | Deleted accounts drop their rows, hosts are recounted, stages kept | implemented | `backend/accounts/views.py:104-111,137,140-141`; models delete in cascade | |
| **Badge engine** |||||
| 39 | Qualify checks (not cancelled, going, not host, timing) with error codes | implemented, with gaps | `backend/badges/engine.py:255-275` | "Not host" now also covers organization admins (changed by Milestone 4, `engine.py:87-95`). Two gaps: deleted ("removed") events have no check of their own (see #36). And `BADGES.md` says a hosted event counts once it "has ended", but the code counts it as soon as 2 people check in during the event (`engine.py:292`). |
| 40 | Idempotent | implemented | `backend/badges/engine.py:255-256` | A second call answers `already_recorded`. |
| 41 | Create Attendance with `is_first_in_neighborhood` | implemented | `backend/badges/engine.py:277-286` | It means "first one recorded", not "earliest event". These differ only if someone collects an older event after a newer one. |
| 42 | Recompute the attendee's badges (local, best_guest, groups, keepsakes) | implemented | `backend/badges/engine.py:118-155` | |
| 43 | Host side: counts as hosted at 2+, host reach, open_door, day_one to all attendees | implemented; changed by Milestone 4 | `backend/badges/engine.py:289-311,63-79` | Host credit goes to the organization when an event has one. |
| 44 | Raise stages, celebrations, Grove 2× and 3× | implemented | `backend/badges/engine.py:209-231` | |
| 45 | One database transaction | implemented | `backend/badges/engine.py:253` | It also adds row locks (beyond spec, see the list below). |
| 46 | `decline()` | implemented | `backend/badges/engine.py:314-329` | It also writes an anonymous DeclineLog row for the stats. |
| 47 | Impact numbers: brought together, first-timers, came back | implemented | `backend/badges/engine.py:420-451` | |
| 48 | Community badges, 12 months, computed on load, not stored | implemented | `backend/badges/community.py:29-56` | |
| **API** |||||
| 49 | GET `/api/badges/catalog` | implemented | `backend/badges/urls.py:8`; `backend/badges/views.py:84-102` | |
| 50 | GET `/api/me/badges` (stage, count, next threshold, earned date) | implemented | `backend/badges/views.py:28-62,105-107` | |
| 51 | GET `/api/members/{id}/badges` (404 outside neighborhood, empty if Only me) | implemented | `backend/badges/views.py:110-140` | |
| 52 | GET `/api/me/collect` with `grows` and `show_checkin_reoffer` | implemented | `backend/badges/views.py:143-166` | |
| 53 | POST collect / decline / checkin | implemented | `backend/badges/views.py:169-193`; `backend/badges/urls.py:19-21` | |
| 54 | GET `/api/me/geofences` (at most 20) | implemented | `backend/badges/views.py:196-213` | |
| 55 | GET `/api/me/impact` | implemented | `backend/badges/views.py:216-219` | Empty until the first counted hosted event. |
| 56 | Celebrations: list and mark seen | implemented | `backend/badges/views.py:222-236` | |
| 57 | POST `/api/badges/{key}/shared` | implemented | `backend/badges/views.py:239-245` | |
| 58 | PATCH `/api/profile/me` accepts the two new settings | implemented | `backend/profiles/views.py:79`; `backend/profiles/serializers.py:28-29` | |
| 59 | POST `/api/me/checkin-offer/seen` | implemented | `backend/badges/views.py:248-259` | |
| 60 | POST/PATCH `/api/events` require a pin | implemented | `backend/events/validation.py:73,123` | |
| 61 | Error codes | implemented | `backend/badges/engine.py:256-275` | All 8 example codes exist. |
| **Privacy and safety** |||||
| 62 | No location sent or stored; a test proves it | implemented | `backend/badges/views.py:189-190`; `backend/badges/tests/test_api.py:89` | |
| 63 | Pins mark the event's place, not a home | implemented (policy) | `backend/events/models.py:52-55` | Nothing in code can prove what a person types or pins. |
| 64 | Hosts never see declines, no-shows or attendees' badges | implemented | `backend/badges/engine.py:442-451` (counts only); `backend/badges/tests/test_api.py:69` | |
| 65 | Sensitive categories excluded from credit and hints | implemented | `backend/badges/engine.py:52,369-370`; `backend/badges/tests/test_api.py:63` | |
| 66 | ShareLog stores no user | implemented | `backend/badges/models.py:122-126` | |
| 67 | No info-level logs of check-in/collect with user ids | implemented | no logger calls in `backend/badges/`; `backend/config/settings.py:300-315` | Django's own warnings log the page path only. No test covers this. |
| **Backend tests** |||||
| 68 | record_attendance: valid, rejections, twice; every badge at each stage | partially | `backend/badges/tests/test_engine.py:15,30,56,89-134` | Missing: Host reach and Day One past Seed, and the hosted side of group badges past Seed (only `test_engine.py:147,160`). |
| 69 | Sensitive categories | implemented | `backend/badges/tests/test_engine.py:138` | |
| 70 | Hosted 2+, crossing credits the group badge, Day One incl. earlier collectors | implemented | `backend/badges/tests/test_engine.py:151,172` | |
| 71 | Keepsakes (Ambassador, Open Door, Familiar Face incl. gap, Year-Rounder) | implemented | `backend/badges/tests/test_engine.py:191,203,216,228` | Open Door has no test showing a machine translation doesn't count. The code only reads the organizer's `title_alt`, so it can't count one anyway. |
| 72 | Never demote; Grove milestones | implemented | `backend/badges/tests/test_engine.py:245,253,266` | |
| 73 | Impact numbers (4 cases) | implemented | `backend/badges/tests/test_impact.py:13,23,34,45` | |
| 74 | Decline; ignored card gone after 7 days | implemented | `backend/badges/tests/test_api.py:45,55` | |
| 75 | No end time = midnight; category lock | implemented | `backend/events/tests/test_pins_and_timing.py:51,66`; `backend/badges/tests/test_engine.py:71` | |
| 76 | `/checkin` takes no location; `/geofences` at most 20 and skips pinless | implemented | `backend/badges/tests/test_api.py:89,104` | |
| 77 | `/members/{id}/badges`: 404 and Only me | implemented | `backend/badges/tests/test_api.py:135,139` | |
| 78 | Re-offer flag | implemented | `backend/badges/tests/test_api.py:195,203,211` | |
| 79 | Pinless events can be collected; ShareLog has no user | implemented | `backend/badges/tests/test_engine.py:65`; `backend/badges/tests/test_api.py:166` | |
| 80 | Owner stats new counts; community badges from fixtures | partially | `backend/badges/tests/test_community.py:14,22,28,39` | Missing: tests for the group rule (6 events, 20 neighbors) and "Known for showing up"; stage-up counts aren't checked. |
| 81 | Earlier milestones' tests still pass | implemented | full suite: 297 OK | |
| 82 | Mobile tests and the manual real-phone check | app – not reviewed / not verifiable | `mobile/__tests__/badges.test.tsx`, `mobile/__tests__/settings.test.tsx` | The real-phone check can't be done from code. |

### Not required by any doc
- **Full member page `GET /api/members/{id}`** (name, photo, member since, badges): `backend/badges/views.py:110-135`, `backend/badges/urls.py:17`. The docs only list `/members/{id}/badges`. The app's `mobile/src/app/member/[id].tsx` probably uses it.
- **Pins must be inside a box around Denver** (`pin_outside_denver`, `invalid_pin`): `backend/events/validation.py:19,69-82`. Milestone 1's "outside Denver" rule is about addresses, not pins.
- **Row locks to stop two people collecting at once from double-counting:** `backend/badges/engine.py:173-183,302-311` (`_locked_states`, `lock_order`) and `backend/badges/tests/test_concurrency.py`. The docs ask only for one transaction. This is defensive extra work, and the test is skipped unless the database is Postgres.
- **DeclineLog model:** `backend/badges/models.py:129-132`. It's not in the data model list, but the "declines" stat needs something to count, so it's justified.
- **Extra catalog fields** (`stages`, `grove_milestone_multipliers`, `collect_window_days`): `backend/badges/views.py:96-101`. Small.
- **"Mark seen" can take a list of ids** (otherwise it marks all): `backend/badges/views.py:232-234`. Small.
- **No dead code:** every function in the badges, events, profiles, stats and accounts apps is used somewhere.

Related deviation (GO_LIVE §4, not Milestone 3): `last_seen_at` is stored on the account record (`backend/accounts/models.py:20`), while the doc says "the member's profile". It works the same way.
## Milestone 4 (push notifications, organizations)

Paths start inside `backend/` unless they begin with `mobile/`, `.do/` or `README`.

### Done when (§Done when)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| D1 | Reminder the day before, in the member's language; a cancel notice instead if cancelled | Implemented (backend) | notifications/scheduling.py:22-36, 65-84; texts.py:52-60; events/views.py:264, 291, 297 | The server does this; actual arrival on a phone can only be checked on real devices. |
| D2 | Opt-in; asked once; Settings toggles | Implemented (backend); app – not reviewed | profiles/models.py:64-67; profiles/views.py:79; notifications/views.py:41-48; app: mobile/src/app/notif-offer.tsx, settings.tsx | Reminders are off until the member turns them on. |
| D3 | Any member can request an org; live only after admin approval | Implemented | organizations/views.py:194-217; models.py:56; admin.py:68-76 | |
| D4 | Admins post as org to served neighborhoods; "Hosted by" | Implemented (backend) | events/views.py:154-174, 132-141 | |
| D5 | Org page (name, type, photo, description, neighborhoods, badges, upcoming/past, follow) | Implemented (backend); app – not reviewed (mobile/src/app/organizations/[id].tsx) | organizations/views.py:137-181 | |
| D6 | Following tag + Following filter; no push on follow | Implemented (backend) | events/views.py:69, 142, 196-197; FollowView organizations/views.py:348-362 (no push code) | |
| D7 | Org badges; posting member gets no host credit | Implemented | badges/engine.py:63-79, 158-170, 289-304 | |
| D8 | Org impact screen with the 3 numbers | Implemented (backend); app – not reviewed (mobile/src/app/organization-impact.tsx) | badges/views.py:75-81; engine.py:420-451 | |
| D9 | New owner-stats numbers + approval queue | Implemented | stats/numbers.py:108-134; stats/templates/stats/owner_stats.html:85-100; organizations/admin.py:37-124 | |
| D10 | English and Spanish | Partially verified | push strings in mobile/src/i18n/en.json:587-595; error codes present in en/es (grep) | Spanish wording still needs the owner's review (README:586). |
| D11 | One-command tests pass | Implemented | test runs above | Both suites green. |

### Decisions table
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| X1 | Expo push, one token per device, invalid tokens removed | Partial | notifications/models.py:13-20 (token unique); push.py:59-63 | Invalid tokens are removed only when Expo flags them in the immediate reply. Expo's later delivery "receipts" are never fetched, so many dead tokens may never be cleaned up. |
| X2 | 5:00 PM Denver the day before, set in config; none if tapped later | Implemented | notifications/config.py:6; scheduling.py:22-36 | |
| X3 | `send_due_notifications` every 15 min on DO, in README, safe to run twice | Implemented in code; DO run not verifiable | management/commands/send_due_notifications.py:14-19; sending.py:36-38 (atomic claim); .do/app.yaml:98-108; README.md:555-559 | The job is configured. Whether DigitalOcean accepts and runs it can only be confirmed after a deploy. |
| X4 | Cancellation notice right away to members going with alerts on | Implemented | scheduling.py:65-84; sending.py:30; events/views.py:264; accounts/views.py:147-151 | If Expo is down, the job retries it (approved decision). |
| X5 | Push text: title + time only, never meeting spot | Implemented | texts.py:52-60; en.json:588-589 | Edge case: a reminder held up past midnight by an outage still says "Tomorrow" (sending.py:27 only checks the event hasn't started). |
| X6 | Permission ask: one screen, after auto check-in offer, Turn on / Not now | Backend implemented; app – not reviewed (mobile/src/app/notif-offer.tsx) | notifications/views.py:41-48; profiles/serializers.py:73 | |
| X7 | Org types stored as keys, labels in en/es | Implemented | organizations/models.py:24; en.json:611-619 | |
| X8 | Businesses: rule shown on the approval screen and the posting screen, reportable, sponsor hidden | Partial | rule in admin: organizations/admin.py:43, 60-62; `business_rule` check: views.py:67-68; reports: views.py:365-375; sponsor_name stays out of the API: events/views.py:104-148 | Admin and API are done. The posting-screen text is app – not reviewed (mobile/src/app/event-form.tsx). |
| X9 | At least 1 neighborhood; each event in exactly one served neighborhood; page visible if it serves the caller | Implemented (API) | views.py:72-81, 104-115; events/views.py:170-173 | Django admin does not stop staff from removing every neighborhood (inline at admin.py:23-26 has no minimum). |
| X10 | 1–5 admins; requester is the first admin | Partial | views.py:216, 326-327, 339-340 | Enforced in the API. The admin-screen "Admins" inline (admin.py:29-34) has no `max_num`, so staff can add more than 5. |
| X11 | Approval needed for new orgs and name/type/neighborhood changes; invisible until approved | Implemented | views.py:104-108, 266-288; admin.py:110-139; events/views.py:168-169 | |
| X12 | Last admin leaves → org hidden, events stay | Implemented | accounts/views.py:114, 125-131, 142-145; views.py:339-340 | If a still-pending org loses its admin, it becomes "hidden". Pressing "Approve" after assigning an admin then makes it live without the normal review. |
| X13 | Name never translated; optional other-language description + translate button | Implemented (backend) | models.py:48-53; views.py:378-401 | |
| X14 | Follower count only to admins | Implemented | views.py:162-167 | |

### Organization badges (§Organization badges, BADGES.md:324-334)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| B1 | Orgs earn host + group badges + clean_sweeper + civic_voice + open_door, and never attendance badges | Implemented | badges/config.py:82-83; engine.py:158-170 | |
| B2 | Host credit goes to the org; posting member gets none | Implemented | engine.py:63-79 | |
| B3 | Counts only with 2 neighbors | Implemented | engine.py:291-297; config.py:51 | |
| B4 | Admins get no attendance credit at their org's events | Implemented (approved variant) | engine.py:87-95, 259-260, 335-345 | Checked against who is an admin when attendance is recorded, per the approved decision. |
| B5 | Best Guest: an org counts as one host | Implemented | engine.py:68-72, 132 | |
| B6 | Day One: an org's first counted event counts | Implemented | engine.py:292-300 | |
| B7 | `<Badge>` display; "Organization badges" label; no ranking | Backend implemented; app – not reviewed (mobile/src/app/organizations/[id].tsx) | badges/views.py:70-72 | The API returns no rankings. |
| B8 | No celebrations for orgs | Implemented | engine.py:238-239 | |

### Data model (§Data model)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| M1 | PushToken (user, token, platform, created, last-used) | Implemented | notifications/models.py:13-20 | |
| M2 | Preference fields on Profile | Implemented | profiles/models.py:64-67 | |
| M3 | ScheduledNotification: fields, unique (user, event, kind), created on tap and deleted on untap | Implemented | notifications/models.py:26-47; scheduling.py:28-41 | Adds an extra `delivered` flag, used by the stats. |
| M4 | Organization fields and statuses | Implemented | organizations/models.py:40-61 | `link` is a plain URLField. The https rule is enforced only in the API (views.py:91-98), so staff could enter an http link in admin. |
| M5 | OrganizationNeighborhood / OrganizationAdmin / ChangeRequest / Follow (one per pair) | Implemented | models.py:73-128 | |
| M6 | Event.organization FK; organizer kept for the team | Implemented | events/models.py:35-37; events/admin.py:8-9 | |
| M7 | BadgeState/Keepsake with two FKs and an exactly-one check; one engine; `host_of` | Implemented | badges/models.py:36-99; engine.py:63-65 | |
| M8 | `record_attendance` rejects org admins (`is_host`) | Implemented | engine.py:259-260 | |

### API (§API)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| A1 | POST/DELETE /api/me/push-tokens | Implemented | notifications/urls.py:6; views.py:24-38 | |
| A2 | PATCH /api/profile/me with the 2 toggles | Implemented | profiles/serializers.py:30-31; profiles/views.py:79 | |
| A3 | POST /api/me/notif-offer/seen | Implemented | notifications/urls.py:7 | |
| A4 | POST /api/organizations (starts pending) | Implemented | organizations/views.py:194-217 | |
| A5 | GET /api/organizations/{id} with all listed fields, admin extras, 404 rule | Implemented | views.py:111-115, 137-181, 244-246 | For members, upcoming events and past count cover only their own neighborhood (approved decision). |
| A6 | PATCH /api/organizations/{id} | Partial | views.py:248-289; photo at views.py:292-310 (urls.py:153) | The photo changes through a separate `POST /organizations/{id}/photo`, not through PATCH as the spec says. |
| A7 | POST/DELETE /api/organizations/{id}/admins | Implemented | views.py:313-345 | DELETE takes `member_id`, not an email. |
| A8 | PUT/DELETE /api/organizations/{id}/follow | Implemented | views.py:348-362 | |
| A9 | GET /api/organizations?neighborhood= (A–Z, no counts) | Partial | views.py:188-192 | The `neighborhood` parameter is ignored; it always uses the caller's own neighborhood, which matches the spec's intent. |
| A10 | GET /api/me/organizations | Implemented | views.py:220-240 | |
| A11 | GET /api/organizations/{id}/impact | Implemented | badges/urls.py:7; badges/views.py:75-81 | |
| A12 | POST /api/events with `organization` | Implemented | events/views.py:154-174, 210-214 | |
| A13 | GET /api/events?following=true; events carry `organization` and `is_following` | Implemented | events/views.py:132-142, 196-197 | |
| A14 | POST /api/organizations/{id}/report | Implemented | views.py:365-375 (mirrors events/views.py:300-310) | |
| E1 | `not_org_admin` | Used | organizations/views.py:121; events/views.py:167 | |
| E2 | `org_not_approved` | Used | events/views.py:169; organizations/views.py:353 | |
| E3 | `neighborhood_not_served` | Used | events/views.py:173 | |
| E4 | `too_many_admins` | Used | organizations/views.py:327 | |
| E5 | `last_admin` | Used | organizations/views.py:340 | |
| E6 | `not_a_member` | Used | organizations/views.py:323 | |
| E7 | `invalid_link` | Used | organizations/views.py:97 | |
| E8 | `business_rule` | Used | organizations/views.py:68 | Raised when a Business request doesn't send `business_rule_accepted: true`. |

All 8 codes have en/es strings.

### Admin (§Admin)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| AD1 | Approval queue (orgs + change requests), Approve/Reject, reason required | Implemented | organizations/admin.py:37-124; stats template links to the filtered queues at owner_stats.html:87-88 | Approve and Reject are list "actions" rather than buttons. To reject, staff first type the reason into the record, then run Reject. |
| AD2 | Assign an admin to a hidden org | Implemented | admin.py:29-34, 68-76 | |
| AD3 | Stats: orgs by type and status, pending, follows, org vs member events (30 days), reminders and cancellations sent (30 days), % of active members with notifications on | Implemented | stats/numbers.py:108-134; owner_stats.html:85-100 | "Notifications on" counts members whose phone has a registered token, not members with the reminders toggle on. |

### Privacy (§Privacy and safety)
| # | Criterion | Status | Evidence | Notes |
|---|---|---|---|---|
| P1 | Push text has no spot, address or names | Implemented | texts.py:52-60 | |
| P2 | Tokens deleted on logout and on account deletion | Implemented | accounts/views.py:55-62; notifications/models.py:16 (CASCADE) | |
| P3 | Posting admin never shown in the app | Implemented | events/views.py:93-101, 128-130 | |
| P4 | Org photos follow M1 rules | Implemented | organizations/views.py:303 (clean_photo, EXIF removed); models.py:34-37; config/settings.py:195-197 (private bucket) | |
| P5 | Following is private | Implemented in the API | organizations/views.py:167 | The Follow admin screen (organizations/admin.py:149-156) still lets staff open a record and see which member follows. |
| P6 | No tokens or text in info logs | Implemented | notifications/push.py:34 (logs only the error type) | |

### Backend tests (§Tests)
| # | Spec test | Status | Evidence |
|---|---|---|---|
| T1 | 5 PM / none if late | Implemented | notifications/tests/test_notifications.py:56, 62 |
| T2 | Untap removes the reminder | Implemented | test_notifications.py:66 |
| T3 | Job run twice sends once | Implemented | test_notifications.py:72 |
| T4 | Cancellation goes only to members going with alerts on | Implemented | test_notifications.py:168 |
| T5 | Invalid tokens removed; Expo mocked | Implemented | test_notifications.py:36-38, 154 |
| T6 | Push text has no `location_text` | Implemented | test_notifications.py:85 |
| T7 | Request is pending and invisible | Implemented | organizations/tests/test_organizations.py:19 |
| T8 | Approval visible in its neighborhoods, 404 elsewhere | Implemented | test_organizations.py:51 |
| T9 | Edits create a change request | Implemented | test_organizations.py:60 |
| T10 | 1–5 admins / last admin refused / deletion hides | Implemented | test_organizations.py:99, 109, 115 |
| T11 | Posting: admins only / not served / poster hidden | Implemented | test_organizations.py:154, 173, 179 |
| T12 | Badges: credits org / 2 attendees / host and group badges / `is_host` / Best Guest / Day One / M3 unchanged | Implemented | organizations/tests/test_org_badges.py:14, 26, 50, 63, 71, 86 |
| T13 | Following and follower count | Implemented | test_organizations.py:192, 207 |
| T14 | Owner stats show the new counts | Implemented | organizations/tests/test_owner_stats.py:16, 41 |
| T15 | Earlier milestones still pass | Implemented | full suite OK (297 tests) |

### Other findings
- **README points to a missing admin screen.** README.md:241 tells the owner to change a reminder's "send at" time in admin under "Scheduled notifications". No admin page exists for ScheduledNotification or PushToken (there is no `notifications/admin.py`), so that manual-test step can't be followed.
- **Can't be checked from code:** push actually arriving on iPhone or Android (needs development builds, Firebase, the Apple account and an Expo token), and the DigitalOcean scheduled job running.

### Not required by any doc
- notifications/scheduling.py:87-96 `schedule_upcoming_reminders`: dead code. Nothing calls it; migration notifications/migrations/0002_backfill_reminders.py:6-23 does the same job.
- organizations/views.py:47, 197-201: limit of 3 organization requests per day (`daily_limit`). No doc asks for it. It also counts organizations where the member was merely added as an admin.
- organizations/views.py:314 plus config/settings.py:252: `org_admins` throttle of 20/hour. Not in the docs.
- organizations/admin.py:149-156: FollowAdmin screen. Not required, and it weakens "nobody sees who follows" (see P5).
- organizations/views.py:168-170: `change_pending` flag in the org page reply. Not in the spec, though harmless.
- organizations/views.py:292-310: separate photo endpoint. It replaces the PATCH route the spec asks for; it is a deviation, not dead code.
- organizations/views.py:404-407 `GET /api/neighborhoods` and models.py:140-145 / views.py:378-401 (description translation): not in the M4 API table, but they support the request form and the LANGUAGE.md Part B translate button. Justified.
- notifications/models.py:43 `delivered` field: not in the spec. It is used for the stats "sent" counts, so it's justified.
