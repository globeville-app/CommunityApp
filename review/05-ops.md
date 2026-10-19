# 05 – CI/CD & operations (Step 5)

## Summary in plain language

The deployment is **planned and written down, but has never been run**:
- `Dockerfile`
- the DigitalOcean spec (`.do/app.yaml`)
- the README section "Going live", including a backup-restore drill

The design is reasonable. It has one important trap and two missing safety
nets:

1. **Trap: merging into `main` deploys straight to production, with no
   tests run first.** `deploy_on_push: true` on branch `main`
   (`.do/app.yaml:11-14`). There is no GitHub Actions workflow, so a broken
   merge goes live automatically. **high**
2. **`main` today is only Milestone 1** (see `00-overview.md`). The first
   merge of this branch will be the first real deploy. **Merge when you're
   ready to deploy, not before** (owner action).
3. **Nobody is told when something breaks.** There's no error tracking, no
   uptime alert, and no alert when the reminder job fails. **high** before
   real users.

## Findings

### O1. No CI pipeline — high

- **What:** there's no `.github/workflows/` (or any other CI). Tests run
  only by hand. Nothing checks a pull request before it's merged.
- **Why it matters:** combined with auto-deploy (O2), the only thing
  between a mistake and production is someone remembering to run the tests.
- **Proposal:** one GitHub Actions workflow on every push and pull request
  that runs:
  1. the backend tests on **Postgres 16**, the same as production, so the
     concurrency test runs too;
  2. `manage.py check --deploy` and `makemigrations --check`, which catches
     a model change with no migration;
  3. the app's `npm test`, `tsc --noEmit` and `npm run lint`;
  4. `pip-audit` and, optionally, `npm audit --omit=dev` as a warning.

  Then turn on GitHub branch protection for `main`: "require these checks
  to pass before merging". The branch-protection setting is an owner action.

### O2. Auto-deploy from `main` — high (until O1 exists)

- **What:** the web service deploys on every push to `main`
  (`.do/app.yaml:13-14`). Before each deploy, a job runs `migrate` and
  `load_neighborhoods` (`.do/app.yaml:72-91`). That part is good.
- **Risks:**
  - no test gate (O1);
  - migrations run *before* the new code is live, while the old code is
    still serving. A migration that removes or renames a column breaks the
    old code for a minute. Today's migrations are all additions, so this is
    a rule for the future. Write it in the README: "add first, remove in a
    later release";
  - a migration that fails stops the deploy, and the old version keeps
    running. That's the safe behavior.
- **Proposal:** keep auto-deploy, but only after O1 and branch protection.
  Alternatively, switch `deploy_on_push` off and deploy by pressing a
  button.

### O3. Environments — acceptable by owner decision

- Production runs on DigitalOcean. Development runs locally (SQLite).
  There's no staging. `GO_LIVE.md` §2 decides that "a separate staging
  server isn't needed yet".
- The settings switch cleanly on `DJANGO_DEBUG`, and production refuses to
  start without a real secret key (`backend/config/settings.py:58-80`).
- **Suggestion:** for the beta, a second, cheap DigitalOcean app (staging)
  pointing at a branch such as `staging` would let you try a release on
  real phones before members get it. This is optional.

### O4. Secrets management — OK

- Every secret is an environment variable marked `type: SECRET` in
  DigitalOcean, with `CHANGE_ME` in the repo (`.do/app.yaml`). No secrets
  are in git (Step 3, S8).
- The secret values are copied into three places (web service, migrate job,
  notifications job). When one changes, all three must be updated. The
  DigitalOcean app-level environment variables can hold them once.
- `.dockerignore` keeps the local database, media, `.venv` and `.env` out
  of the image.

### O5. Docker image — OK, two hardening notes — low

- `python:3.13-slim`, pinned requirements, `collectstatic` at build time,
  and gunicorn with 2 workers and a 60-second timeout (`Dockerfile`).
- It runs as **root** (no `USER` line). App Platform isolates containers,
  but a non-root user is standard hardening.
- It has **never been built with Docker**. The steps were run by hand
  (`docs/REVIEWERS_GUIDE.md`, "Known gaps"). CI could run `docker build`
  to prove it works.

### O6. Backups — planned, not yet tested

- Managed Postgres makes a daily backup automatically. The README has a
  restore drill to do once before the beta (`README.md:517-528`).
- `makemigrations --check` reports no missing migrations (run 2026-10-19).
- Photos in Spaces have no separate backup. `GO_LIVE.md` revisits this
  before Phase B. Spaces can keep old versions if "versioning" is switched
  on, which is a cheap safety net (owner action).
- Account deletion and backups: deleted members stay in backups until the
  backups expire. That belongs in the privacy policy (Step 3).

### O7. Logging — OK

- All logs go to the console, which DigitalOcean collects. gunicorn's
  access log is on.
- Privacy-sensitive libraries are kept quiet (Step 3, S9). There's a test
  against production settings (`backend/config/tests/test_production.py`).
- DigitalOcean only keeps runtime logs for a short time. For history,
  forward them to a log service (DigitalOcean supports Papertrail,
  Datadog and others). This is optional at launch.

### O8. Monitoring and alerts — missing — high

- **No error tracking:** a crash (500) leaves only a traceback in the
  DigitalOcean log. Nobody is told.
- **No uptime alert:** DigitalOcean's health check (`/api/config`)
  restarts a broken container, but doesn't tell anyone unless alerts are
  set up in the dashboard.
- **The reminder job:** if `send_due_notifications` fails every 15 minutes,
  reminders silently stop. Nothing watches it.
- **Proposal:**
  1. turn on DigitalOcean's built-in alerts (deploy failed, high CPU or
     memory, app down) for the owner's email. No code needed;
  2. add Sentry, which has a free tier, to the backend for crash reports.
     It's about 5 lines in `settings.py` plus a `SENTRY_DSN` secret. It must
     be set up to **not** send personal data (`send_default_pii=False`)
     and to drop request bodies, so addresses can't leak;
  3. have the reminder job write a "last run OK" timestamp the owner stats
     page shows, or ping a free heartbeat monitor (for example
     Healthchecks.io) after each run.

### O9. Deploy documentation — good

`README.md` "Going live" (from line 461) walks through every step:
buying the domain, Spaces, the app spec, filling in the secrets, setting
up the admin's two-step login, the backup drill and the scheduled job.
`docs/GO_LIVE.md` §6 has the launch checklists.

Gaps:
- the "number of proxies" check for the S1 fix;
- the alerts setup (O8);
- the README step that points to a non-existent "Scheduled notifications"
  admin screen (`README.md:241`, Step 1, G10).

## Actions for the owner (no code)

1. **Don't merge this branch into `main` until you're ready for the first
   deploy.** Merging *is* deploying.
2. After CI exists, **turn on branch protection for `main`** in GitHub:
   Settings → Branches → require status checks.
3. **Turn on DigitalOcean alerts** for your email when the app is created.
4. **Create a Sentry account** (free) when the crash-reporting task is
   done, and add its key as a secret.
5. **Do the backup-restore drill** in `README.md:517` before the beta.
6. Optional: **switch on versioning for the Spaces bucket**, and decide
   whether you want a staging app for the beta.
