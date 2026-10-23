# Milestone 5: Invite links (the host-to-guest loop)

**App name:** Globeville. The name still lives only in `shared/app_config.json`.

**Builds on:** Milestones 1–4. Every rule in those docs still applies, except where this doc changes one on purpose (marked **Changes Milestone N**).

**Read first:**
- `MILESTONE_2.md` (events, Going, the neighborhood 404 rule)
- `MILESTONE_3.md` and `BADGES.md` (Attendance, `record_attendance`, the 7-day collect window)
- `MILESTONE_4.md` (ScheduledNotification, `send_due_notifications`, organizations)
- `SETTINGS.md` (deleted accounts), `LANGUAGE.md`, `DESIGN.md`, `BRAND.md` and `GO_LIVE.md` §4

**Before starting:** Milestones 2–4 must be reviewed and merged into `main`. Build this on a fresh branch from `main`.

**Before any real text goes out (owner checklist):**
1. **Texting provider and carrier registration.** Choose a provider (Twilio or similar), and complete US carrier registration for business texting (A2P 10DLC). This can take days to weeks, so start it while the code is being built.
2. **Legal review.** Have someone qualified review the consent wording, the four text messages and the privacy policy. Texting rules vary by state.
3. **Starting monthly budget.** Set `SMS_MONTHLY_BUDGET_USD`, for example $50.

**For Claude Code:** build everything against the fake `Texter`. Add an `SMS_LIVE` setting that defaults to `false`. While it's `false`, no text is sent through the real provider in any environment, and the fake texter logs what *would* have been sent (without phone numbers). The owner switches it to `true` only after the checklist above is done. Add a test that the real provider is never called when `SMS_LIVE` is `false`.

The product owner is learning Python. Prefer clear, conventional code over clever code, and explain non-obvious decisions in short comments or in your summary.

## Context

Partiful grows because hosting *means* sending a link. Guests open it in a browser, RSVP with no app, and some of them later host their own events. Globeville needs its own version of that loop, so it doesn't send growth to Partiful.

The loop:
1. **Host posts an event** and gets an invite link.
2. **Host texts the link from their own phone** to anyone, in the neighborhood or not.
3. **Guests open it in their browser** and RSVP.
4. **After the event, guests who opted in get "Collect your badge"** and join Globeville.
5. **New members host,** and the loop repeats.

The badge step is Globeville's own. Partiful has no badges, so this is what turns a guest into a member.

**Three rules keep the loop legal, cheap and honest:**
1. **Globeville never texts people who didn't opt in.** Invites go from the host's own phone through the share sheet. Our server texts only guests who RSVP'd and consented.
2. **Globeville never reads the phone's contacts.**
3. **Hosts see real turnout,** not just RSVPs, because Globeville counts confirmed attendance.

## Done when

