# Community app — Milestone 1: Join

A person signs up, types their Denver address, sees which of Denver's 78
official neighborhoods they live in, picks a local name for it (e.g. LoHi for
Highland), and sets up a profile. **The street address is never saved**: not on
the server and not on the phone.

The full spec is in [`docs/MILESTONE_1.md`](docs/MILESTONE_1.md).

**Reviewing the code?** Start with [`docs/REVIEWERS_GUIDE.md`](docs/REVIEWERS_GUIDE.md).

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

Reminders and organizations (Milestone 4, `docs/MILESTONE_4.md`). Push
notifications need a development build too (see "Push notifications" below).

1. Profile → gear → turn on **Event reminders** (allow notifications).
2. Tap **I'm going** on an event for tomorrow. At 5:00 PM Denver time today a
   push arrives: "Tomorrow 10:00 AM · [title]", with no meeting spot. (To try
   it sooner, run `python manage.py send_due_notifications --all-now` on your
   computer: it sends every waiting reminder straight away.)
3. With another account, post an event; tap **I'm going** from the first
   account, then cancel the event. The cancellation notice arrives right away.
4. Settings → **Your organizations** → **Request an organization**. Approve it
   in admin (Organizations → select it → "Approve"). Post an event as it
   (**Post as**), and **Follow** it from a second account.
5. Collect that event from two accounts. The organization's Host badge grows
   (its page, and **Organization impact**), while the posting admin's own
   Host badge doesn't.

### Test accounts

Each account needs its own email, but it doesn't have to be real. On your
computer nothing is really emailed: the 6-digit code that confirms a new
account (and the "Forgot password?" code) is printed in the terminal where
`runserver` is running. Look for "Your code is". Use made-up emails like
`ana.test1@example.com`, `ana.test2@example.com`. To switch accounts on one phone: Profile → gear →
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
| Attending a resource fair or donation drive never counts, shows in a hint, or is stored (only a count per event) | `backend/badges/tests/test_engine.py`, `mobile/__tests__/badges.test.tsx` |
| App name only in `shared/app_config.json` | `backend/config/tests/test_app_name.py` |

### API

