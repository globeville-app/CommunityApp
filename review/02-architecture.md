# 02 – Architecture (Step 2)

This step asks: is the backend a good server for iPhone and Android apps
that will be in people's pockets for years? It only **proposes** changes.
Nothing has been changed.

Each finding has a **severity**:
- **high**: fix before real users.
- **medium**: fix soon after launch, or before the app grows.
- **low**: nice to have.

## Summary in plain language

The overall shape is sound and typical for a small Django app:
- one server
- one Postgres database
- a scheduled job every 15 minutes for reminders
- photos in DigitalOcean Spaces

Errors are short codes the app translates, which suits a two-language app.
The database has the right "only one of these" rules, such as one "I'm going"
per person per event, and all 19 migrations are ordinary Django migrations
that run automatically before each deploy.

The weak spots are mostly about **logging in on phones**, and about what
happens **after the first app version is in the stores**:

1. **No "forgot password"** (and no email check). A member who forgets their
   password is locked out for good. `MILESTONE_1.md:176` itself says this is
   "needed before real users". **high**
2. **One login token per member, shared by all their devices, that never
   expires.** Logging out on one phone logs out every phone. A stolen token
   works forever, until that member logs out. **medium**
3. **No API version and no "please update the app" switch.** Once phones
   have the app installed, any change to a reply's shape can break old copies
   that people haven't updated. **high**, because it's cheap now and hard later.
4. **The "slow down" reply loses its "try again in N seconds" header.** The
   app can't tell when to retry. **low** (verified, see A4).
5. **Rate limits are counted per server process, not shared** (from Step 1,
   G1). **medium**

## Findings

### A1. Password reset and email verification are missing — high

- **What:** the only account endpoints are signup, login, logout and delete
  (`backend/accounts/urls.py`, `backend/accounts/account_urls.py`). There is
  no way to reset a password, change it, or change the email. Email
  addresses are never confirmed.
- **Why it matters:** forgetting a password is the most common support
  request in any app. Right now the only fix is staff editing the database
  by hand. Unconfirmed emails also mean someone can sign up with another
  person's address, and problem-report replies can go to the wrong person.
- **Proposal:** add the standard Django flow: "send me a reset link" →
  email with a one-time link → set a new password, which also logs out
  every device. It's rate-limited like login. Email confirmation can follow
  the same pattern. This needs the production email service (Postmark) to
  be set up, which is an owner action.

### A2. Login tokens: one per member, never expire — medium

- **What:** login uses DRF's built-in token (`Token.objects.get_or_create`,
  `backend/accounts/views.py:47`). A member has exactly one token. Every
  device they log in on gets that same token. It has no expiry date and no
  refresh step. Logout deletes it (`backend/accounts/views.py:65`), which
  logs out all of that member's devices at once.
- **Why it matters:** a member with a phone and a tablet gets logged out of
  both when they log out of one. A token copied off a lost phone keeps
  working until the member logs out somewhere else, and nobody can see
  which devices are logged in. The phone does keep the token in secure
  storage, which is good.
- **What the app does on "logged out elsewhere":** it checks for a 401
  reply when it starts (`mobile/src/app/index.tsx:39`). I did not check
  what happens when a 401 arrives in the middle of a session.
- **Proposal (in order of value):**
  1. One token per device: a small `DeviceToken` table with token, device
     name, created and last used. Logout deletes only that device's token.
     Password reset deletes all of them. Tools like `django-rest-knox` do
     this out of the box.
  2. Expire tokens unused for, say, 90 days.
  3. Short-lived access tokens with refresh tokens (JWT) are **not**
     needed at this size. They add complexity without much gain for a
     first-party app.

### A3. No API versioning, no minimum app version — high

- **What:** every route is `/api/...` with no version
  (`backend/config/urls.py:23-38`). `/api/config` doesn't tell the app the
  oldest version still supported (`backend/config/views.py`).
- **Why it matters:** with a website, everyone gets the new version at
  once. With phone apps, people keep old versions for months. If the server
  renames a field, old apps break and you can't force them to update.
- **Proposal:**
  - Add `min_app_version`, and optionally `latest_app_version`, to
    `/api/config`. The app shows a "please update" screen when it's too
    old. This is cheap and the most valuable step.
  - The app already sends its version with problem reports. Sending it as a
    header on every request would let the server see which versions are
    still in use.
  - A URL prefix (`/api/v1/`) is optional. The rule "only ever add fields,
    never rename or remove one without a new version" matters more than
    the prefix. Write that rule in the README.

### A4. Throttled replies drop the `Retry-After` header — low (verified)

- **What:** the error handler builds a fresh reply and copies only the
  status code (`backend/config/errors.py:49-58`). I ran the handler on a
  "throttled, wait 30 s" error. The reply was `429 {"code": "throttled"}`
  with no `Retry-After` header.
- **Proposal:** copy the original response's headers into the new reply.
  That's a one-line fix with a test.

### A5. Error format — good, with two gaps — low

- **Good:** every API error is `{"code": ...}`, plus `fields` for form
  errors (`backend/config/errors.py`). The app maps codes to text in both
  languages and has a fallback for unknown codes.
- **Gap 1:** server crashes (500) and unknown URLs (404 outside DRF) come
  back as Django's HTML pages in production, not as JSON
  (`backend/config/urls.py` has no `handler500` or `handler404`). The app
  copes, because a non-JSON reply becomes a generic error (`mobile/src/api.ts`).
  A JSON `{"code": "server_error"}` would be cleaner.