1. **Every event has an invite link** at `https://globeville.app/e/{code}`.
2. **After posting, the host lands on "Invite people."** It has the link, a ready-to-send message in their language, and the phone's share sheet. Event detail always has an **Invite** button for the host.
3. **Anyone with the link can view the event in a phone browser** with no app and no account. The page is in English or Spanish, with a switch.
4. **Guests RSVP from the page** with a first name and a US mobile number confirmed by a texted code. They agree to event texts, and can optionally agree to a "collect your badge" text.
5. **Members who open the link** see the event in the app (or in the browser, if the app isn't installed), and can tap "I'm going" even if the event is in another neighborhood.
6. **Hosts choose who can see the event:**
   - **Neighborhood + link** (the default): on the neighborhood calendar, and anyone with the link.
   - **Link only:** not on the calendar; only people with the link.
7. **Hosts see their guest list,** and after the event a private **"Came: 9 of 14"** count.
8. **Guests get only the texts they agreed to:**
   - their code
   - a cancellation notice
   - an optional reminder, which includes a "Can't make it?" link
   - the optional collect text
9. **A guest who joins** through the collect link or code within the 7-day window gets the attendance counted, and their badges grow.
10. **Texting stays compliant:**
    - STOP, START and HELP replies work.
    - Texts go out only between 9 AM and 8 PM Denver time.
    - A monthly budget pauses the optional texts when it runs out.
11. **Admin gets the new numbers** on the owner stats page.
12. **Everything works in English and Spanish.**
13. **Backend and mobile tests pass,** each with one command.

## Out of scope (do NOT build)

- **Reading the phone's contacts.** Never request contacts permission, now or as a "nice to have."
- Server-sent invitations, and text blasts from hosts to guests
- Texts about event edits (time or place changes)
- Polls, comments, photos, plus-ones and capacity limits
- Flyers, QR codes and WhatsApp cards (backlog)
- A "Globeville isn't in your neighborhood yet" waitlist (backlog)
- Ticketing or payments (Milestone 6)
- Guests hosting without joining
- Phone numbers outside the US

## Decisions (fixed for this milestone)

### Access and visibility

| Topic | Decision |
|---|---|
| Who can see an event (**Changes Milestone 2**) | **The invite link grants access.** Anyone holding the code can view the event, members and non-members, any neighborhood. Without the code, Milestone 2's neighborhood rule (a 404) is unchanged. |
| Members from other neighborhoods | When a signed-in member opens `/api/invites/{code}`, create an **EventAccess** row for that member and event. All event endpoints (detail, going, collect, check-in) then allow that member the same as a neighbor. Revoking the link doesn't remove existing EventAccess rows. |
| Link-only events | They never appear on the calendar, in lists, in "For you" or "Following," or in organization pages. Everything else (reminders, auto check-in, collect, badges) works as normal for people who have access. |
| Invite code | 10 random characters from an unambiguous set (no 0/O or 1/l), generated with `secrets`. The host can **reset the link**: the old code then shows an "expired" page. |
| Who manages invites | The event's organizer, or any admin of the event's organization (Milestone 4). |

### Web pages

| Topic | Decision |
|---|---|
| How pages are built | Django server-rendered templates in a new `web` app, not the Expo app. This keeps pages fast, and makes link previews work in iMessage and WhatsApp. Use the `DESIGN.md` look and plain HTML forms with CSRF protection. Keep the pages light: no frontend framework, and only a little JavaScript (the language switch and the code input). |
| Language | Django's built-in translations (`gettext`, `.po` files for `en` and `es`). Pick the language from a `lang` cookie first, then the browser's `Accept-Language`, then English. Reuse the app's wording from `en.json` / `es.json` where the same text appears. |
| Link preview | Open Graph tags: the event title, the date, "Hosted by {display name} on globeville", and one **static** branded preview image (`og-default.png`, built from the `BRAND.md` wordmark on midnight purple). **Never the meeting spot.** |
| Meeting spot | Hidden on the web page until the visitor has RSVP'd, then shown. In the app it follows the existing rules. |
| Add to calendar | After RSVP, offer a downloadable `.ics` file (title, time, meeting spot, and the event link), built with the `icalendar` package. |
| App installed? | The page has an **Open in app** button. If the app is installed, the link opens it directly (see deep links). |

### Guests and consent

| Topic | Decision |
|---|---|
| Guest sign-in | First name and a US mobile number. Normalize the number with the `phonenumbers` package to E.164 format and reject non-US numbers. The number is confirmed with a 6-digit texted code that expires after 10 minutes, with at most 5 tries. A signed cookie keeps the browser signed in as that guest for 90 days. There's no password and no profile. |
| Consent (two checkboxes, **both unchecked by default**) | **Required to RSVP:** "Text me a code and updates about this event (like a cancellation or a reminder I ask for). Msg & data rates may apply. Reply STOP to opt out." **Optional:** "After the event, text me so I can collect my badge on Globeville." Both are shown in the page's language. |
| Proof of consent | For each guest, store when they agreed to each consent, the consent wording version (`consent_version`, for example `2026-10-v1`), and the page language. Never overwrite it; record new consent as new rows. |
| Reminder choice | A third optional choice: "Remind me the day before." |
| Going count (**Changes Milestone 2**) | The count includes members and guests (guests the host removed don't count). |
| Guest list (**Changes Milestone 2**) | The host and organization admins see who's going: display names for members, first names for guests. Everyone else still sees only the count. **Phone numbers are never shown, even to hosts.** |
| Guest says they're not going | A **Can't make it** button on the page (while signed in), plus the link in the reminder text. Both remove the RSVP and any texts still scheduled for it. |

### Texting

| Topic | Decision |
|---|---|
| Provider | One SMS provider (Twilio Messaging Service or similar) behind a small `Texter` interface in `backend/texting/`, with a fake version for tests and development. **Tests never call the real provider.** |
| What we send | Only these four kinds, all starting with "Globeville:". English examples: <ul><li>**Code** (required consent): "Globeville: your code is 482913. It expires in 10 minutes."</li><li>**Cancellation** (required consent): "Globeville: {title} on {date} was cancelled by the host."</li><li>**Reminder** (only if chosen): "Globeville: reminder, {title} is tomorrow at {time}. Can't make it? {short link}"</li><li>**Collect** (only with the optional consent): "Globeville: you went to {title}! Collect your badge: {link}. Reply STOP to opt out."</li></ul> Each also has a Spanish version, sent in the guest's language. |
| When | **Reminder:** 5:00 PM Denver time the day before. **Collect:** 10:00 AM Denver time the morning after the event ends. **Cancellation:** right away, but if it's outside quiet hours, held until 9:00 AM. |
| Quiet hours | No texts before 9:00 AM or after 8:00 PM Denver time, except the code, which the guest just asked for. A text due inside quiet hours waits until 9:00 AM. |
| Scheduling | Add a **ScheduledText** model, and send due texts from Milestone 4's `send_due_notifications` command, which runs every 15 minutes. Each text is sent at most once; running the command twice changes nothing. |
| Opt-out replies | An inbound webhook from the provider (`POST /webhooks/sms`, with the provider's signature checked) handles replies: <ul><li>**STOP** (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, ALTO, PARAR) marks the number opted out at once and cancels its scheduled texts.</li><li>**START** (or UNSTOP) opts it back in.</li><li>**HELP** (or AYUDA) replies: "Globeville: event texts for RSVPs. Reply STOP to opt out. Help: {support email}."</li></ul> An opted-out number gets nothing, not even codes, until START. The web page then explains how to opt back in. |
| Monthly budget | `SMS_MONTHLY_BUDGET_USD` and `SMS_COST_PER_TEXT_USD` are environment settings. **At 80%,** email the owner (`OWNER_ALERT_EMAILS`). **At 100%,** pause reminders and collect texts for the rest of the month; codes and cancellations keep sending. The owner stats page shows spending against the budget. |
| Abuse limits | At most 5 RSVPs per phone per day, 3 code texts per phone per hour (10 per day), 30 RSVP attempts per IP address per hour, and 200 guest RSVPs per event. Use Django's database cache for the counters, so no new service (like Redis) is needed. Hosts can remove a guest. Django admin can block a number. |
| Phone numbers | Stored only to text guests. They're never shown, logged or put in error reports. Django admin shows only the last 4 digits. Numbers are deleted 30 days after the event's last scheduled text, unless the guest joined or has another upcoming RSVP. |

### Joining and badges

| Topic | Decision |
|---|---|
| Collecting as a guest (**Changes Milestone 3**) | When the event ends, each guest RSVP becomes **PendingAttendance**, with a one-time `claim_token` (long and random, for the link) and a `claim_code` (6 letters and numbers, for typing). The guest's RSVP stands in for "I'm going" in `record_attendance`'s checks. It must be claimed within the existing **7-day window** after the event. |
| Deferred deep link | A guest who doesn't have the app yet loses the link when they install it from the store. So the collect page shows the **claim code** big and clear, plus a "copy code" button. The app has a **"Have a badge code?"** field on the last signup step and in My Impact. If the app opens from the link (already installed), it saves the token and finishes the claim right after signup or login. |
| After joining | The claim calls `record_attendance(..., 'collect')` as the new member. Their address can be in any neighborhood; `is_first_in_neighborhood` uses the event's neighborhood as usual. Celebrations and badges work as in Milestone 3. |
| Hosting rule | Pending guests **don't** count toward the 2-attendee hosting rule until they claim. |
| "Came" count for hosts | After the event, the guest list shows **"Came: X of Y,"** where X counts confirmed attendance (members who checked in or collected, plus guests who claimed) and Y is everyone who was going. It's private to the host and organization admins. **Never show who didn't come.** Label it "confirmed" with a one-line explanation, since guests who never join can't be confirmed. |

### Deep links

| Topic | Decision |
|---|---|
| Setup | iOS Universal Links and Android App Links for `globeville.app/e/*` and `globeville.app/c/*`. In the Expo config: `ios.associatedDomains: ["applinks:globeville.app"]`, plus an Android `intentFilters` entry with `autoVerify: true`. Django serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`. They need the Apple Team ID and the Android signing certificate's SHA-256 fingerprint (from `eas credentials`), which are environment settings. A new app build is required. |
| In the app | `/e/{code}` opens the event (through `/api/invites/{code}`). `/c/{token}` saves the claim token and starts the claim (after signup if needed). |

## Data model (backend)

**New models**
- **InviteLink:** event, `code` (unique), created timestamp, `revoked_at`.
- **EventAccess:** user, event, `via_invite`, created timestamp. One per user per event.
- **Guest:**
  - fields: `first_name` (30 characters or fewer), `phone` (E.164, unique), `phone_verified_at`, `language`, `opted_out_at`, `blocked_at`, created timestamp
- **GuestConsent:** guest, `kind` (`event_texts` or `collect_texts`), `consent_version`, `language`, created timestamp. Append-only.
- **GuestRSVP:**
  - fields: guest, event, `wants_reminder`, `wants_collect_text`, created timestamp, `cancelled_at`, `removed_by_host_at`
  - One per guest per event.
- **PendingAttendance:**
  - fields: guest RSVP, `claim_token`, `claim_code`, `expires_at` (event end + 7 days), `claimed_by` (user, optional), `claimed_at`
- **PhoneCode:** phone, hashed code, `expires_at`, `attempts`, created timestamp.
- **ScheduledText:**
  - fields: guest, event (optional), `kind` (`code`, `reminder`, `cancelled` or `collect`), `send_at`, `sent_at`, `skipped_reason` (for example `opted_out`, `budget`, `rsvp_cancelled`), `provider_message_id`, `cost_usd`
  - Unique per (guest, event, kind), except codes.

**Changes to existing models**
- **Event:**
  - Add `visibility` (`neighborhood` or `link_only`, default `neighborhood`).
  - Create an InviteLink automatically for every new event, and with a data migration for existing ones.

**Deleted accounts and cancellations** (extends `SETTINGS.md`):
- **When a host deletes their account,** the event cancellation that `SETTINGS.md` already requires also schedules cancellation texts to its guests, and revokes the links.
- **When any event is cancelled:** schedule cancellation texts, and drop pending reminder and collect texts.
- **When a guest is removed by the host:** delete their scheduled texts and pending attendance.

## API and web pages

**Web pages (Django, no login)**

| Path | Purpose |
|---|---|
| `GET /e/{code}` | The event page: title, date and time, host display name (or organization name), description in the visitor's language when available, going count, the **I'm going** form, **Open in app**, and the language switch. Signed-in guests also see the meeting spot, **Add to calendar** and **Can't make it**. An expired link shows a friendly "This invite link has expired" page. A cancelled event shows "This event was cancelled." |
| `POST /e/{code}/rsvp` | Takes the first name, phone, the two consents and the reminder choice, then sends the code. |
| `POST /e/{code}/verify` | Checks the code, records consents and the RSVP, schedules texts, and sets the cookie. |
| `POST /e/{code}/cancel-rsvp` | Signed-in guest says they're not going. |
| `GET /r/{signed_token}` | The "Can't make it?" link from the reminder text. It confirms with one tap, with no sign-in needed (the token is signed and tied to that RSVP). |
| `GET /e/{code}/calendar.ics` | Calendar file, for signed-in guests only. |
| `GET /c/{claim_token}` | The collect page: "Collect your badge on Globeville," store links, the claim code with a copy button, and **Open in app**. |
| `POST /webhooks/sms` | Inbound replies (STOP, START, HELP) and delivery status, with the provider's signature checked. |
| `GET /.well-known/...` | The deep-link files. |

**App API (token required)**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/events/{id}/invite` | The host's link and ready-made message text. Hosts and organization admins only. |
| POST | `/api/events/{id}/invite/reset` | Revoke the link and create a new one. |
| GET | `/api/invites/{code}` | Event detail for any signed-in member who opens a link. Creates EventAccess. |
| GET | `/api/events/{id}/guests` | Host-only guest list, plus the "came" count after the event. |
| POST | `/api/events/{id}/guests/{guest_rsvp_id}/remove` | Host removes a guest. |
| POST | `/api/claims` | Body `{ "token": … }` or `{ "code": … }`. Turns pending attendance into a collect for the signed-in member. Returns any new celebrations. |
| POST/PATCH | `/api/events` | Now accept `visibility`. |

**Error codes** (examples): `invite_revoked`, `code_invalid`, `code_expired`, `too_many_attempts`, `rate_limited`, `guest_limit`, `phone_not_us`, `phone_opted_out`, `phone_blocked`, `consent_required`, `claim_used`, `claim_expired` and `claim_not_found`.

## Flow

**Host (app)**
1. **Posting:**
   - A new **Who can see this?** choice: Neighborhood + link (default) or Link only. Each has a one-line explanation.
   - After posting, the host lands on **Invite people**: "Text this link to anyone you want to invite — it sends from your phone." It has a **Share** button (share sheet with the message and link) and a **Copy link** button.
   - The ready-made message, in English: "Come to {title} on {date}! RSVP here: {link}". In Spanish: "¡Ven a {title} el {date}! Confirma aquí: {link}". It uses the host's language.
2. **Event detail (host):**
   - an **Invite** button
   - **Guest list**: the count, names and Remove; after the event, also "Came: X of Y (confirmed)"
   - **Reset link** in a menu, with a confirmation that old links will stop working

**Guest (browser)**
1. Opens the link and sees the event, with an **English | Español** switch.
2. Taps **I'm going**. Enters a first name and mobile number, checks the required consent, optionally checks the collect consent, and chooses whether to get a reminder.
3. Enters the texted code and sees "You're going!", the meeting spot, **Add to calendar** and **Can't make it**.
4. If chosen, gets the reminder at 5 PM the day before (with a "Can't make it?" link).
5. If chosen, gets the collect text at 10 AM the morning after. They open the collect page, install the app, sign up (Milestone 1, with address), and enter the code or open the link. The badge is collected, with an unlock moment.

**Member (app):** opening a link goes to the event in the app. **I'm going** works for any neighborhood through EventAccess. Milestones 3 and 4 then apply as usual: reminder, auto check-in or collect.

**Design:** the web page follows `DESIGN.md`, works at 360 px wide, keeps touch targets at least 44 px, and has the globeville wordmark at the top. The consent text is readable, not hidden in small print.

## Admin

- **Owner stats** (`GO_LIVE.md` §4), last 30 days:
  - invite shares (share-sheet opens)
  - web page views
  - guest RSVPs, and how many opted in to collect texts
  - collect texts sent
  - **guests who joined** through a claim
  - opt-outs
  - texts sent by kind
  - spending against the monthly budget
- **The key number: guest-to-member conversion,** meaning guests who claimed ÷ guests whose events ended. Show it prominently.
- **Django admin:** search guests by the last 4 digits only, block or unblock a number, and view consent records (read-only).

## Privacy and safety

- **The meeting spot** is never in link previews or text messages, and stays hidden on the web page until RSVP.
- **Guest phone numbers** are never shown, logged or sent to error reporting, and are deleted on schedule. **Guests' first names** are visible only to the host and organization admins.
- **No contacts access,** ever, in this milestone.
- **Consent is proven, not assumed:** separate consents, unchecked by default, versioned and stored.
- **Update the privacy policy and terms** before this ships: guest first names and phone numbers, the texts we send, and how to opt out.

## Tests

**Backend** (one command):
- **Invite links and access:**
  - A valid code shows the page; a reset code shows the expired page.
  - Without a code or EventAccess, the neighborhood rule still returns 404.
  - Opening a link creates EventAccess, and the member can then use "I'm going," collect and check-in.
  - Link-only events never appear in any list.
- **Guest RSVP:**
  - The code flow works: codes expire, and 5 bad tries lock them.
  - Non-US numbers are refused.
  - The required consent is enforced.
  - The rate limits and the 200-guest cap hold.
  - The going count includes guests; removing or cancelling lowers it.
- **Consent:** records are append-only, versioned, and created only by verify. Without the collect consent, no collect text is scheduled.
- **Texts:**
  - Each kind is sent once, at the right Denver time, and only with the matching consent.
  - Quiet hours delay texts to 9 AM.
  - A cancelled event schedules cancellation texts and drops reminders and collects.
  - The "Can't make it" link works and cancels scheduled texts.
- **Opt-out webhook:**
  - The signature is required.
  - STOP (and the Spanish words) opts out at once and cancels scheduled texts; START opts back in; HELP replies.
  - An opted-out number gets nothing.
- **Budget:** at 80% an alert email goes out; at 100% reminders and collects are skipped with `skipped_reason='budget'`, while codes and cancellations still send.
- **Meeting spot:** absent before RSVP, in Open Graph tags and in all texts; present after RSVP.
- **Claims:**
  - A claim by token or code within 7 days records Attendance and grows badges.
  - A used, expired or unknown claim is refused.
  - Pending guests don't count toward the 2-attendee rule until claimed.
  - A joined guest from another neighborhood gets correct `is_first_in_neighborhood` and badge counts.
- **Guest list:**
  - Host and organization admins only.
  - The "came" count is correct and never lists who didn't come.
  - Phone numbers never appear in any API response, template or log.
- **Phone deletion** happens on schedule, unless the guest joined or has another upcoming RSVP.
- **Deep link files** are served with the right content.
- **Owner stats** show the new counts, conversion and budget. The five value signals compute correctly from fixtures, and `Going.source` is saved from each screen (`unknown` for older rows).
- Earlier milestones' tests still pass, with the 404 and going-count tests updated for the deliberate changes.

**Mobile** (one command):
- The visibility choice works, and posting lands on **Invite people**.
- Share and Copy work.
- The guest list, "came" count and Reset link work, for hosts only.
- A deep link opens an event from another neighborhood, and "I'm going" works.
- A claim link saved before signup completes after signup. A typed claim code works from signup and from My Impact.
- No code path requests contacts permission (a check confirms `expo-contacts` isn't installed).
- Every new screen renders in Spanish with no missing keys.

**Manual check** (add to the README):
1. Post an event and text the link from your phone to a phone without the app.
2. RSVP in the browser, with and without the collect consent. Confirm the meeting spot appears only after RSVP, and that the iMessage and WhatsApp previews show no meeting spot.
3. Reply STOP and confirm nothing more arrives, then START.
4. After the event, follow the collect text, install the app, join from a different neighborhood, enter the code, and confirm the badge grows.

## How to work

Build in small steps, in this order:
1. Models, `visibility`, the InviteLink data migration and EventAccess
2. Invite links and access rules in the API
3. The web app, the event page, translations and link previews
4. The `Texter` interface (with the fake), phone codes and guest RSVP with consent
5. ScheduledText, quiet hours, budget, and hooking into `send_due_notifications`
6. The opt-out webhook
7. Claims and the badge hookup
8. Owner stats and admin, including the **Value signals** block and the `Going.source` field from `GO_LIVE.md` §4
9. Get the backend tests green
10. App: visibility and Invite people
11. Guest list, "came" count and reset
12. Deep links (Expo config and the well-known files)
13. Claim flow, including the typed code
14. Mobile tests

Run the tests after each step. Commit after each green step with a clear message.

**New environment settings** (document them in the README):
- `SMS_PROVIDER` and the provider credentials
- `SMS_MESSAGING_SERVICE_ID`
- `SMS_MONTHLY_BUDGET_USD`
- `SMS_COST_PER_TEXT_USD`
- `OWNER_ALERT_EMAILS`
- `SUPPORT_EMAIL`
- `APPLE_TEAM_ID`
- `ANDROID_CERT_SHA256`
- `PUBLIC_BASE_URL` (`https://globeville.app`)

If anything here conflicts with an earlier milestone, ask rather than guess.

## Open items for the owner

- **Text provider:** choose one (Twilio or similar) and complete **US carrier registration for business texting (A2P 10DLC)** before any real text goes out. Registration can take days to weeks. Confirm current prices. Roughly a cent per text plus monthly fees is a planning figure, not a quote.
- **Legal review:** have someone qualified review the consent wording, the texts and the privacy policy before launch. Texting rules vary by state.
- **Monthly texting budget:** pick the starting number (for example, $50).
- **Domain and app IDs:** `globeville.app` must be live. Provide the Apple Team ID and run `eas credentials` for the Android fingerprint.
- **Support email** for the HELP reply.
- **Launch timing:** decide whether this ships before the public launch (it's the growth engine) or right after.
