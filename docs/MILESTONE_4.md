# Milestone 4: Reminders and organization profiles

**App name:** Globeville. The name still lives only in `shared/app_config.json`.

**Builds on:** Milestones 1, 1.5 (`SETTINGS.md`), 2 and 3. Every rule in those docs still applies, except where this doc changes one on purpose (marked **Changes Milestone N**).

**Read first:** `MILESTONE_3.md`, `BADGES.md` and `BADGE_UI.md` (badges change here), plus `LANGUAGE.md`, `DESIGN.md` and `GO_LIVE.md` §4 (owner stats).

**Scope:** this milestone only. It is the last milestone before the public launch.

The product owner is learning Python. Prefer clear, conventional code over clever code, and explain non-obvious decisions in short comments or in your summary.

## Context

**Reminders:** members who tap "I'm going" get a push notification the day before, so fewer people forget.

**Organization profiles:** churches, rec centers, schools, clubs, food banks, the neighborhood association and local businesses post events every week. Today one volunteer posts them from a personal profile, and the history is lost when that person leaves. An organization profile gives the group its own page, events, followers and badges, run by members acting as admins.

## Done when

1. **Members get a reminder the day before** each event they're going to, in their language. If the event is cancelled, they get a short notice instead.
2. **Notifications are opt-in.** The member is asked once with a plain explanation, and Settings has the toggles.
3. **Any member can request an organization**, with a type and the neighborhoods it serves. It goes live only after the team approves it in Django admin.
4. **Organization admins can post events as the organization** to any neighborhood it serves. Events show **"Hosted by [Organization]."**
5. **Each organization has a page:**
   - name, type label, photo and description
   - neighborhoods served
   - badges
   - upcoming and past events
   - a **Follow** button
6. **Following an organization** puts a **Following / Siguiendo** tag on its events and adds a **Following** filter on the Events tab. Following never sends a push by itself.
7. **Organizations earn badges** for the events they host, using Milestone 3's engine and design. A member who posts for an organization gets no host credit for that event.
8. **Organization admins see an organization impact screen,** with the same three numbers as My Impact.
9. **Admin gets the new numbers** on the owner stats page, plus an approval queue for organizations.
10. **Everything works in English and Spanish.**
11. **Backend and mobile tests pass,** each with one command.

## Out of scope (do NOT build)

- A push when a followed organization posts a new event
- Text-message reminders
- Organization share cards
- Member rosters, joining an organization, or roles beyond admin
- Paid events, ticketing, sponsorship and any payment (Milestone 5)
- Verified badges, and organization-to-organization features
- Exploring other neighborhoods as a member

## Decisions (fixed for this milestone)

| Topic | Decision |
|---|---|
| Push service | `expo-notifications` on the phone, sent through Expo's push service from the backend. Store one push token per device. Remove tokens that Expo reports as invalid. |
| Reminder time | **5:00 PM America/Denver the day before** the event starts. This is a setting in `backend/notifications/config.py`. If the member taps "I'm going" after that time, no reminder is sent. |
| Scheduled sending | Add a management command, `send_due_notifications`, that sends every reminder whose time has passed and hasn't been sent. Run it **every 15 minutes** using the simplest scheduled-job option on DigitalOcean, and document it in the README. It must be safe to run twice: each reminder is sent at most once. |
| Cancellation notice | When an event is cancelled, members who were going and allow notifications get one push right away. |
| Push text | Event title and start time only. **Never the meeting spot**, since push text shows on locked screens. For example: "Tomorrow 10:00 AM · Alley Cleanup" / "Mañana 10:00 a. m. · Limpieza del callejón". |
| Permission ask | One plain screen, shown once on the first "I'm going" after this milestone ships. If Milestone 3's auto check-in offer also appears then, show it first and this one right after. The choices are **Turn on** (leads to the system prompt) and **Not now**. It's never shown again; Settings can change it later. |
| Organization types | Nonprofit, Club, Collective, Faith community, School, Civic or government, and **Business**. Store them as keys, with labels in `en.json` and `es.json`. Every type works the same way; only the label differs. |
| Businesses | Allowed, labeled **Business**. They may post **real events people attend** (a tasting, a workshop, a game night), never sales, discounts or ads. The approval screen and the posting screen both state this rule, and members can report a post that breaks it. This is not sponsorship; `sponsor_name` stays hidden. |
| Neighborhoods | An organization lists the neighborhoods it serves (at least one), and the team approves them. **Each event still belongs to exactly one neighborhood**, chosen from that list. Members see an organization's page if it serves their neighborhood. |
| Admins | Admins are real members. An organization is never its own login. It needs 1–5 admins, and admins can live in any Denver neighborhood. The member who requests the organization becomes its first admin. |
| Approval | New organizations, and changes to their name, type or neighborhoods, wait for team approval in Django admin. Until approved, nobody else can see the organization, and it can't post. |
| Last admin leaves | If the last admin leaves or deletes their account, the organization is **hidden** (its events stay, shown as "Hosted by [Organization]") until the team assigns a new admin. **Changes `SETTINGS.md`** deleted-account rules. |
| Name and description | The name is never translated. The description has an optional version in the other language, written by an admin, plus the "Ver en español / See in English" button, both as events do (`LANGUAGE.md` Part B). |
| Follower count | Shown only to the organization's admins, never publicly, to avoid popularity contests. |