- **Gap 2:** "already done" replies use 409 (for example
  `already_recorded`, `backend/badges/engine.py:256`). This is correct, but
  if the phone retries after a lost reply, it shows an error for something
  that actually worked. The app should treat 409 `already_recorded` as
  success. I did not check the app for this.

### A6. Pagination — none, acceptable at launch — low

- **What:** no list endpoint is paginated. The events list returns every
  upcoming event in the member's neighborhood (`backend/events/views.py:177-200`).
  The organization list, celebrations and collect cards are also unpaged.
- **Why it's OK for now:** each list is limited by nature to one
  neighborhood's upcoming events, a few organizations, or cards from the
  last 7 days. At Denver neighborhood scale that's tens of items.
- **Proposal:** when it's needed, add `?limit=` / cursor paging to the
  events list first. It would be a new optional parameter, so old apps keep
  working (see A3). The events list also filters "ended" events in Python
  after the database query (`views.py:198`). That's fine at this size.

### A7. Offline and retry friendliness — medium

- **Good:**
  - "I'm going" and follow use PUT/DELETE, which can safely be sent twice
    (`backend/events/views.py:288-298`,
    `backend/organizations/views.py:356-362`).
  - Push-token registration is a POST, but it updates the existing row, so
    sending it twice is harmless (`backend/notifications/views.py:29`).
  - Collect and check-in refuse duplicates (one attendance per person per
    event, enforced by the database).
  - The reminder job is safe to run twice.
  - The app has request timeouts (`mobile/src/api.ts:60-75`).
- **Gap:** creating an event (`POST /api/events`) and sending a problem
  report have no protection against a double send. A slow network plus a
  second tap creates two events.
- **Proposal:** accept an optional `Idempotency-Key` header (a random id
  the app makes per form) on those two POSTs. The server remembers it for a
  day and returns the first result again. The app also needs a matching
  change.

### A8. Push notifications — medium

- **Good:**
  - Expo push with one token per device (`backend/notifications/models.py:13-20`).
  - Each reminder row is claimed with a single conditional UPDATE, so the
    same reminder can't be sent twice (`backend/notifications/sending.py:36-38`).
  - Texts are in the member's language and never include the meeting spot.
- **Gaps:**
  - Expo receipts are never fetched, so dead tokens pile up (Step 1, G6).
  - Sending happens inside the 15-minute job and inside the cancel request
    itself (`event_cancelled` sends right away). A slow Expo response
    therefore slows down the organizer's "Cancel" tap. That's fine at a few
    dozen attendees, but worth moving to the job later.
  - A failed send is retried by the next run, but there's no limit on how
    many times, and no alert when sending keeps failing (see Step 5).
- **Proposal:** add a second small job that fetches receipts and deletes
  `DeviceNotRegistered` tokens. Later, send cancellation notices from the
  job instead of during the request.

### A9. Scalability basics — fine for launch, with known hot spots — low

- **Setup:** 2 gunicorn processes (`Dockerfile:24`), database connections
  reused for 10 minutes with health checks (`backend/config/settings.py:143-144`),
  and a health check at `/api/config` (`.do/app.yaml:18-19`). This easily
  handles a few thousand members.
- **Hot spots (all known, in `docs/REVIEWERS_GUIDE.md`):**
  - the badge engine recounts a member's badges from all their attendance
    on every collect (`backend/badges/engine.py:118-155`);
  - the owner stats page and community badges are computed on every load,
    with no caching;
  - the rate-limit counters are per process (G1).
- **Signed photo links change on every request** (they expire after 1 hour,
  `backend/config/settings.py:196-197`), so the phones can't cache photos
  and download them again each time. That's minor data use. A longer expiry
  plus a stable cache key in the app would fix it.
- **Proposal:**
  - move the cache to a shared store, either Redis or Django's database
    cache, which fixes G1 and allows caching the stats;
  - leave the badge engine as is until there are thousands of attendance
    rows per member.

### A10. Database schema and migrations — good — low

- **Good:**
  - real database constraints back the business rules: one attendance per
    event, one "going", one reminder per kind, one follow, one admin row,
    and exactly one owner (member or organization) per badge
    (`backend/*/models.py`);
  - there's an index for the events list and one for due reminders;
  - migrations run as a separate pre-deploy job (`.do/app.yaml`);
  - data migrations exist for the interest change and the reminder backfill;
  - the whole suite also passes on Postgres 16, not only SQLite.
- **Gaps:**
  - SQLite in development vs Postgres in production means some problems,
    like row locking, only show up on Postgres. One test is skipped on
    SQLite. CI should run on Postgres (Step 5).
  - Event hard-delete in admin (Step 1, G3) and the cascades: deleting an
    event removes attendance, which is badge history.
  - No index on `Attendance.user`, beyond the unique (user, event) one,
    which already covers lookups by user. No index on
    `Event.organization`, which Django indexes automatically as a foreign
    key. Both are fine.
- **Proposal:** no schema changes are needed now, apart from the admin
  delete rule (G3).

### A11. Time zones — good — low

All times are stored in UTC and shown in America/Denver
(`backend/config/settings.py:156`). The 5 PM reminder and the "no end
time = midnight" rule use Denver time. That's correct for a Denver-only
app. Expanding to another city would need a time zone per neighborhood.
Not needed now.

## What was not checked

- The phone app's own behavior on 401, 409 and offline (only spot-checked).
- Real load: nothing was load-tested.
- How DigitalOcean actually runs the scheduled job (it has never been deployed).
