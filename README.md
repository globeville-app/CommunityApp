# Community app — Milestone 1: Join

A person signs up, types their Denver address, sees which of Denver's 78
official neighborhoods they live in, picks a local name for it (e.g. LoHi for
Highland), and sets up a profile. **The street address is never saved**: not on
the server and not on the phone.

The full spec is in [`docs/MILESTONE_1.md`](docs/MILESTONE_1.md).

**Trying it on your phone for the first time on Windows?** Follow the
step-by-step guide in [`docs/TESTING_ON_YOUR_PHONE.md`](docs/TESTING_ON_YOUR_PHONE.md),
which covers every snag from a real first run. The sections below are the short version.

```
shared/app_config.json   ← the ONLY place the app name is written
backend/                 ← Python (Django) API: login, address matching, profiles
mobile/                  ← the phone app (Expo / React Native, TypeScript)
docs/                    ← the milestone spec
```

To rename the app, change `shared/app_config.json` and nothing else.

---

## 0. One-time setup

Install these on your computer:

| What | Version | Where |
| --- | --- | --- |
| Python | 3.12 or newer | <https://www.python.org/downloads/> |
| Node.js | 22 LTS | <https://nodejs.org/> |
| Git | any | <https://git-scm.com/> |

On your phone, install **Expo Go** from the App Store or Google Play. It must
support **Expo SDK 57**; the store version normally matches the newest SDK.

Your phone and computer must be on the **same Wi-Fi network**.

---

## 1. Get the Denver neighborhood file (required, once)

The app needs Denver's official neighborhood boundaries. Follow
[`backend/data/SOURCE.md`](backend/data/SOURCE.md) to download
`denver_statistical_neighborhoods.geojson` into `backend/data/`, then fill in
the source details on that page.

Until the file is there, 9 data tests show as "skipped" and address matching
won't work.

---

## 2. Run the backend

Open a terminal in the `backend` folder.

**Mac / Linux**

```bash
python3 -m venv .venv            # create a private Python environment (once)
source .venv/bin/activate        # turn it on (every new terminal)
pip install -r requirements.txt  # install the libraries (once, or when they change)
python manage.py migrate         # create the database (once, or after model changes)
python manage.py load_neighborhoods   # load the 78 neighborhoods (once, or after a new file)
python manage.py runserver 0.0.0.0:8000
```

**Windows (PowerShell)**

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py load_neighborhoods
python manage.py runserver 0.0.0.0:8000
```

`0.0.0.0` lets your phone reach the server, not just your computer. Leave this
terminal open while you use the app. If your computer asks whether to allow
incoming connections for Python, say **Allow**.

Optional: `python manage.py createsuperuser` creates an admin login for
<http://localhost:8000/admin/>, where you can see users, profiles,
neighborhoods and **problem reports** (with their screenshots).

**Problem report emails.** Each report sends a short email to the addresses
in the `PROBLEM_REPORT_EMAILS` environment variable (comma-separated). While
developing, emails are printed in this terminal instead of being sent. To
try it, start the server like this:

```bash
PROBLEM_REPORT_EMAILS="you@example.com" python manage.py runserver 0.0.0.0:8000      # Mac / Linux
```

```powershell
$env:PROBLEM_REPORT_EMAILS="you@example.com"; python manage.py runserver 0.0.0.0:8000 # Windows
```

For real sending, set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
plus `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` and
`DEFAULT_FROM_EMAIL` from your email service. Never put an address in the code.

---

## 3. Find your computer's local IP address

The phone needs your computer's address on the Wi-Fi:

- **Mac:** `ipconfig getifaddr en0`
- **Windows:** `ipconfig`, then look for "IPv4 Address" under your Wi-Fi adapter
- **Linux:** `hostname -I`

It looks like `192.168.1.23` or `10.0.0.42`.

Check it from your **phone's** browser: `http://<that IP>:8000/api/config`
should show the app name and a list of interests. If it doesn't load, see
Troubleshooting below.

---

## 4. Run the phone app

Open a second terminal in the `mobile` folder.

1. Copy `.env.example` to a new file called `.env` and set your IP:

   ```
   API_BASE_URL=http://192.168.1.23:8000
   ```