### Organization badges

Organizations earn only the **hosting side** of the Milestone 3 badges. They reuse the same engine, thresholds, `<Badge>` component and art.

| Badge | For organizations |
|---|---|
| `host` | ✓ Grows with distinct neighbors brought together at the organization's counted events |
| `fiestero`, `treasure_hunter`, `aficionado`, `recreationist`, `helping_hand`, `clean_sweeper`, `civic_voice` | ✓ Grows with hosted events in that group or category, using the map in `MILESTONE_3.md` |
| `open_door` (keepsake) | ✓ For a counted event with an admin-written version in the other language |
| `local`, `best_guest`, `day_one`, `ambassador`, `familiar_face`, `year_rounder` | ✗ These are attendance badges, which belong to people |

**Rules:**
- **Who gets host credit (Changes Milestone 3):** the host of an event is its organization when there is one, otherwise the member who posted it. The member who posts for an organization gets **no** host credit for that event: no Host, group or Open Door progress. Their attendance elsewhere counts normally.
- **Counting rule:** the same as Milestone 3. An organization event counts as hosted only once **2 neighbors** confirm they went.
- **Admins' own attendance:** members who were admins of the organization when the event took place don't get attendance credit at its events, just as hosts don't at their own.
- **Organizations as hosts for attendees:**
  - **Best Guest:** an organization counts as one distinct host.
  - **Day One:** attending an organization's **first** counted event counts toward it.
- **Display:** organization badges use `<Badge>` exactly as `BADGE_UI.md` says. The organization page labels the section "Organization badges / Insignias de la organización". They are never ranked against people or other organizations.
- **No celebrations:** organizations have no unlock moments or share cards in this milestone. Admins see new stages on the organization impact screen.

## Data model (backend)

**New models**
- **PushToken:** user, Expo token, platform, created timestamp, last-used timestamp. One row per device.
- **NotificationPref** (or fields on Profile):
  - `reminders_enabled`, default false until the member opts in
  - `cancellation_alerts_enabled`, default true once notifications are on
  - `notif_offer_shown_at`
- **ScheduledNotification:**
  - fields: user, event, `kind` (`reminder` or `cancelled`), `send_at`, `sent_at`
  - Unique per (user, event, kind), so nothing is ever sent twice.
  - Create it when the member taps "I'm going." Delete it if they untap.
- **Organization:**
  - `name` (60 characters or fewer), `type`, `description` (500 characters or fewer) and `description_alt`, `language`
  - `photo` (optional, EXIF stripped, private Spaces bucket as in Milestone 1)
  - `link` (one optional `https` URL)
  - `status`: `pending`, `approved`, `rejected` or `hidden`
  - created and updated timestamps
- **OrganizationNeighborhood:** organization, neighborhood. The neighborhoods it serves.
- **OrganizationAdmin:** organization, user, added timestamp.
- **OrganizationChangeRequest:** proposed changes to name, type or neighborhoods, waiting for approval.
- **Follow:** user, organization, created timestamp. One per pair.

**Changes to existing models**
- **Event:**
  - Add `organization` (optional FK).
  - When it's set, `organizer` still records the posting admin, for the team only. The event's `neighborhood` must be one the organization serves.
- **BadgeState, Keepsake, and the impact numbers** can belong to a **user or an organization**. Use two optional FKs with a check that exactly one is set. Keep one engine in `badges/engine.py`, and add a small `host_of(event)` helper that returns the organization or the user.
- **Attendance:** unchanged. Add a check in `record_attendance` that rejects admins of the event's organization (`is_host`).

