# 03 – Security & compliance (Step 3)

This step looks for ways someone could break in, see data they shouldn't,
or misuse the app. It also checks what Apple, Google and privacy law expect.
Nothing has been changed.

Severity:
- **critical**: exploitable now, serious harm.
- **high**: fix before real users.
- **medium**: fix soon.
- **low**: hardening.

**Verified** means I checked it by running code, not only by reading it.

> This is not legal advice. The compliance notes say what the *code* does
> and what a lawyer or the store forms will ask about.

## Summary in plain language

The basics are done well:
- no secrets in the code or its history;
- passwords are stored the standard safe Django way;
- every endpoint needs a login except the four that must be open;
- members can only see their own neighborhood;
- addresses are never stored;
- photos are cleaned of GPS data;
- the admin needs a two-step code in production;
- the production security settings pass Django's own deploy check.

The main problems:

1. **Rate limits can be skipped by faking one header** (verified). Anyone
   can guess passwords as fast as they like by adding a made-up
   `X-Forwarded-For` header to each try. **high**
2. **Any organization admin can make any member an admin of their
   organization, just by typing their email,** without asking that member.
   That also tells the admin whether an email belongs to a member. **medium**
3. **Apple requires a "block this user" feature in apps where people post
   content.** There isn't one. Without it the app may be rejected. **high**
   (store risk, not a hack)
4. **No privacy policy or terms yet, no data export, and no rule for how
   long data is kept.** Mostly owner actions (see the end).

## Findings

### S1. Throttles trust a header the client controls — high (verified)

- **What:** DRF decides "who is this?" for rate limits from the
  `X-Forwarded-For` header when there is one. The setting that tells it how
  many proxies to trust, `NUM_PROXIES`, isn't set
  (`backend/config/settings.py:229-254`). DRF then uses the *whole* header,
  which the client can make up.
- **Test I ran:** 22 wrong logins from one address gave `429` (blocked)
  from the 21st try on. 30 wrong logins, each with a different made-up
  `X-Forwarded-For`, all got `400` and were never blocked.
- **Affected:** login and signup (`auth`, password guessing), the address
  lookup (`join_match`, abuse of the free Census geocoder), and signed-out
  problem reports (`problem_report`, spam to the team inbox).
- **Fix:** set `"NUM_PROXIES": 1` in `REST_FRAMEWORK`, since DigitalOcean
  App Platform adds one proxy. The number of proxies must be confirmed on
  the first deploy. Then move the throttle counts to a shared cache (Step 1,
  G1). Also consider a per-account limit on wrong passwords, such as 10 per
  hour per email, so a spread-out attack on one account is still slowed down.

### S2. Admin-add by email: no consent, and reveals membership — medium

- **What:** `POST /api/organizations/{id}/admins` adds any member, found by
  email, as an admin straight away (`backend/organizations/views.py:316-329`).
  The reply is `not_a_member` when the email isn't a member, so it shows
  whether that email has an account. It's limited to 20 tries per hour per
  admin. The organization can even be one that is still pending.
- **Why it matters:**
  - a member can be put on an organization's admin list, and get its
    admin screens, without agreeing;
  - an organization admin could check whether a particular person uses
    the app;
  - someone can create their own "organization" just to do this.
- **Fix:** send an invite the member must accept, with the same reply
  whether or not the email exists. A smaller first step: only allow it for
  approved organizations, and lower the limit.

### S3. No way to block another member (Apple Guideline 1.2) — high (store)

- **What:** members post events and organizations, and can **report** them
  (`backend/events/views.py:301-311`, `backend/organizations/views.py:365-375`).
  There is no way to **block** a member or hide their content.
- **Why it matters:** Apple's App Review Guideline 1.2 (user-generated
  content) asks for:
  - a filter for objectionable content;
  - a way to report it;
  - a way to block abusive users;
  - published contact details.

  Reporting and contact (problem reports) exist. Blocking doesn't. Apps are
  regularly rejected for this. Google Play's UGC policy is similar.
- **Fix:** add "Block this member": the blocker no longer sees that
  member's events or member page. Also promise in the terms to act on
  reports within 24 hours, which Apple also expects.

### S4. Authorization on every endpoint — OK

