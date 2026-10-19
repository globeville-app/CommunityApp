# Reviewer's guide: globeville v1

Thank you for reviewing. This page tells you what the app is, how to run it,
where things live, and where to look hardest. It should take 10 minutes to read.

## What the app is

A neighborhood app for Denver. People join by typing their address; the app
works out which of Denver's 78 official neighborhoods they live in and then
**forgets the address**. Inside, they see and post events for their
neighborhood only, earn badges for showing up, follow local organizations and
get reminders. English and Spanish throughout.

- **Backend:** Python 3.12+ / Django 5.2 / Django REST Framework, token auth.
  SQLite in development, Postgres in production (DigitalOcean App Platform).
- **App:** Expo SDK 57 / React Native / TypeScript, expo-router. A browser
  build of the same screens runs against a pretend in-page backend for demos.
- **Size:** about 15,000 lines of code (not counting tests, translations or
  generated data); 290 backend tests and 175 app tests.
- **Built by:** an AI coding assistant (Claude Code) working from the owner's
  specs, one milestone at a time. The owner is learning Python, so the code
  favors plain, commented code over clever code. Please flag anything that
  would trip up a newcomer maintaining it.

## The specs

Everything the app is supposed to do is in `docs/`. Read them as the
requirements to check the code against:

| Doc | Covers |
| --- | --- |
| `MILESTONE_1.md` | Sign up, address → neighborhood, profile, photo |
| `SETTINGS.md` | Settings, problem reports, account deletion |
| `LANGUAGE.md` | English/Spanish, translation of events |
| `MILESTONE_2.md` | Neighborhood events: post, edit, cancel, "I'm going", report |
| `MILESTONE_3.md`, `BADGES.md`, `BADGE_UI.md` | Map pins, attendance (auto check-in or collect), badges, impact numbers, share cards |
| `MILESTONE_4.md` | Push reminders, organizations, following, organization badges |
| `GO_LIVE.md` | Hosting, production settings, the owner stats page |

Where the code made a decision the specs left open, it's listed in the
README under "Milestone 3: what needs you" and "Milestone 4: what needs you"
(the owner approved each one).

## Running it

The README has the full steps (sections 0–5). In short:

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate && python manage.py load_neighborhoods
python manage.py test            # all backend tests
python manage.py runserver 0.0.0.0:8000

# App
cd mobile
npm install
npm test                         # all app tests
npx tsc --noEmit && npm run lint # types and the "no hard-coded text" rule
npx expo start                   # Expo Go on a phone, or press w for a browser
```

No secrets are needed to run or test anything locally. The Denver
neighborhood boundaries file is in the repo (`backend/data/`). Maps on
Android, push notifications and auto check-in only work in an EAS
development build on a real phone (not Expo Go), so you can't try those
without the owner's accounts; their logic is covered by tests with the
phone's features mocked.

## Where things live

```
shared/app_config.json    The app name and links: the ONLY place the name is written (a test enforces it)
backend/
  config/                 settings.py (dev + production), urls, error codes, privacy/production tests
  accounts/               signup, login, logout, account deletion, last-seen tracking
  geocoding/              address → coordinates (US Census geocoder); the address is never stored
  neighborhoods/          point-in-polygon against Denver's boundaries; local names ("LoHi")
  profiles/               profile, photo (EXIF stripped), settings fields
  events/                 events, "I'm going", reports, translation, Partiful preview
  badges/                 attendance, the badge engine, impact numbers, community badges
  notifications/          push tokens, reminder scheduling, sending (Expo)
  organizations/          organizations, admins, approval, follows
  stats/                  the owner stats page (inside Django admin)
  support/                problem reports with screenshots
mobile/src/
  app/                    one file per screen (expo-router)
  api.ts / apiTypes.ts    every call to the backend; api.web.ts swaps in the demo backend
  components/badges/      the <Badge> drawing and the share card
  checkin/                auto check-in (geofencing)
  maps/                   pin map, "Open in" maps sheet
  notifications/          push permission and token registration
  i18n/                   en.json / es.json (every word the app shows)
  demo/                   the pretend backend for the browser demo only
