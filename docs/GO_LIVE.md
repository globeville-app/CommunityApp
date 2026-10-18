# Go Live: Hosting, Launch and Owner Stats

**Read first:** `MILESTONE_1.md`, `SETTINGS.md`, `LANGUAGE.md`, `MILESTONE_2.md` and `BRAND.md`. Every privacy rule in them still applies, especially that **home addresses are never stored or logged**.

**This doc covers how Globeville goes live, not what features it has.** Features live in their own milestone docs. The only new feature here is the owner stats page, which the owner needs from day one of the beta.

---

## 1. Launch scope

| Phase | Who | What's in it | How it's distributed |
|---|---|---|---|
| **A. Private beta** | 15–30 Globeville neighbors invited by the owner | Milestone 1, Settings & Support, Language, Milestone 2, and the owner stats page (below) | TestFlight (iPhone) and Google Play internal testing (Android) |
| **B. Public launch** | Anyone in Denver | Phase A, plus Milestone 3 (badges, event map pins, attendance), plus Milestone 4 (reminders), approved by the owner | App Store and Google Play |

- Phase A runs on the **same production setup** as Phase B. It's real data, just a small, invited group.
- **Moving from A to B:** the owner decides, based on the stats page and beta feedback.

---

## 2. Hosting (DigitalOcean)

The owner chose DigitalOcean so everything is in one account with predictable monthly prices. Confirm current prices on DigitalOcean's pricing page before setup.

