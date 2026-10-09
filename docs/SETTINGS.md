# Milestone 1.5: Settings & Support

**Builds on:** Milestone 1. Read `MILESTONE_1.md`, `LANGUAGE.md`, `DESIGN.md` and `BRAND.md` first. Every rule in them still applies.

**When:** after Milestone 1 and before Milestone 2.

**Scope:** a small, minimal settings screen with standard options, plus a way for members to report a problem to the team. Nothing else.

The product owner is learning Python. Prefer clear, conventional code. Explain non-obvious decisions in short comments or in your summary.

## Done when

1. A gear icon on the Profile screen opens **Settings**.
2. Settings has exactly these rows, in this order:
   1. Edit profile
   2. Language / Idioma
   3. Report a problem
   4. Privacy policy
   5. Terms of use
   6. Log out
   7. Delete account
   8. The app version, as small text at the bottom
3. A member can report a problem in under a minute. The team gets an email and sees the report in Django admin.
4. Log out and Delete account work completely, as described below.
5. Everything works in English and Spanish.
6. Backend and mobile tests pass, each with one command.

## Out of scope (do NOT build)

- Notification settings and text message preferences (later, when texts exist)
- "I'm moving" and changing neighborhood (later, with alumni history)
- Changing email or password, and dark/light themes
- Help center or FAQ, live chat, and in-app replies to reports
- Crash-reporting or analytics SDKs (Milestone 1's privacy rule stands)

## The screen

The screen is one glass card list, styled per `DESIGN.md`.

| Row | What it does |
|---|---|
| **Edit profile** | Opens the existing profile setup screen, filled in, to change display name, photo and interests. The neighborhood is shown but can't be changed here. |
| **Language / Idioma** | The **English \| Español** toggle from `LANGUAGE.md`, inline in the row. Switching takes effect instantly. |
| **Report a problem** | Opens the report form (below). |
| **Privacy policy** | Opens `privacy_url` from `shared/app_config.json` in an in-app browser (`expo-web-browser`). |
| **Terms of use** | Same, using `terms_url`. |
| **Log out** | Asks "Log out?" with Cancel / Log out, then logs out. |
| **Delete account** | Shown in red, set slightly apart from the other rows. Opens the delete flow (below). |
| *(footer)* | "Version 1.0.0 (12)", read from the app build. Small and muted. |

There are no icons on each row and no section headers. It's one list, with Delete account separated by a gap.

Add `privacy_url` and `terms_url` to `shared/app_config.json`. Until the owner provides real pages, use placeholders. Show a visible "Coming soon" page when a URL is empty, rather than a broken link.

## Report a problem

### Where it appears
- In Settings, for members who are signed in.
- As a small **"Having trouble? / ¿Problemas?"** link at the bottom of the join screens, for people who aren't signed in yet. Join is where address matching can fail, and those people can't reach Settings.

### The form
One screen, with:
- **What happened? / ¿Qué pasó?** A required text box of 1,000 characters or fewer, with the placeholder "Tell us what you were doing and what went wrong."
- **Add a screenshot**: optional, one image, chosen from the photo library with `expo-image-picker`.
- **Email for a reply**: optional, shown only when the person isn't signed in. For signed-in members, the team already has their account email.
- A **Send** button.

After sending, show "Thanks! We got it. / ¡Gracias! Lo recibimos." and return to the previous screen.

### What's attached automatically
The person doesn't have to explain any of this. The app sends:
- the app version and build number
- the operating system and its version
- the device model
- the selected language
- the screen they came from, as a route name (for example `join/address` or `settings`)
- the time

### What's never attached
- The contents of any form field. In particular, never the address typed on the join screen.
- Location.
- Contacts.
- Any data from other screens.

The report contains only what the person typed, plus the technical details listed above.

### Backend
- **ProblemReport model:**
  - `user` (FK, nullable), `contact_email` (optional)
  - `message`, `screenshot` (optional)
  - `app_version`, `os`, `device_model`, `language`, `screen`
  - `status` (`new`, `in_progress` or `resolved`)
  - `team_notes` (admin only)
  - `created_at`
- **Endpoint:** `POST /api/support/report`, multipart.
  - It accepts a token, but doesn't require one.
  - Limit it to 5 reports per user per day. Limit by IP address for people who aren't signed in.
- **Screenshot handling:**
  - Strip EXIF (photo metadata such as location).
  - Limit the file to 5 MB, in JPEG or PNG only.
  - Store it like profile photos, but it is never served to the app. Only the Django admin can view it.
- **Django admin:**
  - Lists reports newest first, filterable by status, language and app version.
  - Staff can change the status and add notes.
- **Email notification:**
  - On each new report, send a short email to every address in the `PROBLEM_REPORT_EMAILS` environment variable (comma-separated).
  - The email includes:
    - the first 200 characters of the message
    - the version, device, language and screen
    - a link to the report in Django admin
  - The screenshot is not attached. The team views it in admin.
  - Development uses Django's console email backend. Production email settings come from environment variables.
  - Never hard-code anyone's email address.
- Errors return codes, as `LANGUAGE.md` requires: `message_required`, `message_too_long`, `bad_image`, `daily_limit`.

## Log out

1. Call `POST /api/auth/logout`, which deletes the token on the server.
2. Remove the token from secure store, even if the server call fails.
3. Clear cached profile and app data from memory.
4. Return to the Join screen.
5. **Keep** `app.language`, as `LANGUAGE.md` requires.

## Delete account

### The flow
1. **Delete account** opens a screen that says plainly what happens:
   > "This permanently deletes your profile, photo and login. It can't be undone."
2. The person enters their password to confirm.
3. They tap a red **Delete my account** button.
4. On success, they're logged out and returned to the Join screen with the message "Your account was deleted."

### What the backend removes
`POST /api/account/delete` (token and password required) deletes:
- the user, profile, profile photo file and all auth tokens
- interests and any other personal data tied to the profile

It keeps:
- **ProblemReports.** `user` is set to null and `contact_email` is cleared. The message and technical details stay so the team can still fix the bug.

### The rule every future feature must follow
- Add this rule to the README so later milestones follow it: **content tied to a deleted member is either removed or shown as "Former neighbor / Exvecino," never with their name.**
- For Milestone 2:
  - upcoming events they organized are cancelled
  - past events show "Former neighbor"
  - their "I'm going" records are removed

## Design

- Follow `DESIGN.md`. Each row is at least 52 pt tall and shows a chevron (›) when it opens another screen.
- Spanish labels wrap; they're never cut off.
- Delete account is red text with no fill.
- No other row uses color to stand out.
- If the header needs a brand touch, `BRAND.md` allows `<GbMark height={20} />`.

## Tests

### Backend (one command)

**Problem reports:**
- A signed-in report saves with the user attached.
- A signed-out report saves with the optional contact email.
- These are rejected: an empty message, a message over 1,000 characters, a non-image file, an image over 5 MB.
- The daily limit is enforced.
- Screenshot EXIF is stripped.
- No API endpoint returns screenshots.
- The notification email goes to every address in `PROBLEM_REPORT_EMAILS` and doesn't include the screenshot. The test uses Django's test outbox.

**Log out:**
- The token no longer works after logout.

**Delete account:**
- A wrong password is rejected.
- On success, the user, profile, photo file and tokens are gone.
- The user's problem reports remain with `user` set to null and the contact email cleared.
- The deleted email can sign up again as a new account.

Milestone 1's tests still pass.

### Mobile (one command)
- Settings renders the eight items in order, in English and in Spanish.
- The language toggle switches the screen instantly.
- The report form:
  - requires a message
  - sends the auto-attached details
  - never includes the address field's contents when opened from the join screen
- Log out clears the token, keeps `app.language` and returns to Join.
- The delete flow requires a password and shows its confirmation.
- Empty privacy and terms URLs show "Coming soon."

### Manual check on a real phone (add to the README)
1. Report a problem with a screenshot and confirm the email arrives in the console.
2. Find the report in admin, view the screenshot and mark it resolved.
3. Report a problem from the join screen while logged out.
4. Log out and back in.
5. Delete a test account and confirm you can't log in with it.

## How to work

- Build in small steps, in this order:
  1. config URLs
  2. logout endpoint
  3. ProblemReport model, endpoint, admin and email
  4. account deletion
  5. get the backend tests green
  6. Settings screen
  7. report form, including the join-screen link
  8. log out
  9. delete flow
  10. mobile tests
- Run the tests after each step. Commit after each green step.
- If anything here conflicts with an earlier doc, ask rather than guess.

## Open items for the owner

- **Who gets problem emails:** set the `PROBLEM_REPORT_EMAILS` addresses.
- **Privacy policy and terms:** both are required before an App Store or Play Store release. They should state that home addresses are never stored.
- **Production email:** choose a sending service (for example Postmark or Amazon SES) before launch.
- **Response promise:** decide whether people who report get a reply, and how fast.
