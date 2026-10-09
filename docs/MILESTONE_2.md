# Milestone 2: Neighborhood calendar — post events, "I'm going", categories

**App name:** Globeville. The name still lives only in `shared/app_config.json`.

**Builds on:** Milestone 1: join flow, profiles, email login, the Expo app and the Django REST backend. Read `MILESTONE_1.md` first. Every rule there still applies.

**Also read:**
- `DESIGN.md` for the visual style.
- `LANGUAGE.md`. Part B of it is built in this milestone.
- `BRAND.md` for the logo.

**Scope:** this milestone only. Do not build the rest of the app.

## Context

Partiful already handles invitations well: invite pages, guest lists and reminders. Globeville should not rebuild that.

What's missing is a way for neighbors to discover what's happening nearby when nobody sent them an invite. That includes the neighbor two doors down whose number the organizer doesn't have, and neighbors who read Spanish first. Partiful only reaches people the host already knows.

So this milestone is a **neighborhood calendar**, not an invitation tool:
- Members post events to their neighborhood, either by pasting a Partiful link or by typing a few details.
- Every event has a category.
- Neighbors tap "I'm going."

Categories and "I'm going" counts are what later features (badges, community profiles, ways to meet) will use to describe a neighborhood. Store them cleanly.

The product owner is learning Python. Prefer clear, conventional code over clever code. Explain non-obvious decisions in short comments or in your summary.

## Done when

1. A member can post an event to their own neighborhood. It needs a category, a title, a start time (end time optional) and a meeting spot. The description is optional.
2. Choosing a category is a two-step picker: pick a group, then a category. There is also a search box that matches English and Spanish names.
3. A member can paste a Partiful link. The title is prefilled when possible and a category is suggested. The event card then shows "Open in Partiful."
4. Members see upcoming events in their neighborhood in an Events tab, soonest first. They can filter by group.
5. Members can tap **I'm going** and tap again to undo. The card shows how many neighbors are going.
6. The organizer can edit or cancel their event. Cancelled events show as cancelled and are not deleted.
7. Any member can report an event. Reports appear in Django admin.
8. **Interests use the event categories.** Profile setup and Edit profile let members choose interests from the same groups and categories used for events. The old Milestone 1 interests list is retired, and existing picks carry over. On the Events tab, events matching a member's interests show a "For you" tag, and a "For you" filter is available.
9. Everything works in English and Spanish, as `LANGUAGE.md` requires. That includes category names, the "Ver en español" button and Spanish versions of event text.
10. Backend and mobile tests pass, each with one command.

## Out of scope (do NOT build)

Leave clean seams for these, but don't stub them out:
- Guest lists and names of attendees
- Maybe / Can't go answers
- Invitations
- Reminders and add-to-calendar
- Badges
- Media board
- Fundraisers and payment links (GoFundMe, Venmo, Zelle)
- Text blasts and push notifications
- Co-hosting across neighborhoods, or events visible to other neighborhoods
- Ticketing, any paid feature, sponsor UI
- Audience tags such as "Good for kids"
- Bug reporting (it has its own document)

## Decisions (fixed for this milestone)

| Topic | Decision |
| --- | --- |
| Platform | Same as Milestone 1: the Expo app (iOS and Android) and the Django REST backend. |
| Who can post | Any member, and only for their own neighborhood. Posting a first event sets the user's role to `organizer`. |
| Visibility | Members of the neighborhood only. Public and cross-neighborhood events come later. |
| Partiful | There is no Partiful API we can use. Accept a pasted link, show it on the card, and prefill the title from the page's Open Graph tags (see below). When a link exists, Partiful is where people go for the full invite. |
| Going | One action: "I'm going" on or off. It is stored for every event, including Partiful-linked ones, so attendance can count toward badges later. |
| Categories | A fixed list in code (see below). Each event has exactly one category. "Other" requires a short write-in. |
| Interests | One shared list. A member's interests are category keys from the list below, never a separate list. Members choose up to 8. "Other" can't be chosen as an interest. Adding a category later automatically makes it available as an interest. |
| Time | Store times in UTC. Display and enter them in America/Denver. |
| Sponsor | Add an optional `sponsor_name` field to the event model. No UI and no API access yet. It is a seam for monetization later. |
| Addresses | Milestone 1's rule stands: no member's home address is ever stored. The organizer types the event location, and neighbors can see it. |