**Old app versions stay on phones for months.** So the API only ever *adds*
fields and endpoints; never rename or remove one that a published app uses.
When a change can't avoid breaking old apps, ship the new app first, then set
`MIN_APP_VERSION` (e.g. `1.2.0`) on the server: older apps show "Time to
update" with a link to the store (`ios_store_url` / `android_store_url` in
`shared/app_config.json`, filled in once the app is published).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | app name, languages, and the event category groups (also used for interests) |
| POST | `/api/auth/signup` | email + password (+ `language`) → token and language |
| POST | `/api/auth/login` | email + password → token and the account's language |
| POST | `/api/auth/logout` | ends this phone's login (each phone has its own; unused ones expire after 90 days) |
| POST | `/api/auth/password-reset` | email → emails a 6-digit code (same reply for unknown emails) |
| POST | `/api/auth/password-reset/confirm` | email + code + new password → logs out every device, returns a fresh token |
| POST | `/api/account/verify-email` | the code from the welcome email; until then other endpoints answer `email_not_verified` |
| POST | `/api/account/verify-email/resend` | a new code (the old one stops working) |
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
| PUT/DELETE | `/api/members/{id}/block` | block or unblock a neighbor: their own events disappear for this member only; they're never told |
| GET | `/api/me/blocks` | the members this member blocked (Settings → Blocked members) |
| GET | `/api/me/collect` | Ready to collect cards, plus `show_checkin_reoffer` |
| POST | `/api/events/{id}/collect` · `/decline` | collect attendance · "I didn't make it" |
| POST | `/api/events/{id}/checkin` | auto check-in; **the body must be empty** |
| GET | `/api/me/geofences` | the next 20 events to watch (pin and time window) |
| GET | `/api/me/impact` | host numbers; `{}` until an event counts as hosted |
| GET / POST | `/api/me/celebrations` · `/seen` | unlock moments not shown yet · mark shown |
| POST | `/api/badges/{key}/shared` | count a share (badge and date only) |
| POST | `/api/me/checkin-offer/seen` | `{"which": "first" or "reoffer"}` |
| POST / DELETE | `/api/me/push-tokens` | register / forget this phone's Expo push token |
| POST | `/api/me/notif-offer/seen` | the one-time notification ask was shown |
| PATCH | `/api/profile/me` | also `reminders_enabled`, `cancellation_alerts_enabled` |
| GET / POST | `/api/organizations` | approved organizations serving your neighborhood, A–Z / request a new one (always the caller's own neighborhood: a `?neighborhood=` parameter, which MILESTONE_4.md lists, is ignored on purpose) |
| GET / PATCH | `/api/organizations/{id}` | an organization's page / edit (admins; name, type and neighborhoods wait for approval) |
| POST | `/api/organizations/{id}/photo` | its photo (admins). MILESTONE_4.md puts the photo in `PATCH /api/organizations/{id}`; a separate upload works better for large files on a slow connection |
| POST / DELETE | `/api/organizations/{id}/admins` | invite a member by email (approved organizations; same reply for any email) / remove an admin; 1–5, counting open invitations |
| DELETE | `/api/organizations/{id}/invites` | cancel the open invitations (admins see only how many) |
| GET | `/api/me/organization-invites` | invitations waiting for this member's answer |
| PUT / DELETE | `/api/me/organization-invites/{id}` | accept (become an admin) / decline |
| PUT / DELETE | `/api/organizations/{id}/follow` | follow / unfollow |
| POST | `/api/organizations/{id}/report` · `/translate` | report it · its description in another language |
| GET | `/api/organizations/{id}/impact` | admins: impact numbers and badge progress |
| GET | `/api/me/organizations` | the ones you run, with status (for **Post as**) |
| GET | `/api/neighborhoods` | Denver's 78 neighborhoods |
| GET | `/api/events?following=true` | events from organizations you follow |

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

When a member deletes their account (`POST /api/account/delete`), or the team
deletes them in Django admin, the same routine runs
(`backend/accounts/deletion.py`) and everything tied to them goes: login, profile,
photo file, tokens, interests and their neighborhood match. Their problem
reports stay, with the person removed, so the team can still fix bugs.

**Rule for every future feature: content tied to a deleted member is either
removed or shown as "Former neighbor / Exvecino," never with their name.**
When a feature adds data that points at a member, update `delete_member` and
its tests (`backend/accounts/tests/test_delete_account.py`). For Milestone 2:

- upcoming events they organized are cancelled
- past events they organized show "Former neighbor"
- their "I'm going" records are removed

For Milestones 3 and 4:

- their attendance, badges, keepsakes and unlock moments are removed; hosts'
  numbers drop them, but hosts' stages are never lowered
- their push tokens and scheduled notifications are removed; neighbors going
  to their cancelled events get a cancellation notice
- events they posted for an organization stay (they belong to the
  organization); if they were its last admin, a live organization is hidden
  (one still waiting for review keeps waiting)
- blocks they made, and blocks of them, are removed
- organization invitations to them are removed
  until the team assigns a new admin

---

## How long data is kept

Kept as long as the account exists, because participation history and impact
are built from them: the account and profile, attendance, badges, follows,
organization roles, and each event's title, category, neighborhood, time and
host. A daily job (`python manage.py cleanup_old_data`, `cleanup-old-data` in
`.do/app.yaml`) deletes the rest once its job is done:

| What | When |
| --- | --- |
| Meeting spot and descriptions of past events, and their cached translations | 1 year after the event |
| "I'm going" taps | 1 year after the event |
| Reminders that were sent | 30 days after sending |
| Phone push tokens | not used for 90 days |
| Celebrations already seen | 90 days after being seen |
| Event and organization reports, decided organization changes, problem reports (with screenshots) | 1 year |
| Logins unused for 90 days, expired email codes | as soon as they stop working |

`python manage.py cleanup_old_data --dry-run` shows what it would delete.
The rules live in `backend/accounts/retention.py`; the privacy policy should
say the same.

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
| `SERVER_ERROR_EMAILS` | Who gets a short email when the server crashes (only the kind of error and the page, never anyone's data). |
| `DATABASE_URL` | Filled in by DigitalOcean from the database (`${db.DATABASE_URL}`). |

3. Deploy. Every push to `main` deploys again; before each deploy the
   `migrate` job updates the database, the rate-limit table and the
   neighborhood map.
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

**Check once after the first deploy: rate limits see real addresses.** At
the bottom of the owner stats page, "Your address as the server sees it"
should match what https://ifconfig.me shows on the same computer. If it
shows something else (or the same address from your phone on cellular),
the `CLIENT_IP_HEADER` setting is wrong: tell your developer, because then
everyone shares one login limit.

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

### Staging server (optional, recommended for the beta)
A second, private copy of the server to try a release on your own phone
before members get it: the first deploy, push notifications, the health
check and the rate-limit check above. It has its own small database, so
nothing there touches real members.
1. Push the branch you want to try to a branch called `staging` (GitHub →
   branches, or ask your developer).
2. DigitalOcean → Apps → Create App → "Import from app spec" →
   `.do/staging.yaml`. Fill in every `CHANGE_ME` with **new** values (never
   production's), and a separate Spaces bucket, e.g. `globeville-staging`.
3. Add the DNS record for `api-staging.globeville.app`.
4. Build the app for it: `npx eas build --profile staging`. That build talks
   to staging only.

The admin there says **(STAGING)** in its header. It sends no real push
notifications (`PUSH_ENABLED=0`); set it to `1` in the dashboard when you
want to try push on your own phone. Switch the staging app off when you
don't need it, to save money.

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

## Push notifications (Milestone 4)

Reminders go out at 5:00 PM Denver time the day before (change
`REMINDER_HOUR` in `backend/notifications/config.py`). The server sends them
through Expo's push service:

- **The sending job.** `python manage.py send_due_notifications` sends every
  reminder that's due. On DigitalOcean it runs every 15 minutes as a
  scheduled job (`send-notifications` in `.do/app.yaml`); confirm it shows
  under the app's Jobs after the first deploy. It's safe to run twice. On
  your computer, run it by hand when you want to test. The same job then runs
  `python manage.py count_hosted_events`: a hosted event only counts once it
  has ended (docs/BADGES.md), so when neighbors checked in during an event
  and nobody collects it afterwards, this is what credits the host.
- **Expo project.** In `mobile/`, run `npx eas init` once; put the project id
  it prints in `mobile/.env` as `EAS_PROJECT_ID=...` (and in the EAS build
  profiles). Push tokens need it.
- **Android (Firebase).** Create a free Firebase project, add an Android app
  with the package `app.globeville`, download `google-services.json` into
  `mobile/`, and upload a Firebase service-account key in the Expo account
  (Project → Credentials → Android → FCM V1). Expo's guide: "Push
  notifications setup" in the Expo docs.
- **iPhone.** Needs the Apple Developer membership; `eas build` sets up the
  push key the first time.
- **Expo access token** (optional, recommended). Turn on "enhanced push
  security" in the Expo account, create an access token, and set it as
  `EXPO_ACCESS_TOKEN` on the server (`.do/app.yaml` has a slot for it).

Push text is only the event's title and start time, never the meeting spot,
because it shows on locked screens. Push tokens are removed on logout from
that phone and on account deletion.

## Milestone 4: what needs you

- **Firebase project** for Android push, and the Expo project id (above).
- **Approval checklist:** what the team checks before approving an
  organization (a real group, a real local presence, an authorized requester).
- **First organizations:** 3–5 real groups to invite first.
- **Business rule wording:** approve `organizations.business_rule` in
  `mobile/src/i18n/en.json` and `es.json` (Django admin shows it too).
- **Spanish review** of the new screens (`notifications`, `organizations`,
  and `push` for the notification text).

Decisions made while building (approved defaults):

- Organization admins can open, edit and cancel their organization's events
  in any neighborhood; other members still see only their own neighborhood.
  On an organization's page, members see only their neighborhood's events.
- A reminder is created for every "I'm going" and the settings are checked
  when it's sent, so turning reminders on later still covers earlier taps.
  Reminders move with the event's time; none is sent twice.
- Pushes use the organizer's own Spanish title when there is one, never a
  machine translation.
- Cancellation notices go out at once (retried by the job if Expo is down),
  also when an organizer's account deletion cancels their events.
- Organization events are never cancelled by an account deletion. If the
  last admin leaves, the organization is hidden and its events stay listed;
  the team assigns a new admin in Django admin, then uses "Approve".
- "Admins don't get attendance credit" is checked when attendance is
  recorded (at most 7 days after the event).

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

- A real email service (Postmark) so the email codes and problem reports are
  actually sent; until then a server can run with
  `REQUIRE_EMAIL_VERIFICATION=0`
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
