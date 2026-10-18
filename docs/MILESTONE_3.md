# Milestone 3: Badges, attendance and My Impact

**App name:** Globeville. The name still lives only in `shared/app_config.json`.

**Builds on:** Milestones 1, 1.5 (`SETTINGS.md`) and 2. Every rule in those docs still applies.

**Read first:**
- **`BADGE_UI.md`, the visual spec:** exact drawing values for `<Badge>` (ring, stage pips, size tiers, keepsakes, unearned look), the share card and its preview screen. Build visuals from it; no mock files are needed.
- **`BADGES.md`, the source of truth for every badge rule:** names, tracks, stage thresholds, what counts, keepsakes, impact metrics, descriptions and emblems. This doc says how to *build* it. If the two disagree, `BADGES.md` wins on rules; ask about anything unclear.
- `DESIGN.md`, `BRAND.md`, `LANGUAGE.md` and `GO_LIVE.md`. The last one covers the owner stats page this milestone extends. Only §4 of `GO_LIVE.md` is code work; the rest is the owner's launch plan.
- The earlier milestone docs (`MILESTONE_1.md`, `SETTINGS.md`, `MILESTONE_2.md`) should already be in the repo.

**Scope:** this milestone only. Push reminders are Milestone 4.

The product owner is learning Python. Prefer clear, conventional code over clever code, and explain non-obvious decisions in short comments or in your summary.

## Context

Badges reward neighbors for **showing up**, never for ranking. Each of the 11 growth badges grows Seed → Sprout → Bloom → Tree → Grove. The 4 keepsakes are earned once.

Attendance has to be real, so tapping "I'm going" alone never counts. Members either opt in to **auto check-in** (the phone notices they arrived; no location is sent or stored), or tap **Collect** after the event.

Hosts get a private **My Impact** screen showing how many neighbors their events brought together.

## Done when