- **Default:** every view requires a login (`backend/config/settings.py:236`).
- **Open endpoints:** only `/api/config`, signup, login, and the signed-out
  problem report (`backend/config/views.py:10`,
  `backend/accounts/views.py:23,35`, `backend/support/views.py:37`). That
  is what the docs ask for.
- **Data scoping:**
  - Events, collect, decline, check-in and translate all go through
    `get_event` → `events_for`, which only returns the member's own
    neighborhood, plus their own organization's events
    (`backend/events/views.py:52-86`).
  - Edit and cancel also check `can_manage`.
  - Member pages return 404 outside the neighborhood
    (`backend/badges/views.py:115`).
  - Organization changes go through `admin_org`.
- **Staff-only areas:** owner stats sit behind the admin login.
  Problem-report screenshots are only served to staff (`support/admin.py`).
- **Known by design:** check-in and collect are trusted. The server can't
  tell whether someone really attended, because no location is sent (a
  privacy decision in `BADGES.md`). Anyone could collect every event in
  their neighborhood. The only harm is inflated badges.

### S5. Input validation and injection — OK

- No raw SQL: no `.raw()`, `.extra()` or `cursor` calls in the app code. The
  only `cursor` is in a privacy test that reads every table. Every query uses the ORM, which protects against SQL injection.
- Inputs are checked with serializers or explicit checks, with length
  limits on every text field.
- Event links must be https Partiful links. Organization links must be
  https.
- The Partiful fetch only goes to allow-listed hosts, never follows
  redirects to other hosts, has a 3-second timeout and stops after 500 KB
  (`backend/events/partiful.py`). That guards against the server being used
  to reach other sites (SSRF).
- Photos are checked:
  - JPEG/PNG only, 5 MB maximum;
  - rebuilt from pixels only, which drops GPS and EXIF data;
  - capped at 2048 px, with Pillow's built-in guard against huge images
    (`backend/profiles/photos.py`).
- One gap: the organization link's https rule is only checked in the API,
  not in the admin (Step 1, G5).

### S6. Passwords and tokens — mostly OK

- Passwords use Django's default PBKDF2 hashing, with Django's four
  password rules (`backend/config/settings.py:148`). The fast MD5 hasher is
  only used when the tests are running (`settings.py:316-318`).
- Login gives the same error for a wrong email and a wrong password.
  Signup does say `email_taken`, as most apps do.
