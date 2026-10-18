# Store privacy answers (draft)

Drafted from the code for the Apple App Privacy label and the Google Play
Data safety form (docs/GO_LIVE.md §3). **The owner reviews and submits
these.** Update them when Milestone 3 (badges and auto check-in) ships;
the Phase B notes are at the bottom.

## Data collected (Phase A)

| Data | Why | Linked to the person | Required |
| --- | --- | --- | --- |
| Email address | Login, problem-report replies | Yes | Yes |
| Name (first name and last initial only; the full last name is never stored) | Shown to neighbors | Yes | Yes |
| Photo | Profile photo; location data is removed on upload | Yes | No |
| Neighborhood (one of Denver's official neighborhoods) | Shows local events | Yes | Yes |
| Language preference | Shows the app in English or Spanish | Yes | Yes |
| Interests (event categories) | "For you" events | Yes | No |
| Events posted, "I'm going" taps | The neighborhood calendar | Yes | No |
| Problem reports: the message, an optional screenshot (location data removed), app version, phone model and system, language, screen name | Fixing bugs | Yes when signed in | No |
| Last active time (a timestamp, at most hourly) | Counting active members | Yes | Yes |

## Not collected

- **Home address.** It's used once to find the neighborhood and never stored or logged.
- Location (precise or approximate), location history, contacts, browsing history, payment info, advertising IDs.
- No third-party analytics, crash reporting or advertising.

## Other answers

- **Tracking (Apple):** no. Nothing is used to track people across other apps or websites.
- **Data shared with third parties (Google):** none sold. Service providers only: DigitalOcean (hosting), Postmark (email). Event title and description go to a translation service only if one is switched on.
- **Encrypted in transit:** yes (HTTPS only).
- **Deletion:** members can delete their account in the app (Settings → Delete account). This removes their login, profile, photo, interests, "I'm going" taps and match. Their problem reports stay without their name or email.

## Phase B additions (Milestone 3)

- **Location:** auto check-in uses the phone's location *on the phone only*, to notice arriving at an event. The server receives only "attended event X", never coordinates. Apple: declare **no** location data collected, but the app asks for "Always" location permission, so the review notes must explain auto check-in. Google: complete the **background location** declaration, with a short video of the feature.
- **Attendance and badges:** events attended, badges earned. Linked to the person, used for app functionality.
- **Shares:** only a count per badge per day; nothing about who shared or where.