```

Files ending in `.web.ts(x)` are the browser demo's stand-ins for phone-only
features; the phone uses the file without `.web`.

## Where to look hardest

### 1. Privacy promises (most important)

The app makes these promises to its members. Please try to break them.

| Promise | Code | Tests |
| --- | --- | --- |
| A home address is never stored, logged or kept on the phone | `backend/neighborhoods/views.py`, `backend/geocoding/client.py`, `mobile/src/app/address.tsx` | `backend/config/tests/test_privacy.py`, `mobile/__tests__/join-flow.test.tsx`, `mobile/__tests__/privacy.test.ts` |
| Photos lose their EXIF/GPS data | `backend/profiles/photos.py` | `backend/profiles/tests/` |
| Auto check-in never sends or stores a location (the check-in request has no body) | `mobile/src/checkin/geofencing.ts`, `backend/badges/views.py` (CheckinView) | `backend/badges/tests/test_api.py`, `mobile/__tests__/privacy.test.ts` |
| Nobody sees who is going to an event, only the count; hosts never see who declined | `backend/events/views.py` (`event_json`), `backend/badges/` | `backend/badges/tests/test_api.py` |
| Push text never includes the meeting spot | `backend/notifications/texts.py` | `backend/notifications/tests/` |
| The admin who posts for an organization is never shown in the app | `backend/events/views.py` (`organizer_name`) | `backend/organizations/tests/test_organizations.py` |
| Deleting an account removes the member's data (see the README section "Deleting members") | `backend/accounts/views.py` (DeleteAccountView) | `backend/accounts/tests/`, `backend/badges/tests/`, `backend/organizations/tests/` |
| Production logs never contain addresses or report text | `backend/config/settings.py` (logging) | `backend/config/tests/test_production.py` |

### 2. Who can see and do what

Members see only their own neighborhood's events (other neighborhoods get a
404, as if the event didn't exist). Organization admins can also manage their
organization's events in other neighborhoods. Please check every view in
`events/`, `badges/` and `organizations/` for a way to read or change
something you shouldn't: `get_event`, `events_for`, `can_manage` in
`backend/events/views.py`, and `get_org`, `admin_org` in
`backend/organizations/views.py`.

### 3. Security basics

- Token login (`rest_framework.authtoken`); tokens are kept in the phone's
  secure storage (`mobile/src/tokenStorage.ts`).
- Rate limits: `DEFAULT_THROTTLE_RATES` in `backend/config/settings.py`.
- Django admin: moved to a secret path, with a required two-step code in
  production (`django-otp`).
- Production settings: `backend/config/settings.py` (the `else:` branch under
  "Security", used when `DJANGO_DEBUG=0`), checked by `manage.py check
  --deploy` in a test.
- Uploads: photo type and size checks in `backend/profiles/photos.py`;
  private storage for problem-report screenshots.

### 4. The badge engine

`backend/badges/engine.py` is the most involved logic: it records attendance
and recomputes every affected badge in one transaction, never lowers a stage,
and (Milestone 4) gives host credit to an organization instead of the member
who posted. The rules are in `docs/BADGES.md`. Correctness and race
conditions (two people collecting at once) are worth a look.

### 5. Scheduled notifications

`backend/notifications/sending.py` must never send a reminder twice, even if
the 15-minute job overlaps itself. It claims each row with a single
conditional UPDATE before sending.

## Known gaps and limits

Things we know about, so you don't need to report them (but tell us if one
matters more than we think):

- **Never run on real phones:** the map pin, auto check-in (geofencing),
  push notifications and the share-card image. Their logic is tested with the
  phone features mocked.
- **Never deployed:** the Docker image and `.do/app.yaml` were checked by
  running the same steps by hand (migrate, collectstatic, gunicorn), not by a
  real Docker build or a DigitalOcean deploy. The scheduled-job section of
  the spec hasn't been confirmed in DigitalOcean.
- **No CI:** tests run by hand; there is no GitHub Actions workflow yet.
- **No Python linter or formatter** is set up for the backend (the app has
  ESLint and TypeScript checks).
- **Expo push receipts aren't checked.** Invalid tokens are removed when
  Expo's immediate reply says so, but not from the later receipts.
- **The badge engine recomputes a member's counts from all their attendance**
  on every collect. Fine at launch scale; would need work at large scale.
- **The owner stats page is computed on every load,** with no caching.
- **Auto check-in notices arriving,** so someone already inside the area
  more than 30 minutes before the start isn't checked in (they can collect).
- **Android's share sheet** gets the badge picture without the message text.
- **Not set up yet:** a translation provider (the "See in English" button
  hides itself), Postmark email, the Android maps key and Firebase. These need
  the owner's accounts.
- **The browser demo's pretend backend** (`mobile/src/demo/`) copies some
  rules from the real backend. It's for showing people only and never ships
  in the phone app.

## What we'd like back

A list of findings, each with:

- **where** (file and line),
- **what's wrong** and how it could happen,
- **how serious** it is: *blocker* (must fix before real users), *should fix*,
  or *suggestion*,
- if you can, a suggested fix.

Please don't push changes to the main branch; comment on the pull request
instead, unless the owner has asked you to make fixes.
