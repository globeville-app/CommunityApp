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
4. Enter your first and last name, add a photo, pick some interests → **Finish**.
5. The profile shows your photo, "First L.", the neighborhood, and your interests.
6. **Close the app completely** (swipe it away) and reopen it from Expo Go → you're still
   logged in and land on your profile.
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

**Look and feel.** The design rules are in `design/DESIGN.md`, and the logo
rules in `design/BRAND.md`. The logo, app icons and splash image are the brand
files in `mobile/assets/brand/`; the logo is drawn by
`mobile/src/components/brand/Wordmark.tsx` (and the small "gb" mark by `GbMark.tsx`).
Your own icon only shows in a real build; Expo Go always shows its own icon. Colors, fonts
and spacing live in one place, `mobile/src/theme.ts`; the shared pieces
(buttons, fields, glass cards, the slide-up panel) are in `mobile/src/ui.tsx`,
and the moving glow behind every screen is `mobile/src/components/GlowBackground.tsx`.
The glow holds still when the phone's Reduce Motion setting is on. Stats,
badges and the bottom tab bar from the design come in later milestones.

### Privacy guarantees and the tests that check them

| Promise | Where it's tested |
| --- | --- |
| No address in any table, uploaded file, response or log after the full flow | `backend/config/tests/test_privacy.py` |
| No model has an address/coordinate field | same file |
| Geocoder errors and logs never contain the address | `backend/geocoding/tests/test_client.py` |
| Unexpected errors log only the error type | `backend/neighborhoods/tests/test_match_api.py` |
| EXIF/GPS stripped from JPEG and PNG | `backend/profiles/tests/test_profile_api.py` |
| Address field cleared after a match, never stored or passed between screens | `mobile/__tests__/join-flow.test.tsx` |
| No analytics libraries on the phone; AsyncStorage only for the language, in one file | `mobile/__tests__/privacy.test.ts` |
| App name only in `shared/app_config.json` | `backend/config/tests/test_app_name.py` |

### API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | app name, interest keys, languages |
| POST | `/api/auth/signup` | email + password (+ `language`) → token and language |
| POST | `/api/auth/login` | email + password → token and the account's language |
| POST | `/api/auth/logout` | deletes the token |
| POST | `/api/join/match` | address → neighborhood (rate-limited: 10/min per user) |
| PUT | `/api/profile` | first name, last name, alias, interest keys (+ `language`) |
| POST | `/api/profile/photo` | photo upload (multipart, field `photo`) |
| GET | `/api/profile/me` | your profile, or 404 `profile_not_found` |
| PATCH | `/api/profile/me` | `{"language": "en" \| "es"}`; works before the profile exists |

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