2. Install and start:

   ```bash
   npm install       # once, or when package.json changes
   npx expo start
   ```

3. A QR code appears. On iPhone, scan it with the Camera app; on Android, scan
   it from inside Expo Go. The app opens in Expo Go.

If you change `.env`, stop Expo (Ctrl+C) and run `npx expo start` again.

---

## 5. Run the tests

**Backend** (in `backend/`, with the environment turned on):

```bash
python manage.py test
```

**Mobile** (in `mobile/`):

```bash
npm test
npm run typecheck   # optional: checks TypeScript types
```

Tests never call the real geocoder or need a phone.

---

## 6. Manual check on a real phone

Do this once with the backend running and the Denver file loaded:

1. Open the app → **Sign up** with an email and password.
2. Under **Where's home?**, type a Denver address (e.g. a public building, not your home).
   A panel slides up with your neighborhood.
3. If the address is in Highland, you're offered "Highland" or "LoHi". Pick one, then **Join**.
4. Enter your first and last name, add a photo → **Finish**. Pick a few interests
   on **What are you into?** (or **Skip for now**).
5. You land on the **Events** tab. The **Profile** tab shows your photo, "First L.",
   the neighborhood, and your interests.
6. **Close the app completely** (swipe it away) and reopen it from Expo Go → you're still
   logged in and land on Events.
7. Bonus: try an Aurora or Lakewood address. You should see the
   "only in the City and County of Denver" message.

Settings & Support (start the server with `PROBLEM_REPORT_EMAILS` set, as in
step 2, and create an admin login with `createsuperuser`):

1. Profile → gear → **Report a problem**. Type a message, add a screenshot,
   **Send**. The email appears in the server terminal.
2. Open <http://localhost:8000/admin/support/problemreport/>, open the report,
   view the screenshot, set the status to **Resolved** and save.
3. Log out, then tap **Having trouble?** on the welcome screen and send a
   report while logged out.
4. Log out and back in.
5. Sign up a test account, then Settings → **Delete account** with its
   password. You land on the welcome screen with "Your account was deleted."
   Logging in with it now fails.

Neighborhood calendar (Milestone 2). You need more than one account; see
"Test accounts" just below.

1. With account A, switch to **Español** (Profile → gear). On **Eventos**, tap
   **Publicar un evento**, pick a category, paste a Partiful link, fill in the
   details and **Publicar**.
2. Log out. Sign up account B with an address in the **same** neighborhood,
   leave it in English, and find the event. Tap **See in English** (it only
   works once a translation provider is set up; until then the button hides
   itself) and **I'm going**.
3. Log out. Sign up account C with an address in a **different** neighborhood.
   The event isn't there.
4. Log back in as A. Open the event, **Edit** it, then **Cancel event**.

Badges and attendance (Milestone 3, `docs/MILESTONE_3.md`). Step 2 needs an
EAS **development** build (see "App builds" below), because auto check-in
can't run in Expo Go; everything else works in Expo Go.

1. With account A, post an event and drop its pin on the map (the last step).
2. With account B on a second phone running the development build: tap
   **I'm going**, choose **Turn on** for auto check-in and allow location
   **Always**. During the event, walk to the pin. Without tapping anything,
   B's badge grows: Profile → **My Impact** shows it, and an unlock moment
   appears the next time the app opens.
3. With account C on a third phone: tap **I'm going** and choose **Not now**.
   After the event ends, Profile → **My Impact** → **Collect**. Then tap
   **I didn't make it** on another event's card.
4. Log back in as A and open **My Impact**: "Your events brought together 2
   neighbors" (the event counts as hosted once 2 people went).
5. Open a badge (Profile → Badges) → **Share** → pick Messages. The picture
   shows only the first name, and the message has the invite link.

To try collecting without waiting for a real event, give an account an event
that's already over in the admin (change its start and end to yesterday).

### Test accounts

Each account needs its own email, but it doesn't have to be real: nothing
is emailed at sign-up. Use made-up ones like `ana.test1@example.com`,
`ana.test2@example.com`. To switch accounts on one phone: Profile → gear →
**Log out**, then **Sign up** (or **Log in**) as the other one.

