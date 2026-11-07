# Store privacy answers (draft)

Drafted from the code for the Apple **App Privacy** label and the Google
Play **Data safety** form (docs/GO_LIVE.md §3), for the first release:
Milestones 1–4 and 5.1. **The owner reviews and submits these.** They must
match the privacy policy (`/privacy`, `backend/web/templates/web/legal/`).
Update both when Milestone 5.2 (guest texts) turns on; the notes are at the
bottom.

## Links the stores ask for

| Field | Value |
| --- | --- |
| Privacy policy URL (both stores) | `https://globeville.us/privacy` |
| Terms of use / EULA (Apple, optional field) | `https://globeville.us/terms` |
| Account deletion URL (Google, required) | `https://globeville.us/delete-account` |
| Support URL / email | the `contact_email` in `shared/app_config.json` |

## Data collected

All of it is **linked to the person**, used for **app functionality** only
(plus "Developer communications" for account emails). None is used for
tracking, advertising or analytics products.

| Data | Apple category | Google category | Why | Required |
| --- | --- | --- | --- | --- |
| Email address | Contact Info → Email Address | Personal info → Email address | Sign-in, account emails, replies to problem reports | Yes |
| First name and last initial (full last name never stored) | Contact Info → Name | Personal info → Name | Shown to neighbors | Yes |
| Profile photo | User Content → Photos or Videos | Photos and videos → Photos | Profile; location data removed on upload | No |
| Neighborhood (one of Denver's official neighborhoods) | Location → Coarse Location | Location → Approximate location | Shows local events. Derived once from an address that is never stored. | Yes |
| Events posted (with meeting spot), organizations, reports | User Content → Other User Content | App activity → Other user-generated content | The calendar, organization pages, safety | No |
| "I'm going", attendance, badges, follows, interests | Usage Data → Product Interaction | App activity → App interactions | The calendar, badges, "For you" | No |
| Last active time (a timestamp, at most hourly) | Usage Data → Product Interaction | App activity → App interactions | Counting active members | Yes |
| Push notification token | Identifiers → Device ID | Device or other IDs | Reminders and cancellations | No |
| Problem reports: message, optional screenshot, app version, phone model and system, language, screen | Diagnostics → Other Diagnostic Data; User Content → Customer Support | App info and performance → Other; Messages → Other in-app messages | Fixing bugs | No |

Language preference and settings (badge visibility, notifications, auto
check-in on/off) are app settings, not a data type either store asks about.

## Not collected

- **Home address.** Sent once to the U.S. Census Bureau's geocoder to find
  the neighborhood, then discarded; never stored or logged.
- **Precise location.** Auto check-in runs on the phone (geofencing). The
  server receives only "attended event X", never coordinates.
- Contacts, browsing history, search history, payment info, advertising IDs,
  health, financial info, audio, files.
- No third-party analytics, advertising or crash-reporting SDKs.

## Other answers

- **Tracking (Apple):** No.
- **Data shared (Google):** No. Service providers acting for us (DigitalOcean
  hosting, Postmark email, Expo/Apple/Google push) don't count as sharing.
- **Data sold:** No.
- **Encrypted in transit:** Yes (HTTPS only).
- **Users can request deletion:** Yes, in the app (Settings → Delete
  account) and at `https://globeville.us/delete-account`.
- **Data deleted on request** except problem reports, which are kept for up
  to 1 year without the person's name or email.
- **Independent security review (Google, optional):** No.

## Permissions and the reviewers' questions

- **Location, "Always" (iPhone) / background location (Android).** Used only
  for optional auto check-in, explained on a screen before the phone asks
  ("even when the app is closed"). Google needs the **background location
  declaration** with a short video: turn on auto check-in from Settings,
  show the explanation screen, then the permission prompts. Apple: say in the
  review notes that auto check-in uses geofencing and no location leaves the
  phone. Android has no location foreground service.
- **Photos.** The system photo picker, for a profile photo. No broad photo
  or file permission on Android.
- **Notifications.** Asked after the first "I'm going", with an explanation.
- **No camera, microphone, contacts or tracking permission.**
- **User-generated content (Apple 1.2).** Terms agreed at sign-up, with
  zero tolerance for objectionable content; report events, organizations and
  members; block members; the team reviews reports in the admin; contact
  email in the app's legal pages.
- **Age rating.** Answer the questionnaire with user-generated content
  (members post events, names and photos) and no other mature content. The
  terms set the minimum age at 13.
- **Sign-in for App Review.** Give Apple and Google a working test account
  (email and password) on the production server, already past the email
  code, with a profile in a neighborhood that has sample events.

## When Milestone 5.2 (guest texts) turns on

Add for guests, who have no account: **Phone number** (Contact Info /
Personal info), first name, and consent records, used only for texts about
the events they RSVP'd to, deleted 30 days after their last text. Twilio is
a service provider. The app itself collects nothing new.
