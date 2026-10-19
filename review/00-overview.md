# 00 – Overview (Step 0: orientation)

> **Important note about who wrote this review.** This review was produced by
> the same AI coding agent (Claude Code) that wrote the code, in the same
> working session. That is a conflict of interest: an author tends to miss
> its own blind spots. Treat these findings as a careful self-audit, not an
> independent review. A human developer should still check them.

## Git context

- **Current branch:** `claude/community-social-network-v1-x411pw`. The working
  tree was clean when the review started (`git status`: nothing to commit).
- **Repository:** `github.com/globeville-app/CommunityApp` (renamed and moved
  from `indubitably-dubin/CommunityApp-Milestone-1` on 2026-10-19).
- **`main` is outdated.** On GitHub, `main` holds only Milestone 1 (commit
  `14a1ba0`, merged as PR #1). The local `main` branch in this checkout is
  even older (`35a60a0 Initial commit`), so all comparisons below use
  `origin/main`.
- **How this branch differs from main** (`git diff origin/main...HEAD --stat`):
  35 commits, 281 files changed, about 27,200 lines added and 900 removed.
  It contains everything after Milestone 1: Settings & Support, English and
  Spanish, Milestones 2, 3 and 4, the go-live setup (production settings,
  Dockerfile, DigitalOcean spec), the owner stats page, and the docs for all
  of them. In the backend, the new or heavily changed apps are `events`,
  `badges`, `notifications`, `organizations`, `support`, `stats` and
  `accounts`.

## Stack

| Part | Technology |
| --- | --- |
| Backend language | Python 3.12+ (tested here with 3.13.16) |
| Web framework | Django 5.2.18 (long-term support) + Django REST Framework 3.18.3 |
| Auth | DRF `TokenAuthentication` (one token per login; see `backend/accounts/authentication.py`) |
| Database | SQLite in development; PostgreSQL in production via `DATABASE_URL` (`dj-database-url`) |
| File storage | Local folders in development; DigitalOcean Spaces (S3) via `django-storages` in production |
| Server | `gunicorn` behind DigitalOcean App Platform (`Dockerfile`, `.do/app.yaml`) |
| Admin | Django admin at a configurable path, two-step login with `django-otp` |
| Outside services | US Census geocoder (address → coordinates), Expo push service, Partiful (link preview), SMTP email (Postmark planned), optional translation provider (none set) |
| Other libraries | `shapely` (point in polygon), `httpx` (outbound HTTP), `pillow` (photo checks, EXIF removal), `whitenoise` (admin static files) |

The phone app (Expo / React Native, `mobile/`) is out of scope for this
review, except where the backend's design depends on it.

## Backend structure (`backend/`)

Lines of Python, not counting tests and migrations:

| App | Lines | What it does |
| --- | --- | --- |
| `config/` | 496 | settings (dev + production), URL routing, error format, `/api/config` |
| `accounts/` | 342 | signup, login, logout, account deletion, `last_seen_at`, admin two-step setup command |
| `geocoding/` | 113 | calls the Census geocoder; never stores the address |
| `neighborhoods/` | 423 | Denver boundaries (GeoJSON in `backend/data/`), point lookup, local names, `/api/join/match` |
| `profiles/` | 390 | profile, photo upload (EXIF stripped), member settings |
| `events/` | 908 | events, "I'm going", reports, translation, Partiful preview, time rules |
| `badges/` | 1,009 | attendance, badge engine, impact numbers, community badges |
| `notifications/` | 421 | push tokens, reminder scheduling, sending through Expo |
| `organizations/` | 729 | organizations, admins, approval (Django admin), follows |
| `stats/` | 169 | owner stats page inside Django admin |
| `support/` | 277 | problem reports with screenshots, team email |
| tests (all apps) | 3,831 | Django `TestCase` suites per app |

All API routes are declared in `backend/config/urls.py:18-36` and each app's
`urls.py`. There is no `/v1/` (or other version) prefix.

## How to run the backend

From `README.md` §0–2 (`migrate`, `load_neighborhoods` and the tests were run in this session; `runserver` was not):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py load_neighborhoods     # loads Denver's 78 neighborhoods
python manage.py runserver 0.0.0.0:8000
```

No secrets are needed in development (`DJANGO_DEBUG` defaults to on, the
database is a local SQLite file).

## How to run the tests

```bash
cd backend && source .venv/bin/activate
python manage.py test                   # whole backend suite (SQLite)
DATABASE_URL=postgres://... python manage.py test   # same suite on Postgres
```

One test (`badges/tests/test_concurrency.py`) only runs on Postgres; it is
skipped on SQLite. Results are reported in Step 4.

## Scope of this review

Backend only (as requested), plus the deployment files that run it
(`Dockerfile`, `.do/app.yaml`). Requirements come from `docs/MILESTONE_1.md`
to `docs/MILESTONE_4.md`, with `docs/SETTINGS.md`, `docs/LANGUAGE.md`,
`docs/BADGES.md` and `docs/GO_LIVE.md` where the milestones refer to them.