To put accounts in the same or different neighborhoods, use public places
(two accounts can use the same address; it is never stored):

| Address | Neighborhood |
| --- | --- |
| `2620 16th St, Denver, CO 80211` (Little Man Ice Cream) | Highland |
| `1701 Wynkoop St, Denver, CO 80202` (Union Station) | Union Station |

To see accounts, events and reports, open <http://localhost:8000/admin/> with
the admin login from `createsuperuser`.

---

## Browser demo (for showing people)

`mobile/` can also build a clickable demo that runs in any web browser, with no
backend and no phone needed:

```bash
cd mobile
npm run demo:build      # writes mobile/web-demo/index.html (one self-contained file)
```

The demo uses the real screens, with a pretend backend inside the page
(`src/demo/fakeBackend.ts`). The neighborhood check uses Denver's **real**
boundaries (the build embeds `backend/data/denver_statistical_neighborhoods.geojson`),
but the address lookup is **simulated**, because a web page can't reach the
Census geocoder. The demo knows the locations of a few public sample
addresses, recognizes Denver neighborhood names typed into the address, and
treats nearby suburb names as outside Denver. Everything stays in that browser.

Only the browser uses the demo files (`*.web.ts`, `*.web.tsx`); the phone app
never loads them.

---

## How it works

**Address → neighborhood.** The phone sends the address once to
`POST /api/join/match`. The backend asks the free US Census Geocoder for its
latitude and longitude (`backend/geocoding/client.py`), checks which neighborhood
shape contains that point (`backend/neighborhoods/geo.py`), and saves only the
neighborhood for that user. The address and coordinates exist only in memory
during that one request.

**Why the server remembers the match.** When the profile is saved, the
neighborhood comes from the server's own match, not from the phone, so nobody
can join a neighborhood they didn't match an address to.

**Boundary rule.** A point exactly on the line between two neighborhoods goes
to the one with the lowest neighborhood ID, so the answer is always the same.

**Picking up where you left off.** When the app opens with a saved login, it asks
for the profile: no profile yet → the Address screen; otherwise → the Profile
screen. If you close the app between matching and saving your profile, you'll
re-enter the address, because it's never saved.

**Photos.** The phone picker hands back a JPEG (this converts iPhone HEIC
photos). The server only accepts JPEG/PNG up to 5 MB, copies just the pixels into
a fresh image (removing EXIF data, which can include GPS location), and saves it
under a random filename.

**English and Spanish.** The rules are in `docs/LANGUAGE.md`. Every word
the app shows is in `mobile/src/i18n/en.json` and `es.json`; a lint rule
(`npm run lint`, also run by `npm test`) fails on any text typed straight into
a screen. The **English | Español** toggle is at the top right of every
screen before joining, and on the profile. The choice is kept on the phone
(AsyncStorage key `app.language`) and on the account, which is created at
signup, before the profile exists, so that's where the server keeps it. The
Spanish is a first draft: see `docs/RELEASE_CHECKLIST.md`.

**Events (Milestone 2).** `backend/events/`. The category list is defined once
in `events/categories.py` and sent to the app by `/api/config`; the words and
search hints are in the app's language files. Interests are the same category
keys. A Partiful link is only ever fetched from `https://partiful.com`, with a
3-second timeout and a 500 KB cap, to read the page title. Machine translation
goes through `events/translation.py`; no provider is switched on yet.

**Look and feel.** The design rules are in `design/DESIGN.md`, and the logo
rules in `design/BRAND.md`. The logo, app icons and splash image are the brand
files in `mobile/assets/brand/`; the logo is drawn by
`mobile/src/components/brand/Wordmark.tsx` (and the small "gv" mark by `GvMark.tsx`).
Your own icon only shows in a real build; Expo Go always shows its own icon. Colors, fonts
and spacing live in one place, `mobile/src/theme.ts`; the shared pieces
(buttons, fields, glass cards, the slide-up panel) are in `mobile/src/ui.tsx`,
and the moving glow behind every screen is `mobile/src/components/GlowBackground.tsx`.
The glow holds still when the phone's Reduce Motion setting is on. Stats
from the design come in a later milestone.

