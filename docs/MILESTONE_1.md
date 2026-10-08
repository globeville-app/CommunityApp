# Milestone 1: Join — address in, neighborhood out, profile saved

**App name:** Globeville. The logo is always lowercase, "globeville" (see `design/BRAND.md`); in sentences write "Globeville". Renamed from the working name Kinward on 2026-10-08; lives in ONE shared config file, see below.
**Scope:** this milestone only. Do not build the rest of the app.

## Context

Globeville is a localized social network of communities, launching in Denver, delivered as a **mobile app** (iPhone and Android). A person types their address, we match it to one of Denver's official neighborhoods, link their profile to that neighborhood, and they set up a profile. This milestone builds only that join flow, end to end, with tests.

The product owner is learning Python. Prefer clear, conventional code over clever code, and explain non-obvious decisions in short comments or in your summary.

## Architecture

Two parts in one repository:

```
(repository root)
  shared/app_config.json   # the one place the app name lives
  backend/                 # Python API: auth, geocoding, matching, profiles
  mobile/                  # Expo (React Native, TypeScript) app
```

- **Mobile app:** Expo with TypeScript and Expo Router. One codebase for iOS and Android. Developed and tested on a real phone through Expo Go; no app-store builds in this milestone.
- **Backend:** Python, Django + Django REST Framework, SQLite for now. The app talks to it over a JSON API. All matching logic lives here.
- In development the backend runs on the owner's computer and the phone reaches it over the same Wi-Fi. The API base URL is a setting in the mobile config, never hard-coded in screens.

## Done when

1. On a phone (via Expo Go), a person can create an account with email and password and stay logged in.
2. They type a Denver address and see which neighborhood it falls in.
3. If the neighborhood has local aliases (e.g. Highland / LoHi), they pick the name they use.
4. They set up a profile: display name, optional photo, optional interests.
5. They land on a profile screen showing their name and neighborhood.
6. The street address is never written to the database, logs, files, or the phone's storage.
7. Backend and mobile tests pass, each with one command.

## Out of scope (do NOT build)

Media board, events, badges, community profiles, alumni, "Arriving soon" for movers, text blasts, payments, Partiful/GoFundMe, phone login, push notifications, App Store / Play Store builds, production hosting. Leave clean seams for them; don't stub them out.

## Decisions (fixed for this milestone)

| Topic | Decision |
| --- | --- |
| Platform | Native mobile app via Expo (iOS + Android). No website. |
| Backend language | Python |
| App name | `shared/app_config.json` → `{"app_name": "Globeville"}`. The backend settings and the Expo `app.config.ts` both read this file. Never hard-code the name anywhere else. |
| Login | Email + password for v1. Backend issues a token; the app stores it in `expo-secure-store`. Phone login is v2 — keep auth isolated so it can be added later. |
| Address | Never stored, on the server or the phone. Geocode in memory, find the neighborhood, keep only the neighborhood ID. |
| Geography | Denver proper only: the City and County of Denver's official Statistical Neighborhoods. Suburbs are out. |
| Geocoding | Free services only, called from the backend (see Geocoding). |
| Age | No minimum age; do not ask for a birthdate. (See Open items.) |
| Movers / alumni | Not in this milestone. |

## Backend stack

- **Django + Django REST Framework**, SQLite, token authentication.
- **shapely** for point-in-polygon. 78 polygons don't need PostGIS yet.
- **httpx** (or requests) for the geocoder call, with a timeout.
- **Pillow** to validate photos and strip EXIF.

## Mobile stack

- **Expo** (latest stable SDK), TypeScript, **Expo Router** for screens.
- `expo-secure-store` for the login token, `expo-image-picker` for photos.
- **Jest + React Native Testing Library** for screen tests with a mocked API.

Ask before adding any other dependency on either side.