## Categories

Store categories as **stable keys**, never as display text, so labels can be renamed later without breaking past events.

- English and Spanish labels go in `en.json` and `es.json` under `categories.<key>`.
- Group labels go under `category_groups.<key>`.
- The list is defined once, in `backend/events/categories.py`, and served by `GET /api/config`.
- The mobile app reads the list from the API and does not keep its own copy.

| Group key (label) | Category keys (English label) |
| --- | --- |
| `celebrate` (Celebrate) | `block_party` (Block Party), `potluck` (Potluck / Cookout), `festival` (Festival), `parade` (Parade), `cultural_celebration` (Cultural Celebration), `pool_party` (Pool Party) |
| `buy_swap` (Buy, Sell & Swap) | `market` (Market), `pop_up` (Pop-up), `yard_sale` (Yard Sale), `swap` (Swap) |
| `entertainment` (Entertainment) | `live_music` (Live Music), `comedy` (Comedy), `arts_crafts` (Arts & Crafts), `movie_night` (Movie Night), `game_night` (Game Night), `watch_party` (Watch Party) |
| `get_active` (Get Active) | `pickup_game` (Pickup Game), `fitness` (Fitness), `gardening` (Gardening), `pet_meetup` (Pet Meetup) |
| `community` (Community & Giving) | `cleanup` (Cleanup), `volunteering` (Volunteering), `donation_drive` (Donation Drive), `fundraiser` (Fundraiser), `community_meeting` (Community Meeting), `resource_fair` (Resource Fair) |
| `learn_connect` (Learn & Connect) | `workshop` (Workshop), `networking` (Networking), `expo` (Expo), `meet_greet` (Meet & Greet), `seniors` (Seniors) |
| (shown at the bottom of every group) | `other` (Other), which requires a write-in of 40 characters or fewer |

**Search hints.** Each category also has a few search words in each language, so typing a familiar word finds it. Examples:

- `market`: "farmers, flea, bazaar, mercado, tianguis"
- `game_night`: "trivia, lotería, board games, juegos"
- `festival`: "fair, feria, carnival"
- `cleanup`: "limpieza, trash, alley, river"
- `donation_drive`: "food drive, clothing drive, toy drive, colecta"

Put these hints in the language files under `category_hints.<key>`.

**Benched for later (do not add):**
- Kids & Family and Seniors as audience tags
- Language Exchange (Intercambio)
- Welcome Neighbors (pairs with "arriving soon")
- Faith & Community

## Data model (backend)

- **Profile:** add `role`, with values `member` (the default) and `organizer`.
- **Profile interests:** store them as a list of category keys (0–8, no duplicates, `other` not allowed).
  - Write a data migration that converts Milestone 1's interest keys:
    - `block_parties` → `block_party`
    - `food_drives` → `donation_drive`
    - `cleanups` → `cleanup`
    - `live_music` → `live_music`
    - `gardening` → `gardening`
  - Drop any key the migration doesn't recognize, and log a count of dropped keys (never the user).
  - Remove the old interests list from `/api/config`.