| Piece | Service | Notes |
|---|---|---|
| Backend | App Platform web service running Django under `gunicorn` | Auto-deploys from the `main` branch on GitHub. Runs migrations as a pre-deploy job. |
| Database | Managed PostgreSQL, single node | Daily automatic backups. Move off the SQLite used in development. |
| Photos | Spaces (object storage), **private** bucket | Served through short-lived signed URLs. EXIF is still stripped before upload (Milestone 1). Problem-report screenshots go in a separate private path that only admin can read. |
| Email | **Postmark** (decided) | Account emails and problem-report notifications. The free tier (100 emails/month) covers the beta; the paid tier is about $15/month. Send from `hello@globeville.app` after verifying the domain (DKIM and Return-Path DNS records). |
| Domain | **`globeville.app`** (decided; the owner confirms it's available and buys it) | Backend at `api.globeville.app`. A simple landing page at `globeville.app` with store links, which doubles as `invite_url`. HTTPS everywhere (`.app` requires it), with certificates handled by App Platform. |

### Configuration rules
- **Secrets are environment variables, never in the repo.** This covers the Django secret key, database URL, Spaces keys, email keys, the translation provider key and `PROBLEM_REPORT_EMAILS`.
- **Production settings:**
  - `DEBUG=False`
  - `ALLOWED_HOSTS` and CSRF trusted origins set to the real domain
  - secure cookies
  - `SECURE_PROXY_SSL_HEADER` set for App Platform
- **Logging:** request logs must never contain addresses, coordinates or problem-report text. Keep Milestone 1's scrubbing in place, and add a test that runs against production settings.
- **Django admin:**
  - lives at a non-default URL path
  - staff accounts only
  - strong passwords
  - two-factor login with `django-otp` (recommended)
- **Environments:**
  - **production** runs on DigitalOcean
  - **development** runs locally, or in Claude Code in the cloud
  - a separate staging server isn't needed yet

### Backups
- Rely on the managed Postgres daily backups.
- **Before Phase A, restore a backup to a scratch database once** and confirm the data is there. Write the steps into the README.
- Spaces photos aren't backed up separately for now. The Phase B checklist revisits this.

---

## 3. Mobile builds and store submission (Expo)

No Mac is required. The owner develops on an AK3V mini PC through the browser (see `DEV_SETUP.md`).

- **EAS build profiles:**
  - `development` points at the local backend
  - `preview` points at production and is used for Phase A beta builds
  - `production` points at production and is used for store releases
- **API base URL:** comes from the build profile, never hard-coded in screens. This rule is already in Milestone 1.
- **App identity:**
  - the bundle ID / package name is set once and never changed
  - the display name comes from `shared/app_config.json`
  - the icons come from `BRAND.md`
- **Versioning:**
  - bump the version for each store release
  - let EAS auto-increment the build number
- **Submission:** use EAS Submit, to TestFlight and Play internal testing for Phase A, and to both stores for Phase B.
- **Store paperwork** (the owner fills these in; Claude Code drafts the answers from the code):
  - **Apple App Privacy label and Google Data safety form.** Data collected: email, display name, optional photo, neighborhood, language, events and "I'm going" taps; problem reports with device details. Not collected: home address, location history, contacts.
  - **Apple account deletion:** already built in Settings.
  - **Location permission wording** for Milestone 3's auto check-in, in both languages. Phase B only.
  - Screenshots and a store description in English and Spanish.
- **Accounts the owner needs:**
  - an Apple Developer Program membership (yearly fee)
  - a Google Play developer account (one-time fee)
  - an Expo account

---

## 4. Owner stats page (new, build before Phase A)

A single staff-only page in Django admin that shows how many people are using the app.

### Rules
- **Counts only.** It shows no names, emails or photos, and no addresses, since none are stored.
- **Staff only**, behind the admin login.
- **Fast:** it's computed from the database when the page loads. If it gets slow, cache it for 10 minutes.

### Tracking "active"
- Add `last_seen_at` to the member's profile. Update it on any signed-in API request, **at most once per hour per member**.
- It stores a timestamp only. No location, screens visited or device history.

### What the page shows

**Members**
- Total members
- New members: today, last 7 days, last 30 days
- Active members (`last_seen_at`): last 7 days, last 30 days
- Members by neighborhood (neighborhood name and count), sorted high to low
- Members by language (English, Spanish)
- **Daily new signups for the last 30 days:** a simple table of date and count. A small bar chart is fine if it's easy.

**Events**
- Events posted: last 7 days, last 30 days
- Upcoming events
- Events by category group (last 30 days)
- "I'm going" taps: last 7 days
- Members who have posted at least one event (organizers)

**Support**
- Open problem reports, linking to the problem report list

**Added in Milestone 3**
- Attendances counted (auto check-in vs. collected), last 30 days
- "I didn't make it" declines, last 30 days
- Badges earned and stage-ups, last 30 days
- Badge shares, last 30 days (counts only; no member is recorded)
- Community badge results (admin-only, as `BADGES.md` describes)

### Tests
- The page loads for staff and is refused for non-staff and signed-out users.
- The counts match the fixtures: new members by date range, active members by `last_seen_at`, events by group.
- `last_seen_at` updates on a signed-in request, and doesn't update again within the hour.
- The page's HTML contains no member names, emails or photo links.

---

## 5. Launch requirements that aren't features

These must be done before Phase A, unless marked.

| Item | Owner of the task | Notes |
|---|---|---|
| Privacy policy and terms of use | Owner (Claude can draft) | Must say home addresses are never stored. URLs go in `shared/app_config.json`. |
| Spanish review of all app text | Owner's neighborhood reviewer | Covers `es.json`, plus category and badge names and descriptions. |
| Problem-report triage | **Owner** (decided) | The owner reads every report and replies within **2 days** during the beta. Revisit before Phase B. |
| Open-source credits screen | Claude Code | Lucide (ISC) license text, plus other required licenses. A row in Settings or at the bottom of Privacy is fine. Phase B, when badges ship. |
| Seed the calendar | Owner | 3–5 real upcoming Globeville events posted before inviting beta testers, so the app never opens empty. |
| Support email | Owner | Shown in the store listings and the privacy policy. |

---

## 6. Launch checklists

### Before Phase A (private beta)
- [ ] DigitalOcean app, Postgres and Spaces set up. Secrets are in environment variables.
- [ ] The domain is live over HTTPS, and the app reaches the backend from a real phone.
- [ ] Production settings are checked: `DEBUG` off, hosts set, logs free of addresses.
- [ ] Admin has two-factor login, and staff accounts are created.
- [ ] A test restore of a database backup worked.
- [ ] The owner stats page is live, and its tests pass.
- [ ] Email works: a test problem report reaches `PROBLEM_REPORT_EMAILS`.
- [ ] Privacy policy and terms are live, and the URLs are set.
- [ ] The Spanish review is done.
- [ ] The calendar is seeded with real events.
- [ ] `preview` builds are on TestFlight and Play internal testing, and invites are sent.

### Before Phase B (public)
- [ ] Milestones 3 and 4 are shipped and tested.
- [ ] Location permission wording is approved in both languages.
- [ ] The store privacy label and data safety form are updated for badges and check-in.
- [ ] The open-source credits screen is in place.
- [ ] The store listing is done: screenshots and description in English and Spanish.
- [ ] Beta feedback is reviewed, and blocking bugs are fixed.
- [ ] Decide whether photos in Spaces need their own backup.
- [ ] Production builds are submitted to both stores.

---

## 7. Rough costs (confirm current prices)

- **DigitalOcean:** about $25/month at launch scale (backend about $5, Postgres about $15, Spaces about $5).
- **Apple Developer Program:** $99/year.
- **Google Play:** $25 one-time.
- **Domain:** about $10–20/year.
- **Email:** free or nearly free at launch volume.
- **Expo builds:** the free tier is enough to start.

## 8. Beta invite plan (decided)

The beta mixes all three groups and invites them in waves, so bugs are caught before strangers see them. About 25 people in total, with **at least half reading Spanish first**.

| Wave | Who | How many | Why |
|---|---|---|---|
| 1. Week 1 | Friends and family | About 5 | They forgive bugs and catch the obvious ones first. |
| 2. Week 2 | Organizers (block captains, church or school contacts, market vendors) | About 5 | They fill the calendar, so it never feels empty. |
| 3. Weeks 3–4 | Neighbors who sign up in person at a Globeville event | 10–15 | Real neighbors who don't know the owner, as the truest test. |

- Fix anything blocking between waves.
- Use the owner stats page to watch signups and activity per wave.

## Decided (Oct 18, 2026)
- **Domain:** `globeville.app`. Confirm it's available, then buy it.
- **Email:** Postmark.
- **Problem reports:** the owner, within 2 days.
- **Beta:** the three-wave plan above.
- **Reminders:** Milestone 4, before Phase B.