## API (JSON)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | email + password → token |
| POST | `/api/auth/login` | email + password → token |
| POST | `/api/auth/logout` | deletes the token on the server |
| POST | `/api/join/match` | `{address}` → `{neighborhood_id, name, aliases[]}` or a clear error. The address is never echoed back. The server remembers the matched neighborhood for this user. |
| PUT | `/api/profile` | first name, last name, alias (optional), interests (optional). The neighborhood always comes from the user's last server-side match, never from the app. |
| POST | `/api/profile/photo` | multipart image upload |
| GET | `/api/profile/me` | the signed-in user's profile, or 404 `profile_not_found` if they haven't finished joining |
| GET | `/api/config` | app name and the fixed interests list |

Every endpoint except signup, login and config requires the token. `/api/join/match` is rate-limited per user.

## Neighborhood data

- Source: the City and County of Denver's official **Statistical Neighborhoods** boundary layer from Denver's open data (the city's Open Data Catalog / ArcGIS org). Download it once as GeoJSON in WGS84 (EPSG:4326).
- Commit it to `backend/data/denver_statistical_neighborhoods.geojson`, with a `backend/data/SOURCE.md` noting the URL, download date and license.
- Expect 78 neighborhoods. A test checks the count and that every feature has a name and a valid polygon.
- If you cannot reach the site from your environment, stop and ask the owner to download the file. Do not substitute another dataset.
- Aliases go in `backend/data/neighborhood_aliases.json`: `{ "LoHi": ["Highland"] }`. An alias may map to more than one neighborhood. Seed only LoHi; the owner will add more.

## Geocoding (backend only)

- Primary: **US Census Geocoder**, free, no API key, `GET https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=...&benchmark=Public_AR_Current&format=json`. Coordinates are at `result.addressMatches[0].coordinates` (`x` = longitude, `y` = latitude).
- Put geocoding behind one small interface (e.g. `geocode(address) -> (lat, lon) | None`) so the provider can change later.
- Optional fallback: OpenStreetMap **Nominatim**, only if you follow its policy: at most 1 request/second, a real User-Agent identifying the app, attribution, and **no autocomplete**.
- No address autocomplete in v1 (neither free option allows it well).
- Timeouts and friendly errors when the service is down. Tests never call the real network; mock the geocoder.

## The flow (mobile screens)

1. **Welcome → Sign up / Log in:** email + password. Token saved securely; reopening the app skips straight to where the user left off: with a token, the app calls `/api/profile/me`; `profile_not_found` → Address screen, otherwise → Profile. (Closing the app between Match and Profile setup means re-entering the address, because it is never saved.)
2. **Address:** one text field. On submit the app calls `/api/join/match`. The field is cleared after a successful match.
3. **Match:** "Your neighborhood: Highland." If aliases exist, a choice between them. Buttons: "Join Highland" / "Edit address."
4. **Profile setup:** first name and last name; only the last initial is stored and the display name is shown as "Ana R."; optional photo, optional interests from the list served by `/api/config`: Block parties, Food drives, Cleanups, Live music, Gardening.
5. **Profile:** photo, display name, neighborhood (with chosen alias), interests.

Design reference: clean white UI, one typeface, near-black primary buttons, green accent `#1D6B52`, touch targets ≥ 44 pt, safe-area aware. Keep styling minimal; function first.

## Data model (backend)

- **User:** Django auth user, email as username.
- **Neighborhood:** id, official name, source version. Loaded from the GeoJSON.
- **NeighborhoodMatch:** user, neighborhood, matched date — the latest server-side match; no address.
- **Profile:** user, first name, last initial (display name = both), photo (optional), interests (optional), neighborhood, chosen alias (optional), joined date.
- No field anywhere for street address, coordinates, or raw geocoder responses.

## Privacy rules (enforce in code AND tests)

- **Server:** the address and coordinates exist only in memory during the match request. Never log them, and scrub them from error messages, exception handlers and DRF error responses.
- **Phone:** never write the address to secure store, AsyncStorage, files or app state that survives the screen. Clear the text field after a successful match. No analytics or crash-reporting SDKs in this milestone.
- **Photos:** strip EXIF on the server (it can contain GPS location) and test it. On the phone, `exif: false` only stops the picker returning EXIF to the app — it does not clean the file — so the server is the real guard. The picker is set to hand back JPEG so iPhone HEIC photos aren't rejected. JPEG/PNG only, max 5 MB, stored under a random filename.

## Edge cases to handle

- Address outside Denver city limits, including suburbs with "Denver" mailing addresses (Aurora, Lakewood, Englewood): "Globeville is only in the City and County of Denver for now."
- Geocoder finds no match: "We couldn't find that address. Check the spelling and try again."
- Geocoder down or slow: friendly error, no crash; the app shows a retry.
- Phone offline or backend unreachable: clear message, no crash.
- Point exactly on a boundary: deterministic rule (first match by neighborhood ID), covered by a test.
- Apartment/unit numbers: allowed in input; they don't affect the match.

## Tests

**Backend** (one command, e.g. `python manage.py test`):
- Neighborhood data loads: 78 features, all named, all valid polygons.
- Known points land in the right neighborhood (3–5 points well inside different neighborhoods, taken from the data itself).
- A point outside Denver returns "outside Denver."
- Boundary rule is deterministic.
- Alias lookup: LoHi → Highland.
- Geocoder client: success, no match, timeout — all mocked.
- API flow: signup → login → match → profile → profile/me; endpoints reject missing tokens.
- **Address is never stored:** after the full API flow, search every table and the captured log output for the test address and coordinates; expect zero hits. The match response must not contain the address.
- Photo upload: wrong type rejected, oversized rejected, EXIF stripped.

**Mobile** (one command, e.g. `npm test`):
- Each screen renders and moves to the next with a mocked API.
- Address field is empty after a successful match, and nothing address-related is written to storage (mock the storage modules and assert).
- Error states render: outside Denver, no match, network error.

**Both:** the app name (read from `shared/app_config.json`, case-sensitive) appears nowhere in `backend/` or `mobile/` code. The check skips `node_modules/`, Markdown, lockfiles and data files.

**Manual check on a real phone** (document in the README): sign up, join, set up a profile, close and reopen the app, still logged in.

## How to work

- Build in small steps, in this order: backend data loading + point-in-polygon → geocoder client → auth API → match API → profile API → backend privacy tests → Expo app skeleton + config → auth screens → address and match screens → profile setup and profile screens → mobile tests.
- Run the tests after each step. Commit after each green step with a clear message.
- Include a `README.md` a beginner can follow: install Python and Node, run the backend, find the computer's local IP, set it as the API base URL, open the app in Expo Go.
- If something in this document is unclear or conflicts, ask rather than guess.

## Amendments (agreed before building)

1. The neighborhood comes from the server-side match, never from the app (`PUT /api/profile` has no `neighborhood_id`).
2. EXIF is stripped on the server; `exif: false` alone does not clean files.
3. The photo picker returns JPEG so iPhone HEIC photos work.
4. "Pick up where they left off" rule defined in the flow above.
5. `POST /api/auth/logout` added.
Also: the name inputs are first + last name, the name check is case-sensitive, there's a rate limit on matching, and the folders are at the repo root.

## Open items for the owner (not for Claude Code to decide)

- **No minimum age:** collecting emails from children under 13 can bring US COPPA obligations, and the app stores have their own age-rating rules. Worth a check with a lawyer before real users sign up.
- **Email verification and password reset:** not in this milestone; needed before real users.
- **App store publishing:** Apple Developer Program and Google Play accounts, privacy labels and review come later.
- **Hosting:** the backend needs a real server before anyone outside your Wi-Fi can use it.
- **More aliases** beyond LoHi.
- **Final app name:** change only `shared/app_config.json` when decided.