### Privacy guarantees and the tests that check them

| Promise | Where it's tested |
| --- | --- |
| No address in any table, uploaded file, response or log after the full flow | `backend/config/tests/test_privacy.py` |
| No model has an address/coordinate field | same file |
| Geocoder errors and logs never contain the address | `backend/geocoding/tests/test_client.py` |
| Unexpected errors log only the error type | `backend/neighborhoods/tests/test_match_api.py` |
| EXIF/GPS stripped from JPEG and PNG | `backend/profiles/tests/test_profile_api.py` |
| Address field cleared after a match, never stored or passed between screens | `mobile/__tests__/join-flow.test.tsx` |
| No analytics libraries on the phone; AsyncStorage only for the language and the maps app choice | `mobile/__tests__/privacy.test.ts` |
| Auto check-in sends no location: the request has no body, the server refuses one, nothing stores one | `mobile/__tests__/privacy.test.ts`, `backend/badges/tests/test_api.py` |
| Share counts keep no member; hosts never see who declined | `backend/badges/tests/test_api.py` |
| Attending a resource fair or donation drive never counts or shows in a hint | `backend/badges/tests/test_engine.py`, `mobile/__tests__/badges.test.tsx` |
| App name only in `shared/app_config.json` | `backend/config/tests/test_app_name.py` |

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | app name, languages, and the event category groups (also used for interests) |
| POST | `/api/auth/signup` | email + password (+ `language`) → token and language |
| POST | `/api/auth/login` | email + password → token and the account's language |
| POST | `/api/auth/logout` | deletes the token |
| POST | `/api/join/match` | address → neighborhood (rate-limited: 10/min per user) |
| PUT | `/api/profile` | first name, last name, alias, interest keys (+ `language`) |
| POST | `/api/profile/photo` | photo upload (multipart, field `photo`) |
| GET | `/api/profile/me` | your profile, or 404 `profile_not_found` |
| PATCH | `/api/profile/me` | `{"language": ...}` and/or `{"interests": [category keys]}` (up to 8, no `other`) |
| GET | `/api/events?group=&for_you=true` | upcoming events in your neighborhood, soonest first |
| POST | `/api/events` | post an event in your neighborhood (10 a day) |
| GET / PATCH | `/api/events/{id}` | event detail / edit (organizer only) |
| POST | `/api/events/{id}/cancel` | cancel (organizer only); events are never deleted |
| PUT / DELETE | `/api/events/{id}/going` | "I'm going" on / off; only the count is ever shown |
| POST | `/api/events/{id}/report` | report an event (appears in admin) |
| POST | `/api/events/partiful-preview` | `{url}` → `{title, suggested_category}` |
| POST | `/api/events/{id}/translate` | `{target}` → title and description in that language |
| GET | `/api/badges/catalog` | every badge's rules (thresholds from `backend/badges/config.py`) |
| GET | `/api/me/badges` | your 15 badges: stage, count, next threshold |
| GET | `/api/members/{id}` (`/badges`) | a neighbor's member page; badges empty if they chose Only me |
| GET | `/api/me/collect` | Ready to collect cards, plus `show_checkin_reoffer` |
| POST | `/api/events/{id}/collect` · `/decline` | collect attendance · "I didn't make it" |
| POST | `/api/events/{id}/checkin` | auto check-in; **the body must be empty** |
| GET | `/api/me/geofences` | the next 20 events to watch (pin and time window) |
| GET | `/api/me/impact` | host numbers; `{}` until an event counts as hosted |
| GET / POST | `/api/me/celebrations` · `/seen` | unlock moments not shown yet · mark shown |
| POST | `/api/badges/{key}/shared` | count a share (badge and date only) |
| POST | `/api/me/checkin-offer/seen` | `{"which": "first" or "reoffer"}` |

Events in another neighborhood answer 404, as if they didn't exist. Times go
in and come out in Denver time and are stored in UTC.

Every error is a code, never a sentence: `{"code": "outside_denver"}`, plus
`"fields": {"email": ["email_taken"]}` for form errors. The app shows each code
in the person's language (`mobile/src/i18n/*.json`, under `errors`).