## API (JSON, token required)

| Method | Path | Purpose |
|---|---|---|
| POST / DELETE | `/api/me/push-tokens` | Register or remove this device's token. |
| PATCH | `/api/profile/me` | Now also accepts `reminders_enabled` and `cancellation_alerts_enabled`. |
| POST | `/api/me/notif-offer/seen` | Stamps the one-time ask. |
| POST | `/api/organizations` | Request a new organization (it starts as `pending`). |
| GET | `/api/organizations/{id}` | The organization page: name, type, photo, description, neighborhoods, badges, upcoming events, past event count, and `is_following`. Admins also get `follower_count` and `status`. A 404 if it doesn't serve the caller's neighborhood, unless the caller is one of its admins. |
| PATCH | `/api/organizations/{id}` | Admins only. Description, photo and link change right away; name, type and neighborhoods create a change request. |
| POST / DELETE | `/api/organizations/{id}/admins` | Add (by an existing member's email) or remove an admin. Admins only, 1–5 total. |
| PUT / DELETE | `/api/organizations/{id}/follow` | Follow or unfollow. |
| GET | `/api/organizations?neighborhood=` | Approved organizations serving the caller's neighborhood, A–Z. No counts, no ranking. |
| GET | `/api/me/organizations` | Organizations the caller admins, with their status. |
| GET | `/api/organizations/{id}/impact` | Admins only. The three impact numbers, most popular event and badge progress. |
| POST | `/api/events` | Now accepts an optional `organization`. The caller must be one of its admins, and the neighborhood must be one it serves. |
| GET | `/api/events?following=true` | Only events from followed organizations. Each event now includes `organization` (id and name) and `is_following`. |
| POST | `/api/organizations/{id}/report` | Report an organization (same flow as event reports). |

**Error codes** (examples): `not_org_admin`, `org_not_approved`, `neighborhood_not_served`, `too_many_admins`, `last_admin`, `not_a_member`, `invalid_link` and `business_rule`.

## Flow (mobile screens)

1. **Notification ask.** One screen in the member's language:
   - "Get a reminder the day before events you're going to?"
   - "We'll only notify you about events you said you're going to, or if one gets cancelled."
   
   The choices are **Turn on** and **Not now**.
2. **Settings.** Add a **Notifications** section with two toggles: **Event reminders** and **Cancellation alerts**. If notifications are off at the phone level, the row explains that and opens the phone's Settings. Also add a **Your organizations** row listing the organizations the member admins, with **Request an organization**.
3. **Request an organization:**
   - **Fields:** name, type (with a one-line rule shown for Business), neighborhoods served (multi-select from Denver's 78), description, optional other-language description, optional photo and optional link.
   - **On submit:** "Thanks! Our team reviews new organizations, usually within a few days."
4. **Organization page.** From top to bottom:
   - photo, name, type chip, and neighborhoods served
   - **Follow / Siguiendo**
   - description, with the translation button
   - **Organization badges**
   - **Upcoming events**
   - "Past events: 12"
   - a small Report action
   
   Admins also see **Edit**, **Admins**, **Impact** and the follower count.
5. **Finding organizations.** On the neighborhood or Events screen, an **Organizations** link opens an A–Z list of approved organizations serving the member's neighborhood. Event cards and detail show **"Hosted by [Organization]"**, which links to its page.
6. **Posting as an organization.** For members who admin an approved organization, the post flow starts with **Post as: You / [Organization]**. Choosing an organization limits the neighborhood picker to the neighborhoods it serves. For Business organizations, the Details step shows the real-events rule.
7. **Events tab.** Add a **Following** chip after **For you**, plus the **Following / Siguiendo** tag on matching cards. If the member follows nobody, the chip shows "Follow organizations to see their events here."
8. **Organization impact** (admins only): the same layout as My Impact's host section. It shows the three numbers, the most popular event and badge progress bars. It never shows names, and never compares with other organizations.

**Design:** `DESIGN.md` style, `BADGE_UI.md` badges, touch targets of at least 44 pt, and Spanish text that wraps.

## Admin

- **Organization approval queue:** pending organizations and change requests, with Approve and Reject buttons and a required rejection reason. The reason isn't shown to members in this milestone.
- **Assign admin:** for hidden organizations.
- **Owner stats page** (`GO_LIVE.md` §4) additions, as counts only:
  - organizations by type and status
  - pending approvals
  - follows
  - events posted by organizations vs. members (last 30 days)
  - reminders sent and cancellation notices sent (last 30 days)
  - the share of active members with notifications on

## Privacy and safety

- **Push text** never includes the meeting spot, addresses or other members' names.
- **Push tokens** are deleted on logout from that device and on account deletion.
- **The posting admin** is visible only to the team in Django admin, never in the app.
- **Organization photos** follow Milestone 1's photo rules.
- **Following** is private: no one sees who follows an organization, and admins see only the count.
- **Logs:** don't log push tokens or notification text at info level.

## Tests

**Backend** (one command):
- **Reminders:**
  - They're scheduled at 5:00 PM Denver the day before, and there's none if "I'm going" was tapped after that time.
  - Untapping removes the reminder.
  - `send_due_notifications` run twice sends each reminder once.
  - Cancelling an event sends one cancellation notice to members going who have alerts on, and nothing to others.
  - Invalid Expo tokens are removed. Expo is always mocked; tests never call it.
- **Push text** contains the title and time, never `location_text`.
- **Organizations:**
  - A new request is `pending` and invisible to others.
  - Approval makes it visible in its neighborhoods only, and a 404 elsewhere.
  - Name, type and neighborhood edits create a change request.
  - There are 1–5 admins; removing the last admin is refused, and deleting the last admin's account hides the organization.
- **Posting as an organization:**
  - Only admins can do it.
  - The neighborhood must be served (`neighborhood_not_served`).
  - The event shows the organization, and the API never exposes the posting admin.
- **Badges:**
  - An organization event credits the organization, never the posting member.
  - It counts as hosted only with 2 counted attendees.
  - The organization grows Host and the group badges.
  - Admins can't collect at their own organization's events (`is_host`).
  - Best Guest counts an organization as one host.
  - Day One counts an organization's first counted event.
  - Milestone 3 member badges are unchanged for events without an organization.
- **Following:** follow, unfollow and one-per-pair work. `following=true` filters correctly, and the follower count is returned only to admins.
- **Owner stats** show the new counts.
- Earlier milestones' tests still pass.

**Mobile** (one command):
- The notification ask appears once, in the right order after the auto check-in offer, and "Not now" keeps notifications off.
- The Settings toggles work, and so does the phone-level "off" state.
- The request-an-organization form validates, and the Business rule text appears.
- The organization page renders for members and admins (admin-only items hidden for members).
- **Post as** appears only for admins of approved organizations and limits the neighborhoods.
- The Following chip, tag and empty state work.
- **Organization badges** render with `<Badge>`.
- Every new screen renders in Spanish with no missing keys.

**Manual check on real phones** (add to the README):
1. Turn on reminders.
2. Tap "I'm going" on an event for tomorrow, then confirm the 5 PM push arrives with no meeting spot.
3. Cancel another event and confirm the notice arrives.
4. Request an organization, approve it in admin, post as it, and follow it from a second account.
5. Collect from two accounts and confirm the organization's Host badge grows while the posting admin's doesn't.

Push notifications need a `development` build, not Expo Go, just like auto check-in.

## How to work

Build in small steps, in this order:
1. Push tokens, preferences and the `send_due_notifications` command (with Expo mocked)
2. Reminder and cancellation scheduling
3. The Organization models, approval and admin screens
4. The organizations API and follows
5. Posting as an organization
6. Badge engine changes (`host_of`) and the organization impact numbers
7. Owner stats additions
8. Get the backend tests green
9. The notification ask and Settings rows
10. Request an organization
11. The organization page and list
12. Post as
13. Following chip and tag
14. Organization impact
15. Mobile tests

Run the tests after each step. Commit after each green step with a clear message.

If anything here conflicts with an earlier milestone, ask rather than guess.

## Open items for the owner

- **Approval checklist:** what the team checks before approving (a real group, a real local presence, an authorized requester).
- **First organizations:** 3–5 real Globeville groups to invite first, ideally including one Civic and one Faith or School group.
- **Business rule wording:** approve the English and Spanish text.
- **Reminder time:** 5:00 PM the day before is the default; change it in config if beta feedback says otherwise.
- **"Ready to collect" push:** Milestone 3 decided no notifications for collect cards. Decide after the beta whether one push the morning after an event would help more people collect.
- **Expo push and the Apple Developer account:** iPhone push needs the Apple Developer membership, which you'll need for TestFlight anyway.