- **Event:**
  - `id`, `neighborhood` (FK), `organizer` (FK user)
  - `category` (one of the keys above), `category_other` (40 characters or fewer, required only when the category is `other`)
  - `title` (80 characters or fewer), `description` (optional, 2,000 characters or fewer)
  - `language` (`en` or `es`; defaults to the organizer's profile language)
  - `title_alt` and `description_alt` (optional, in the other language, with the same limits)
  - `starts_at`, `ends_at` (optional), `location_text` (120 characters or fewer)
  - `partiful_url` (optional), `sponsor_name` (optional and hidden)
  - `status` (`active` or `cancelled`), created and updated timestamps
  - Add a database index on (`neighborhood`, `category`, `starts_at`). Later features will count events by category per neighborhood.
- **Going:** event, user, created timestamp. One per user per event, enforced with a unique constraint. Undoing "I'm going" deletes the row. This is the only hard delete, and it removes no history worth keeping.
- **EventReport:** event, reporter, reason (short text), created timestamp. Registered in Django admin.
- **TranslationCache:** event, field, target language, text, created timestamp. See `LANGUAGE.md` Part B.

## API (JSON, token required)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/config` | Already exists. It now returns the category groups and keys, which the event picker and the interests picker both use. The separate interests list is removed. |
| PATCH | `/api/profile/me` | Already exists. `interests` must now be valid category keys (8 or fewer, no `other`). Error codes: `invalid_interest`, `too_many_interests`. |
| GET | `/api/events?group=&for_you=` | Upcoming active and cancelled events in the caller's neighborhood, soonest first. Can be filtered by group key, or with `for_you=true` to show only events whose category is in the caller's interests. Each event includes `matches_interests` (true or false). |
| GET | `/api/events/{id}` | Event detail with the going count and whether the caller is going. |
| POST | `/api/events` | Create an event in the caller's neighborhood. |
| PATCH | `/api/events/{id}` | Edit an event (organizer only). |
| POST | `/api/events/{id}/cancel` | Cancel an event (organizer only). |
| PUT / DELETE | `/api/events/{id}/going` | Mark or unmark "I'm going." |
| POST | `/api/events/{id}/report` | Report an event. |
| POST | `/api/events/partiful-preview` | Takes `{url}` and returns `{title, suggested_category}`, or an empty result. |
| POST | `/api/events/{id}/translate` | Takes `{target}` and returns the translated title and description. See `LANGUAGE.md` Part B. |

Members of other neighborhoods get a 404 for events outside their own neighborhood, so the API doesn't reveal that the event exists.

Errors return codes, not sentences, as in `LANGUAGE.md`. Examples: `start_in_past`, `end_before_start`, `invalid_partiful_url`, `invalid_category`, `other_needs_text`, `daily_limit`, `event_cancelled` and `event_past`.

## Validation rules

- On create, `starts_at` must be in the future. If `ends_at` is set, it must be after `starts_at`.
- An event that has already started can't be moved by an edit.
- `category` must be a known key. If it is `other`, `category_other` is required. For any other category, `category_other` is cleared.
- `partiful_url` must use `https` with the host `partiful.com` or `www.partiful.com`. Anything else is rejected with `invalid_partiful_url`.
- "I'm going" is rejected on cancelled or past events.
- A user can create at most 10 events per day, as a simple guard against abuse.
- The mobile API never accepts `sponsor_name` in this milestone.

## Partiful prefill (backend only)

Fetching a URL from the server is a security risk if it's done carelessly, so:

- Only fetch allowlisted hosts (`partiful.com` and `www.partiful.com`), and only over `https`.
- Don't follow redirects to any other host. Use a 3-second timeout and stop reading after 500 KB.
- Read only the `og:title` meta tag. Don't store or re-host images.
- **Category suggestion:** match words in the title against the category search hints in both languages. The first match is the suggestion. If nothing matches, there is no suggestion. The organizer can always change it. Use simple keyword matching. Do not use AI or an external service.
- If anything fails, return an empty result, and the organizer just types the details.
- Tests mock the network and never call Partiful.

## The flow (mobile screens)

Add a bottom tab bar with **Events** and **Profile**. More tabs come in later milestones.

1. **Events tab**
   - The neighborhood name is at the top, with a "Post an event" button.
   - Below it is a row of group filter chips: All, Celebrate, Buy & Swap, Entertainment, Get Active, Community, Learn & Connect.
   - Then the upcoming events, as cards. Each card shows:
     - the date block (`OCT / 24` in English, `24 / OCT` in Spanish)
     - a category chip
     - the title
     - the time and meeting spot
     - "12 neighbors going"
   - Cancelled events show a "Cancelled" label.
   - Empty state: "No events yet. Post the first one."
2. **Event detail**
   - The category, title, date and time, meeting spot, description (if any) and the organizer's display name.
   - The **I'm going** button and the going count.
   - "Open in Partiful" when a link exists.
   - "Ver en español" or "See in English" when there's no version in the reader's language.
   - A small "Report" action.
   - The organizer also sees Edit and Cancel.
3. **Post an event**, a short guided flow:
   1. **What kind of event?** Six large group tiles, each with an icon and a label. A search box sits above them. Tapping a tile shows its categories, with "Other" at the bottom. Choosing "Other" asks for a short description.
   2. **Got a Partiful link?** This step is optional. Pasting a link prefills the title and may suggest a category. If the suggestion differs from the category already chosen, show it as a one-tap option rather than overwriting the choice.
   3. **Details**
      - The fields are title, date, start time, an optional end time, the meeting spot and an optional description.
      - The meeting spot has a hint: "Neighbors will see this. For a block party, a block or cross street is enough."
      - There is an optional "Add Spanish version" or "Add English version" link, which shows the other-language fields.
   4. After posting, land on the new event's detail screen.
4. **Edit** uses the same Details screen. The category can be changed.
5. **Interests (Profile setup and Edit profile)**
   - This replaces Milestone 1's five fixed options with the same group tiles and categories as the event picker.
   - Build the picker once and reuse it. It has two modes: choose one category (events) and choose several (interests).
   - Screen title: "What are you into? / ¿Qué te interesa?" Subtitle: "Pick up to 8. We'll point out events you might like."
   - All six groups are shown as expandable sections. Tapping a category toggles it, and selected categories show as filled chips. A counter shows "3 of 8".
   - The same search box finds categories in either language.
   - Interests stay optional: a "Skip for now" link is always visible. The member can finish setup with none.
   - The Profile screen shows the chosen interests as category chips with their group colors.
6. **"For you" on the Events tab**
   - Event cards in the member's interests show a small "For you / Para ti" tag.
   - Add a **For you** chip at the start of the filter row, before "All".
   - If the member has no interests, the chip shows "Pick interests to see events for you", which opens the interests picker.

**Design:** follow `DESIGN.md`. That means the midnight-purple glow style, glass cards and Outfit type. The group tiles use the accent colors from `DESIGN.md`, with one accent per group. Category chips use the group's accent at low opacity.
- Touch targets must be at least 44 pt.
- Screens must respect the safe area.
- Use the native date and time pickers.
- Spanish labels must wrap rather than be cut off.

## Privacy and safety

- The app never shows who is going. It shows only the count. A member sees only whether they themselves are going.
- Names shown on events are display names only (first name and last initial), as in Milestone 1.
- Don't log event locations or descriptions at info level.
- Cancelled events keep their going records, which are needed later for history. Events are never hard-deleted.
- **Deleted accounts** (see `SETTINGS.md`): when a member deletes their account, upcoming events they organized are cancelled, their past events show "Former neighbor / Exvecino" in place of their name, and their "I'm going" records are removed. Add a test for this.
- Translation requests send only the event's title and description to the provider. Nothing about members is sent.

## Tests

**Backend** (one command):
- Creating an event:
  - Valid input succeeds.
  - These are rejected with the right codes: a past start time, a bad end time, fields over their length limits, a non-Partiful URL, an unknown category, and `other` with no write-in.
- The first event sets the creator's role to `organizer`.
- Only the organizer can edit or cancel. Anyone else gets a 403.
- Members of another neighborhood get a 404 on the list, detail, going, report and translate endpoints.
- "I'm going":
  - Marking, unmarking and one-per-user work.
  - It is rejected on cancelled or past events.
  - The count is correct.
- The event list includes only the caller's neighborhood and only upcoming events, soonest first. The group filter works.
- Interests:
  - `PATCH /api/profile/me` accepts valid category keys.
  - It rejects unknown keys, `other`, duplicates and more than 8, returning the right codes.
- The data migration converts the five Milestone 1 interest keys correctly and drops unknown ones.
- `for_you=true` returns only events in the caller's interests. `matches_interests` is correct.
- `/api/config` returns every group and category, and every key has English and Spanish labels in the mobile language files. The check is a shared test or script.
- The daily limit on creating events is enforced.
- `sponsor_name` can't be set or read through the API.
- Partiful preview:
  - An allowlisted URL returns the mocked title.
  - A title containing "potluck" or "limpieza" suggests the matching category.
  - Other hosts, plain http, redirects to other hosts, timeouts and oversized pages return an empty result.
  - No real network calls are made.
- Translate uses a fake translator, caches its result, and clears the cache after an edit.
- Time zones: an event created at 6:00 PM Denver time is stored as the correct UTC time and returned as 6:00 PM Denver time.
- Milestone 1's tests still pass.

**Mobile** (one command):
- The Events tab renders the list, the empty state, a cancelled label and the group filter, using a mocked API.
- In the category picker:
  - Tiles open their categories.
  - Search finds "limpieza" and "trivia".
  - "Other" requires text.
- The Partiful step prefills the title. A suggested category appears as an option and doesn't overwrite the choice.
- The "I'm going" button toggles and updates the count.
- The interests picker:
  - It shows every group and category from the mocked config.
  - It allows up to 8 picks and blocks a 9th with a message.
  - It hides "Other".
  - Search finds categories in both languages.
  - "Skip for now" works.
- The Profile screen shows interest chips.
- "For you" tags appear only on matching events. The "For you" filter works, and so does its empty state.
- The organizer sees Edit and Cancel. Other members don't.
- The report action submits and shows a confirmation.
- Every screen renders in Spanish with no missing keys.

**Manual check on a real phone** (add to the README):
1. Post an event in Spanish from a Partiful link.
2. From a second account in the same neighborhood, set to English, see it, use "See in English" and tap "I'm going."
3. Confirm that a third account in another neighborhood can't see it.
4. Edit the event, then cancel it.

## How to work

- Build in small steps, in this order:
  1. Category list and config
  2. Models and migrations, including the interests data migration
  3. Create, list and detail API
  4. "I'm going" API, plus interest validation and `for_you`
  5. Edit and cancel
  6. Report
  7. Partiful preview and suggestion
  8. Translate
  9. Get the backend tests green
  10. Events tab and filters
  11. Category picker
  12. Post flow
  13. Event detail and "I'm going"
  14. Interests picker (reusing the category picker) in Profile setup and Edit profile
  15. "For you" tags and filter
  16. Mobile tests
- Run the tests after each step. Commit after each green step with a clear message.
- Update the README with anything new a beginner needs, for example how to create a second test account.
- If something in this document is unclear or conflicts with Milestone 1, `LANGUAGE.md` or `DESIGN.md`, ask rather than guess.

## Open items for the owner (not for Claude Code to decide)

- **Attendance vs. "I'm going":** for badges, is "I'm going" enough, or do we want a check-in at the event? Decide before the badges milestone.
- **Showing who's going:** decide whether neighbors should eventually see each other's names on an event. It helps people meet, but it is less private.
- **Spanish labels:** the neighborhood reviewer checks the category and group names along with the rest of `es.json`.
- **Translation provider:** Google Cloud Translation or DeepL (see `LANGUAGE.md`).
- **Public events:** when events become visible to other neighborhoods (co-hosting, Phase 2).
- **Reminders:** text or push reminders before events, once SMS or notifications exist.
- **Moderation:** who reviews reports once there are real users.