1. **Events have a map pin.** New and edited events require one. The typed meeting spot stays as the label.
   - **Events posted before this milestone have no pin** (this includes the private beta's events). Organizers of *upcoming* pinless events see an "Add a map pin" prompt on their event. Until they add one, the event works with Collect only.
   - **Getting there:** tapping an event's location opens an **Open in** sheet listing the map apps installed on the phone: Apple Maps, Google Maps, Waze. A **Remember my choice** option skips the sheet next time, and Settings can change it.
2. **Members can turn on auto check-in.** It's offered the first time they tap "I'm going," and they can change it in Settings. When it's on, arriving at an event during its window records attendance automatically.
3. **Everyone else gets collect cards.** After an event ends, members who tapped "I'm going" see a **Ready to collect** card, with **Collect** and **I didn't make it**. The card expires after 7 days.
4. **All 15 badges are awarded automatically** from counted attendance and hosting, exactly as `BADGES.md` defines them, and stages never go backward.
5. **The Profile shows earned badges** with the growing-ring design, and tapping a badge opens its detail.
   - **Show my badges to:** My neighborhood (the default) or Only me. The member always sees their own badges.
6. **My Impact** shows:
   - collect cards
   - badge progress bars
   - for hosts, three numbers: neighbors brought together, first-timers welcomed and came back
7. **Unlock moments appear the next time the app opens.** Several unlocks combine into one celebration, and each badge can be shared as an image card through the phone's share sheet.
8. **"See all badges"** shows every badge, with unearned ones dimmed.
9. **Admin gets the new numbers:** the owner stats page gains the badge and attendance counts from `GO_LIVE.md` §4, and admin shows the community badge results.
10. **Settings gains four rows:** Auto check-in, Show my badges to, Maps app, and Open-source credits (with Lucide's ISC license).
    - **Auto check-in is re-offered once, ever.** This happens when it's off and 3 collect cards have expired uncollected.
11. **Everything works in English and Spanish,** and every badge has a screen-reader label.
12. **Backend and mobile tests pass,** each with one command.

## Out of scope (do NOT build)

- Push notifications and reminders (Milestone 4)
- Hiding single badges, and an "All of Denver" badge visibility option (both later, `BACKLOG.md`)
- Public neighborhood "Known for" badges (admin-only for now)
- Per-neighborhood badge splits (alumni)
- Benched badges: Brainiac, Green Thumb, Swapper, Welcomer and the other "Later" badges
- QR or host check-in
- Any ranking, leaderboard or total

## Decisions (fixed for this milestone)

| Topic | Decision |
|---|---|
| Badge rules | Exactly as in `BADGES.md`. Thresholds live in **one backend config file** (`backend/badges/config.py`) and are served to the app. Never hard-code them in the mobile app. |
| Never demote | A member's **highest stage reached** is stored and never lowered, even if thresholds rise or counts drop (deleted members, removed events). |
| When badges are computed | **At the moment attendance is recorded** (auto check-in or collect), in one function that updates every affected badge for the attendee *and* the host. No scheduled jobs are needed. Collect cards and impact numbers are derived from data on request. |
| Time zone | America/Denver. An event with no end time ends at 00:00 the next day. |
| Auto check-in | `expo-location` geofencing plus `expo-task-manager`: about 150 m radius, active from 30 minutes before the start until the end. At most the next **20** upcoming events (an iPhone limit). Fences are swapped as events pass. Uses "Always" location permission only after the explanation screen. |
| Location privacy | The phone does the watching. The server only receives "checked in to event X," never coordinates. Nothing about a member's location is stored or logged. |
| Maps | `react-native-maps`: Apple Maps on iPhone, Google Maps on Android. The Android Google Maps API key is an environment setting (owner provides it). |
| Getting there | Open the event's pin, labeled with the meeting spot, in the member's chosen app using each app's standard link: Apple Maps `https://maps.apple.com/?ll={lat},{lng}&q={label}`, Google Maps `https://www.google.com/maps/search/?api=1&query={lat},{lng}`, and Waze `https://waze.com/ul?ll={lat},{lng}&navigate=yes`. These open the app when it's installed, on both platforms. To detect installed apps, check `comgooglemaps://` and `waze://` with `Linking.canOpenURL`. On iPhone, list the schemes under `LSApplicationQueriesSchemes`. On Android, add matching `<queries>` entries with a config plugin. Apple Maps is listed on iPhone only. The choice is saved **on the phone** (AsyncStorage), since installed apps differ per device. Events without a pin open the typed meeting spot as a search. |
| Badge visibility | `Profile.badge_visibility`: `neighborhood` (default) or `private`. It's one setting for all badges. It never affects growth, celebrations, My Impact or sharing. |
| Auto check-in re-offer | Shown **at most once per member, ever**. It appears only when auto check-in is off, the member hasn't seen the re-offer, and **3 collect cards have expired without being collected** since the first offer (declines don't count). It's a card at the top of My Impact, never a pop-up. If the phone's location permission was denied, its button opens the phone's Settings. Members who collect never see it. |
| Share card | **Approved; layout, wording and strings are in `BADGE_UI.md` §3.** Rendered on the phone with `react-native-view-shot` and opened with `expo-sharing`. The invite link comes from `shared/app_config.json` (`invite_url`). |
| Emblems | Lucide icons (`lucide-react-native`, version 1.47.0 or later), except Host's custom paper lantern, with icons and yellow accents listed in `BADGE_UI.md`. One reusable `<Badge>` component takes the emblem, stage, size and kind (growth or keepsake). Stage pips are Lucide too: `bean`, `sprout`, `flower`, `tree-pine` and `trees`. |
| Sensitive categories | Attending `resource_fair` or `donation_drive` never counts toward any badge or progress hint. Hosting them counts. |
| Testing auto check-in | Background geofencing and the "Always" permission need the app's own native settings, so **auto check-in can't be tested in Expo Go**. Test it with an EAS `development` build. iPhone builds need the owner's Apple Developer account; Android builds don't. Everything else in this milestone still works in Expo Go. |

### Which events grow which badge

Category and group keys are from `MILESTONE_2.md`. "Attended" and "hosted" follow `BADGES.md`. A hosted event counts only once it has at least 2 counted attendees.

| Badge | Grows from | Attended | Hosted |
|---|---|---|---|
| `local` | Any category, including `other` | ✓ | — |
| `best_guest` | Distinct organizers of events attended | ✓ | — |
| `host` | Distinct neighbors with counted attendance at your counted hosted events | — | ✓ |
| `day_one` | Attending an organizer's **first** counted hosted event | ✓ | — |
| `fiestero` | Group `celebrate` | ✓ | ✓ |
| `treasure_hunter` | Group `buy_swap` | ✓ | ✓ |
| `aficionado` | Group `entertainment` | ✓ | ✓ |
| `recreationist` | Group `get_active` | ✓ | ✓ |
| `helping_hand` | Group `community`. **Attending** `resource_fair` or `donation_drive` doesn't count. | ✓ | ✓ |
| `clean_sweeper` | Category `cleanup` | ✓ | ✓ |
| `civic_voice` | Category `community_meeting` | ✓ | ✓ |
| `ambassador` | Attending an event whose `language` differs from your language at the time | ✓ | — |
| `open_door` | A counted hosted event with an **organizer-written** `title_alt`. Machine translations (`TranslationCache`) don't count. | — | ✓ |
| `familiar_face` | Attendance in 3 calendar months in a row (Denver time) | ✓ | — |
| `year_rounder` | Attendance in all four seasons: Dec–Feb, Mar–May, Jun–Aug, Sep–Nov | ✓ | — |

Learn & Connect events and `other` grow only `local`, `best_guest`, `day_one`, the keepsakes and, for hosts, `host`. Display text for counts (for example "5 cleanups") is in `BADGE_UI.md` §4.

## Data model (backend)

**Changes to existing models**
- **Event:**
  - add `latitude` and `longitude` (6 decimals). They're required on create and edit from this milestone on, and old events may have none.
  - Lock `category` once the event has ended: edits after the end can't change it.
  - Lock the pin once the event has started, matching Milestone 2's rule that a started event can't be moved.
- **Profile:**
  - add `auto_checkin`, a boolean that defaults to false
  - add `badge_visibility` (`neighborhood` or `private`, default `neighborhood`)
  - add `checkin_offer_shown_at` and `checkin_reoffer_shown_at` (timestamps, empty by default)

**New models**
- **Attendance:**
  - fields: user, event, `neighborhood` (copied from the event), `method` (`auto` or `collect`), `is_first_in_neighborhood`, `user_language_at_time`, created timestamp
  - one row per user per event
  - **This is the only thing that counts as attending.**
- **BadgeState:**
  - fields: user, `badge_key`, `count` (the current qualifying count), `stage` (0 = not earned, 1–5 = Seed–Grove; the highest reached, never lowered), `grove_milestones_celebrated`, updated timestamp
  - One row per user per growth badge.
- **Keepsake:** user, `badge_key`, earned timestamp.
- **Celebration:**
  - fields: user, `badge_key`, `kind` (`earned`, `stage_up` or `grove_milestone`), `stage`, `count`, created timestamp, `seen_at`
  - Unseen rows are shown as unlock moments.
- **ShareLog:** `badge_key` and date only. **No user**, no destination. It's used only for counting.

**Deleted accounts** (extends `SETTINGS.md`): delete the member's Attendance, BadgeState, Keepsake and Celebration rows. Their attendance drops out of hosts' impact numbers, but hosts' stages are never lowered.

## Badge engine (backend)

Write one module, `backend/badges/engine.py`, with a single entry point: `record_attendance(user, event, method)`. It must be **idempotent**: calling it twice for the same user and event changes nothing.

1. **Check that the attendance qualifies:**
   - the event isn't cancelled or removed
   - the user had tapped "I'm going"
   - the user isn't the host
   - the timing is right: collect is allowed only between the event's end and 7 days after; auto check-in only between 30 minutes before the start and the end
   
   If anything fails, return a clear error code.
2. **Create the Attendance row,** and set `is_first_in_neighborhood` when the user has no earlier Attendance in that neighborhood.
3. **Recompute the attendee's badges** that this event touches. Each count comes straight from Attendance rows, so it's always correct:
   - `local`: every counted attendance
   - `best_guest`: distinct hosts
   - the group badges, `clean_sweeper` and `civic_voice`: events in that group or category, **attended or hosted**, skipping sensitive categories for attendance
   - the keepsakes:
     - `ambassador`: the event's language differs from `user_language_at_time`
     - `familiar_face`: attendance in 3 calendar months in a row
     - `year_rounder`: all four seasons
4. **Recompute the host's side:**
   - **Does the event count as hosted?** It needs at least 2 counted attendees. The first time it crosses that line, it counts for the host's group and signature badges.
   - `host`: count distinct neighbors brought together across all the host's counted events.
   - `open_door`: earned if the counted event has a Spanish/English alternate title (`title_alt`).
   - `day_one`: when this is the **host's first event that counts as hosted**, award progress to **every** counted attendee of that event, including people who collected earlier, before it crossed the 2-attendee line.
5. **Raise stages, and never lower them.** For each badge whose count crosses a threshold from `config.py`:
   - set the new stage
   - create a Celebration row
   - for Grove badges, create a Celebration at 2× and 3× the Grove number
6. **Wrap it all in one database transaction.**

Add `decline(user, event)`: it deletes the user's "I'm going" row for that past event, which removes them from the going count and from their collect cards. It records nothing toward badges.

**Impact numbers** (computed on request, per `BADGES.md`):
- **Neighbors brought together:** distinct attendees across the host's counted events
- **First-timers welcomed:** distinct attendees of the host's events whose Attendance at that event has `is_first_in_neighborhood`
- **Came back:** distinct attendees of the host's events who have any later Attendance in the same neighborhood, at an event from any host

**Community badges** (admin-only): computed when the admin page loads, from the last 12 months of counted events, using the rules in `BADGES.md`. Nothing is stored and nothing is shown in the app.

## API (JSON, token required)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/badges/catalog` | Every badge: key, kind, track, emblem key and thresholds. The app holds the label and description text (`badges.<key>.name` / `.description`). |
| GET | `/api/me/badges` | For each badge: stage, count, next threshold and earned date. |
| GET | `/api/members/{id}/badges` | A neighbor's earned badges and stages (same neighborhood only; anyone else gets a 404). If the member chose Only me, it returns an empty list, so the profile simply shows no Badges row. |
| GET | `/api/me/collect` | Ready-to-collect cards: past events the user is going to, ended less than 7 days ago, with no Attendance. Each card includes which badges it would grow. |
| POST | `/api/events/{id}/collect` | `record_attendance(..., 'collect')`. Returns any new celebrations. |
| POST | `/api/events/{id}/decline` | "I didn't make it." |
| POST | `/api/events/{id}/checkin` | Called by the geofence task: `record_attendance(..., 'auto')`. **The body has no location fields.** |
| GET | `/api/me/geofences` | Up to 20 upcoming going events, with pin and time window, so the app can register fences. |
| GET | `/api/me/impact` | Host numbers plus "most popular event" (title, date and attendee count). It's empty until the first counted hosted event. |
| GET | `/api/me/celebrations` · POST `/api/me/celebrations/seen` | Unseen unlock moments, and marking them seen. |
| POST | `/api/badges/{key}/shared` | Adds a ShareLog row (badge and date only). |
| PATCH | `/api/profile/me` | Now also accepts `auto_checkin` and `badge_visibility`. |
| GET | `/api/me/collect` (same as above) | Also returns `show_checkin_reoffer: true/false`, following the re-offer rule. |
| POST | `/api/me/checkin-offer/seen` | Body `{ "which": "first" or "reoffer" }`. Stamps the matching timestamp, so the offer never repeats. |
| POST/PATCH | `/api/events` | Now require `latitude` and `longitude`. |

Errors return codes, as `LANGUAGE.md` requires. Examples: `not_going`, `event_not_ended`, `collect_window_closed`, `checkin_window_closed`, `already_recorded`, `is_host`, `event_cancelled` and `pin_required`.

## The flow (mobile screens)

1. **Posting an event: map pin step.** After Details, show a map centered on the member's neighborhood. The organizer drags a pin to the meeting spot. The typed meeting spot stays the label. Editing an event shows the same map.
2. **First "I'm going": auto check-in offer.** Show one plain screen in the member's language:
   - **what it does:** "Your phone notices when you arrive at events you're going to, and your badge grows on its own."
   - **what it never does:** "We never see or store where you are."
   - **the choices:** "Turn on" and "Not now"
   
   "Turn on" leads to the system permission prompts, ending with "Always." If the member declines at any point, the setting stays off. The first offer is never shown again. The only other ask is the single re-offer card in My Impact (step 5), and the member can always change it in Settings.
3. **Settings.** Add these rows:
   - **Auto check-in:** a toggle.
   - **Show my badges to:** My neighborhood / Only me.
   - **Maps app:** Ask every time, or a remembered app. It lists only installed apps.
   - **Open-source credits:** the license list, including Lucide's ISC text.
   
   **Event detail:** tapping the location opens the **Open in** sheet (Apple Maps / Google Maps / Waze, installed ones only, plus **Remember my choice**). On Android, Apple Maps never appears. If only one app is installed, it opens directly.
4. **Profile.**
   - Add a **Badges** row of earned badges using `<Badge>` at profile size.
   - Tapping a badge opens **Badge detail**: emblem, name, stage name, count (for example "5 cleanups"), description and **Share**.
   - The member's own profile also has a **My Impact** button.
   - Neighbors see a member's badges, never their My Impact screen.
5. **My Impact**, private, from top to bottom:
   - **Auto check-in re-offer card**, only when `show_checkin_reoffer` is true. For example: "Missed a few? Auto check-in can collect for you." It has **Turn on** and **No thanks**, and either choice stamps it as seen for good.
   - **Ready to collect** cards. Each shows the event name and date, a line like "1 more to Sprout," and the **Collect** and **I didn't make it** buttons.
   - **Badge progress:** in-progress badges, closest to their next stage first, each with its stage and a bar. Hints never name sensitive categories.
   - **Your impact as a host:** shown after the first counted hosted event. It has the three numbers and the most popular event, with no score or comparison.
   - A **See all badges** link.
6. **See all badges:**
   - all 15 badges grouped into Growth and Keepsakes
   - earned ones show their stage
   - unearned ones are a dimmed emblem with no ring (keepsakes inside a faint stamp outline), plus the description
7. **Unlock moment.**
   - **When:** on app open or return to the foreground, the app fetches unseen celebrations and shows them in one full-screen moment. Several are swipeable.
   - **The text:**

     | Moment | English | Spanish |
     |---|---|---|
     | New badge | "You earned {badge}!" | "¡Ganaste {insignia}!" |
     | Stage up | "{badge} grew to {stage}!" | "¡{insignia} creció a {etapa}!" |
     | Grove milestone | "{badge}: {count} {units}!" | "{insignia}: ¡{count} {unidades}!" |
     | Several at once | "{n} badges grew 🌱" | "¡{n} insignias crecieron 🌱!" |

     Under the text, show the badge's description from `BADGES.md`.
   - **The animation:** the ring fills to its new stage in the glow style, with a still version when reduce-motion is on.
   - **Buttons:** **Share / Compartir** and **Not now / Ahora no**.
   - **When it never appears:** in the middle of posting or editing.
8. **Share card.** Build it exactly as `BADGE_UI.md` §3 says: the image, the "earned / ganó" wording, the message text, the preview screen with the **Show my neighborhood** toggle (on by default), and what the card must never show.
   - **Share:** opens the phone's share sheet and calls `/api/badges/{key}/shared`.
   - **Where it's available:** the unlock moment, and the badge detail screen for any earned badge.

**Design:**
- `DESIGN.md` glow style on midnight purple.
- Draw badges exactly as `BADGE_UI.md` §2 says. Three size tiers: Large (standard pip), Profile (thicker ring, bigger pip) and List (thicker ring, no pip).
- Touch targets are at least 44 pt.
- Spanish text wraps, never cuts off.

**Accessibility:** every `<Badge>` has a spoken label like "Clean Sweeper, Bloom stage, 5 cleanups" ("Escobita, etapa Flor, 5 limpiezas"). Keepsakes say "earned."

## Admin

- **Owner stats page** (`GO_LIVE.md` §4), last 30 days:
  - attendances counted, split into auto check-in and collected
  - declines
  - badges earned and stage-ups
  - shares (from ShareLog)
- **Community badges:** a read-only admin view listing each neighborhood's "known for" results from the last 12 months.
- Counts only, no member names.

## Privacy and safety

- **Location:** no coordinates, location history or movement are ever sent to or stored by the server. Geofences live only on the phone. The check-in request has no location fields, and a test proves it.
- **Event pins:** they mark the event's place, never a home. Milestone 1's address rule is unchanged.
- **Hosts:** they never see who declined, how many people didn't show, or any individual attendee's badges through My Impact.
- **Sensitive categories:** excluded from attendance credit and from every hint.
- **ShareLog:** stores no user.
- **Logs:** don't log check-in or collect requests with user ids at info level.

## Tests

**Backend** (one command):
- **`record_attendance`:**
  - It records attendance when valid.
  - It rejects these with the right codes: not going, the host themselves, a cancelled event, outside the collect window, outside the check-in window.
  - Calling it twice changes nothing.
- **Every badge** reaches each stage at the thresholds in `config.py`, attended and hosted where applicable. One event grows several badges at once.
- **Sensitive categories:** attending a resource fair or donation drive grows nothing; hosting one grows Helping Hand.
- **Hosted events:**
  - An event counts only with 2 or more counted attendees.
  - When it crosses that line, it credits the host's group badge.
  - Day One is awarded to all counted attendees of the host's first counted event, including earlier collectors.
- **Keepsakes:**
  - Ambassador uses the language at the time of attendance.
  - Open Door is awarded.
  - Familiar Face needs 3 calendar months in a row, and fails with a gap.
  - Year-Rounder needs all four seasons across different years.
- **Never demote:** raising a threshold or deleting an attendee never lowers a stored stage.
- **Grove milestones:** celebrations are created at 2× and 3× the Grove number.
- **Impact numbers:**
  - neighbors brought together counts distinct people
  - first-timers is scoped per neighborhood
  - came back counts a later event from another host in the same neighborhood and ignores other neighborhoods
  - deleted members drop out
- **Decline** removes the member from the going count and from collect cards. An ignored card disappears after 7 days.
- **Events with no end time** end at midnight Denver time.
- **Category** can't change after the event ends.
- **`/checkin`** accepts no location fields and stores none. **`/geofences`** returns at most 20 upcoming events.
- **`/members/{id}/badges`** returns a 404 outside the neighborhood, and an empty list when the member chose Only me, while their own `/me/badges` still shows everything.
- **Re-offer flag:**
  - It turns true only after 3 expired, uncollected (not declined) cards with auto check-in off.
  - It's never true after it was seen, or for members who collect.
- **Pins:** events without a pin can still be collected, and `/geofences` skips them.
- **ShareLog** rows have no user.
- **Owner stats** show the new counts. **Community badges** compute correctly from fixtures.
- Earlier milestones' tests still pass.

**Mobile** (one command):
- **`<Badge>`** renders every stage and both kinds, at profile and large sizes, with the right accessibility label in both languages.
- **The map pin step** is required on post, and edit keeps the existing pin. Upcoming pinless events show the organizer the "Add a map pin" prompt.
- **The Open in sheet:**
  - It lists only installed apps (mocked `Linking.canOpenURL`).
  - Remember my choice skips the sheet.
  - The Settings row resets it.
  - One installed app opens directly.
- **The re-offer card** shows once and disappears for good after either button.
- **The auto check-in offer** appears once, on the first "I'm going." "Not now" keeps it off. The Settings toggle works.
- **Geofence registration:** the next 20 fences are registered, and fences are removed when an event passes or is cancelled, or "I'm going" is turned off (mocked `expo-location`).
- **My Impact:**
  - collect cards appear, and Collect and I didn't make it both work
  - progress is sorted closest-first
  - no hint names a sensitive category
  - the host section appears only after a counted hosted event
- **The unlock moment** groups several celebrations, respects reduce-motion, and never appears mid-post.
- **The share card** never contains a last name or photo. The neighborhood toggle works.
- **Every new screen** renders in Spanish with no missing keys.

**Manual check on real phones** (add to the README):
1. Post an event with a pin.
2. From a second phone running a `development` build (not Expo Go) with auto check-in on, walk to the pin during the event and confirm the badge grows with no tap.
3. From a third phone, collect after the event, then decline another event.
4. Check the host's My Impact numbers.
5. Share a badge to Messages.

## How to work

Build in small steps, in this order:
1. `config.py` and the models, with migrations
2. Event pins in the API
3. The badge engine and impact numbers
4. The collect, decline, check-in and geofence endpoints
5. The badges, celebrations and share endpoints
6. Admin stats and community badges
7. Get the backend tests green
8. The `<Badge>` component
9. The map pin step and the Open in sheet
10. Profile badges and badge detail
11. My Impact
12. See all badges
13. Unlock moments and share cards (per `BADGE_UI.md` §3)
14. The auto check-in offer and re-offer, Settings rows, and geofencing
15. Mobile tests

Run the tests after each step. Commit after each green step with a clear message.

If anything here conflicts with `BADGES.md` or an earlier milestone, ask rather than guess.

## Open items for the owner

- **Android maps key:** provide a Google Maps API key for Android maps (free at this scale).
- **Invite link:** `invite_url` is `https://globeville.app`, a simple page with both store links. The owner sets it up before Phase B.
- **Link preview line** for `globeville.app` (currently "globeville: your neighborhood, together"). This is a placeholder to iterate on; it's set on the landing page, not in the app.
- **Location wording:** approve the auto check-in explanation and permission text in both languages before the public launch.
- **Spanish review:** badge names and descriptions, stage names, and the new screens.
- **Grove timing for renters:** still benched with alumni (`BACKLOG.md`).