---

## Troubleshooting

- **"Can't reach the server" in the app.** Check that the backend terminal is still
  running, that `mobile/.env` has the right IP with `http://` and `:8000`,
  that the phone is on the same Wi-Fi (not cellular or a guest network), and
  that your computer's firewall allows Python. Test with
  `http://<IP>:8000/api/config` in the phone's browser.
- **"We can't look up addresses right now."** The Census geocoder is slow or
  down; try again in a minute.
- **Expo Go says the project is incompatible.** Update Expo Go from the store.
  This project uses Expo SDK 57.
- **Your IP changed** (new network, router restart): update `mobile/.env` and restart Expo.

---

## Deleting members: the rule every feature follows

When a member deletes their account (`POST /api/account/delete`, in
`backend/accounts/views.py`), everything tied to them goes: login, profile,
photo file, tokens, interests and their neighborhood match. Their problem
reports stay, with the person removed, so the team can still fix bugs.

**Rule for every future feature: content tied to a deleted member is either
removed or shown as "Former neighbor / Exvecino," never with their name.**
When a feature adds data that points at a member, update the delete view and
its tests (`backend/accounts/tests/test_delete_account.py`). For Milestone 2:

- upcoming events they organized are cancelled
- past events they organized show "Former neighbor"
- their "I'm going" records are removed

---

## Going live (DigitalOcean, docs/GO_LIVE.md)

Everything below is done once, by the owner, in web dashboards. The code is
ready: `Dockerfile` builds the server, `.do/app.yaml` describes the whole app,
and `mobile/eas.json` has the three app build profiles. Secrets only ever go
into the DigitalOcean dashboard, never into this repository.

### 1. Accounts and the domain
1. Buy `globeville.app` (any registrar) and create accounts at DigitalOcean,
   Postmark, Expo, Apple Developer and Google Play.
2. In Postmark, add the sender `hello@globeville.app` and the DNS records it
   asks for (DKIM and Return-Path), so emails aren't marked as spam.

### 2. Storage for photos (Spaces)
1. DigitalOcean → Spaces → create a bucket, e.g. `globeville-media`, in
   `sfo3`, with **File listing: Restricted** (private).
2. API → Spaces Keys → generate a key. Keep the key and secret for step 3.

### 3. The app (server, database, domain)
1. Apps → Create App → **Import from app spec** → upload `.do/app.yaml`.
2. Fill in every `CHANGE_ME` (Settings → App-Level / Component environment
   variables):