- Tokens are random 40-character keys, stored in plain form in the database
  (DRF's standard token). A database leak would expose working tokens.
  Hashing them, which `django-rest-knox` does, would prevent that. See
  Step 2, A2, for expiry and per-device tokens.
- No password reset (Step 2, A1).

### S7. CORS, HTTPS, headers, admin — OK

- **CORS:** no CORS package is installed, so browsers on other sites can't
  call the API. Phone apps don't need CORS, and the browser demo uses its
  own pretend backend.
- **Production** (`DJANGO_DEBUG=0`, `backend/config/settings.py:58-80`):
  - the secret key is required (the server refuses to start with the
    development key);
  - only listed host names are accepted;
  - HTTPS redirect, HSTS for 1 year, secure cookies and `nosniff` are on.
  - A test runs `manage.py check --deploy`.
- **Admin:** at a secret path, with a required 6-digit two-step code
  (`django-otp`).

### S8. Secrets — OK (verified)

- The whole git history was searched for keys, passwords, tokens, private
  keys and AWS/Google/GitHub/Slack key formats. Nothing real was found.
  The only hit is the placeholder `DEV_SECRET_KEY` at
  `backend/config/settings.py:55`, which production refuses to use.
- `.do/app.yaml` marks every secret `type: SECRET` with the value
  `CHANGE_ME`.
- `.gitignore` excludes the database, media folders and `mobile/.env`.
  Only `mobile/.env.example` is committed, and it holds a sample local IP
  address.

### S9. Personal data in logs — OK, with one note

- The `httpx`/`httpcore` loggers are raised to WARNING, because the
  geocoder URL contains the address, and `PIL` is too, because of EXIF
  data (`backend/config/settings.py:300-313`).
- Error handling in the address flow logs only the error type.
- A privacy test searches every log line for the address.
- Gunicorn's access log records each request's path, such as
  `/api/members/12`, but never request bodies. Paths contain ids only.
- **Note:** DigitalOcean keeps these logs. How long it keeps them belongs
  in the privacy policy.

### S10. Dependencies — backend clean (verified), app has build-tool alerts

- **Backend:** `pip-audit -r backend/requirements.txt` found **no known
  vulnerabilities** (run 2026-10-19). Every version is pinned.
- **Phone app** (outside backend scope, noted for completeness):
  `npm audit --omit=dev` reports 63 issues (46 high). They come from
  packages Expo and React Native pull in, such as `braces`, `node-forge`,
  `decode-uri-component` and `uuid`. Most are denial-of-service bugs in
  build tools, not code that runs on the phone. I did not check whether
  any ships in the app. Upgrading the Expo SDK normally clears these.
- Nothing runs these checks automatically (Step 5).

### S11. OWASP API Security Top 10 (2023) at a glance

| # | Risk | Result |
| --- | --- | --- |
| API1 | Broken object-level authorization | OK. Every object goes through a scoped lookup (S4). |
| API2 | Broken authentication | **Gaps:** throttle bypass (S1), tokens that never expire and are stored in plain form (S6), no reset (A1). |
| API3 | Broken object property-level authorization | OK. Serializers list the allowed fields. `neighborhood`, `sponsor_name` and `role` can't be set by the app. |
| API4 | Unrestricted resource consumption | **Partial.** Throttles can be bypassed (S1). Lists have no paging (A6). Uploads are capped at 5 MB. |
| API5 | Broken function-level authorization | OK. Admin-only actions check `admin_org`/`can_manage`. Owner stats require staff. |
| API6 | Unrestricted access to sensitive business flows | **Gap:** admin-add by email (S2). Collect/check-in are trusted by design (S4). |
| API7 | Server-side request forgery | OK. Partiful allow-list, no cross-host redirects (S5). |
| API8 | Security misconfiguration | **Gap:** `NUM_PROXIES` (S1). Otherwise OK (S7). |
| API9 | Improper inventory management | **Gap:** no API version (A3), and a README step that points to a non-existent admin screen (G10). |
| API10 | Unsafe consumption of APIs | OK. The geocoder, Expo and Partiful replies are parsed defensively, with timeouts. |

## Compliance

### Apple App Store and Google Play

| Requirement | Status | Evidence |
| --- | --- | --- |
| In-app account deletion | **Done.** Settings → Delete account. It removes the profile, photo, tokens, attendance, going records, follows and push tokens. Problem reports are kept but anonymized. | `backend/accounts/views.py:69-156` |
| Account deletion **without** the app (Google Play requires a web link) | **Missing.** Google asks for a web page or form where people can ask for deletion without installing the app. | — |
| Privacy policy link in the app and the store listing | **Missing.** The link is empty, so the app shows "Coming soon". | `shared/app_config.json` |
| Sign in with Apple | **Not needed.** It's only required when other social logins (Google, Facebook) are offered. The app uses email and password only. | `backend/accounts/urls.py` |
| User-generated content: report, block, contact (Apple 1.2) | **Block is missing** (S3). Report and contact exist. | — |
| Terms / EULA | **Missing.** The link is empty. Apple expects UGC apps to have terms that forbid objectionable content. | `shared/app_config.json` |
| Location permission text | App side. Auto check-in uses "always" location for geofences. The permission text and the store review notes must explain why. | `mobile/app.config.ts` |
| Minimum age | **Not decided.** There's no age question at signup. The store age rating and the privacy policy need an answer (most apps say 13+, or 18+ for a neighborhood app). | — |

**Data for the Privacy Labels (Apple) and Data Safety form (Google),**
taken from the models. All of it is "linked to the user" and none is used
for tracking or ads:

| Data | Stored where | Purpose |
| --- | --- | --- |
| Email address | `auth.User.username/email` | Account, login |
| Password (hashed) | `auth.User.password` | Login |
| Name: first name, last initial | `profiles.Profile` | Shown to neighbors |
| Photo (optional) | Spaces bucket, `profiles.Profile.photo` | Shown to neighbors |
| Coarse location: neighborhood only | `profiles.Profile.neighborhood` | Core feature. The address is used once and never stored. |
| Precise location | **Not collected by the server.** Geofencing runs on the phone and sends only "arrived at event X". | `backend/badges/views.py:184-193` |
| Interests, language | `profiles.Profile`, `accounts.Account` | Personalization |
| Event attendance, "I'm going", follows | `badges.Attendance`, `events.Going`, `organizations.Follow` | App features (badges, reminders) |
| Content they post | `events.Event`, `organizations.Organization` | App features |
| Push token, platform | `notifications.PushToken` | Reminders |
| Last seen (timestamp) | `accounts.Account.last_seen_at` | Owner stats (analytics) |
| Support messages, contact email, screenshot, device model, OS, app version | `support.ProblemReport` | Customer support / diagnostics |

### GDPR and similar privacy laws

The app is for Denver, so GDPR probably doesn't apply unless it targets
people in the EU. US state laws (the Colorado Privacy Act, CCPA) have size
thresholds a launch-stage app is unlikely to meet. Building to the GDPR
basics is still the safest default, and Apple and Google ask about the same
things:

| Topic | What the code does | Gap |
| --- | --- | --- |
| What's stored | See the table above. | — |
| Legal basis / consent | Account data is needed to run the service (contract). Push and auto check-in are opt-in, asked once, and can be switched off in Settings. | There's no record of agreeing to the terms or privacy policy at signup (no checkbox or timestamp). |
| Special-category data | Attending "resource fair" and "donation drive" events never counts toward badges (`backend/badges/config.py:44`). | Attendance at them is still **stored**, and religious or political events may reveal beliefs. The privacy policy should say this. Consider not storing attendance for sensitive categories at all. |
| Access / export | **Missing.** There's no "download my data". | Add an endpoint that returns the member's data as JSON, or handle requests by email at first (owner process). |
| Deletion | **Done** in the app (see above). | DigitalOcean database backups still hold deleted data until they expire. Say so in the policy. |
| Retention | **No rules.** Problem reports (message, contact email, screenshot) are kept forever, even after the account is deleted, with the user and email cleared but the message and screenshot kept. The same goes for `DeclineLog`, `ShareLog`, the translation cache and old events. | Decide how long to keep things (for example, problem reports for 1 year) and add a cleanup job. |
| Hosting location | DigitalOcean, region `sfo` (San Francisco) for the app and database (`.do/app.yaml:6`), with Spaces in `sfo3`. | — |
| Third parties (processors) | DigitalOcean (hosting, database, files, logs); Expo (push, which sees the push token and the reminder text); Apple APNs / Google FCM (push delivery); US Census geocoder (sees each address typed, without the user's identity); Postmark (email, planned); Partiful (only fetches a public event page). There's no translation provider yet. | Each needs to be listed in the privacy policy. DigitalOcean, Expo and Postmark have standard data processing agreements. |

## Actions for the owner (no code)

1. **Write and publish a privacy policy and terms of use** and put both
   links in `shared/app_config.json`. They should cover:
   - the data list above;
   - the third parties above;
   - DigitalOcean log and backup retention;
   - attendance at sensitive events;
   - a minimum age;
   - a zero-tolerance rule for objectionable content, with action on
     reports within 24 hours.

   A lawyer, or at least a reputable generator, is recommended.
2. **Decide the minimum age** (13+ or 18+) and set the store age ratings
   to match.
3. **Create a simple web page or form for account deletion requests**
   (Google Play requirement), for example a page on your website with an
   email address the team monitors.
4. **Fill in Apple's Privacy Labels and Google's Data Safety form** from
   the data table above. Answer "not used for tracking" and "data is
   encrypted in transit".
5. **Sign or accept the data processing agreements** for DigitalOcean,
   Expo and Postmark (usually a checkbox in each account's settings).
6. **Decide how long to keep data** (problem reports, old events, logs)
   so a cleanup job can be built.
7. **Decide how data export requests are handled** at first. Answering by
   email within 30 days is fine at launch.
8. **Moderation process:** who reads reports, and how fast. Apple expects
   action within 24 hours.
9. **App Review notes:** explain why the app asks for "Always" location
   (auto check-in), and that the server never receives coordinates. Give
   Apple a demo account in a Denver neighborhood.
10. **Before launch, set up Postmark** (needed for password reset, A1) and
    confirm the number of proxies on DigitalOcean (needed for the S1 fix).