| Setting | What to put |
| --- | --- |
| `DJANGO_SECRET_KEY` | 60+ random characters (a password manager can make one). The same value in the `migrate` job. |
| `ADMIN_URL` | A path only you know, ending in `/`, e.g. `team-7f3k/`. Admin then lives at `https://api.globeville.app/team-7f3k/`. |
| `SPACES_BUCKET`, `SPACES_KEY`, `SPACES_SECRET` | From step 2 (`SPACES_ENDPOINT` and `SPACES_REGION` match the bucket's region). |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Postmark → Server → API Tokens: the server token, as both. |
| `PROBLEM_REPORT_EMAILS` | Who gets problem reports, comma-separated. |
| `DATABASE_URL` | Filled in by DigitalOcean from the database (`${db.DATABASE_URL}`). |

3. Deploy. Every push to `main` deploys again; before each deploy the
   `migrate` job updates the database and the neighborhood map.
4. Settings → Domains: add `api.globeville.app` and create the DNS record it
   shows. HTTPS certificates are automatic.
5. Check from a phone's browser: `https://api.globeville.app/api/config`
   shows the app name and categories.

The server refuses to start if `DJANGO_SECRET_KEY` is missing, so a forgotten
secret fails loudly instead of running insecurely.

### 4. Admin, with two-step login
In production the admin asks for a password **and** a 6-digit code from an
authenticator app (Google Authenticator, 1Password, Authy...). Open the
app's **Console** tab in DigitalOcean and run, once per staff member:

```bash
python manage.py createsuperuser
python manage.py add_admin_2fa <their username>
```

Scan the QR code it prints with the authenticator app. Then sign in at
`https://api.globeville.app/<ADMIN_URL>`. The owner stats page is linked at the
top of the admin home page.

### 5. Backups: practice one restore before the beta
The managed database takes a daily backup automatically. Once, before Phase A:
1. Databases → your cluster → **Backups & Restore** → **Restore from backup**
   → pick the latest → restore to a **new** cluster (never over the live one).
2. When it's ready, open the new cluster's **Connection details**, copy its
   connection string, and in the app's Console run:
   `DATABASE_URL="<that connection string>" python manage.py shell -c "from django.contrib.auth.models import User; print(User.objects.count())"`
   The number should match the live member count on the owner stats page.
3. Delete the scratch cluster (it costs money while it exists).

Photos in Spaces aren't backed up separately yet; the Phase B checklist
revisits that.

### 6. App builds (EAS)
From `mobile/`, after `npx eas login`:

| Profile | Points at | Used for | Command |
| --- | --- | --- | --- |
| `development` | your computer's backend (`mobile/.env`) | testing auto check-in (Milestone 3), which Expo Go can't do | `npx eas build --profile development --platform android` |
| `preview` | `https://api.globeville.app` | Phase A beta | `npx eas build --profile preview --platform all`, then `npx eas submit --profile preview` |
| `production` | `https://api.globeville.app` | the stores (Phase B) | `npx eas build --profile production --platform all`, then `npx eas submit` |

- The app's store ID is `app.globeville` (in `mobile/app.config.ts`). It can
  never change once the app is in a store.
- Raise `VERSION` in `mobile/app.config.ts` for each store release; EAS
  counts up the build number by itself.
- iPhone builds need the Apple Developer membership; EAS walks you through
  signing the first time.
- Store privacy answers are drafted in `docs/STORE_PRIVACY.md`.

---

## Milestone 3: what needs you

- **Android maps key:** create a Google Maps key for Android and set
  `GOOGLE_MAPS_ANDROID_KEY` (in `mobile/.env`, and as an EAS secret for
  builds). Without it, Android shows an empty map; iPhone needs no key.
- **Apple Developer account** to put a development build on an iPhone for
  testing auto check-in (Android needs none).
- **Location wording:** approve the auto check-in screen
  (`checkin.*` in `mobile/src/i18n/en.json` / `es.json`) and the phone's
  permission text (`expo-location` in `mobile/app.config.ts`), in both languages.
- **Spanish review:** badge names and descriptions, stage names, and the new
  screens (`badges`, `impact`, `checkin`, `share`, `celebrate`, `maps` in `es.json`).
- **Invite link:** `https://globeville.app` (`invite_url` in
  `shared/app_config.json`) should exist before Phase B.

Known limits:

- Android's share sheet takes the picture but not the message text; the
  link printed on the card does the inviting there. iPhone gets both.
- Auto check-in notices arriving, so someone already inside the area more
  than 30 minutes before the start isn't checked in; they can still collect.
- Emblem accents follow Lucide 1.59.0. Where a part moved since 1.47.0, it
  matches the description in `BADGE_UI.md` (see `mobile/src/components/badges/emblems.ts`).
- Lucide icons are copied in by `node mobile/scripts/gen-badge-icons.mjs`
  (run it again after updating `lucide-static`).

## Not in this milestone (and still needed before real users)

- Email verification and password reset
- A decision on minimum age (COPPA). See "Open items" in the spec.
- Real hosting (the backend currently runs on your computer only), HTTPS,
  and a production database
- App Store / Play Store builds and accounts
- Address autocomplete (not allowed by the free geocoders)
- Real privacy policy and terms pages (Settings shows "Coming soon" until
  `privacy_url` and `terms_url` are set in `shared/app_config.json`)
- An email sending service for problem reports (for example Postmark or Amazon SES)
- A translation provider for "Ver en español" / "See in English" (Google Cloud
  Translation or DeepL). The code is ready: write a class like
  `events.testing.FakeTranslator` that calls the provider, and set
  `TRANSLATOR_CLASS` to its path. Until then the button hides itself.
