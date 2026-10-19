# 06 – Skeptic pass (Step 6)

Because the reviewer wrote the code, this pass was done by a **separate,
independent agent**. It was told to try to disprove every serious finding
and to look for anything the earlier steps missed. It changed no files.
I then re-checked its two new high findings myself.

**Result:** none of the findings is a false positive. Two were
overstated. Two new high-severity problems were found.

## Re-verified findings

| Finding | Verdict | Confidence | Final severity | Note |
| --- | --- | --- | --- | --- |
| S1 throttle bypass via `X-Forwarded-For` | confirmed | high | **high** | It only affects signed-out requests: login, signup, signed-out problem reports. Signed-in requests are counted per member. The fix needs the real number of proxies on DigitalOcean, measured at the first deploy. Setting it wrong would put every user in one shared bucket. |
| G1 per-process rate-limit counts | confirmed | high | medium-low | It only matters once S1 is fixed. |
| A1 no password reset or email verification | confirmed | high | **high** | `MILESTONE_1.md:176` says it's "needed before real users", but it's missing from `GO_LIVE.md`'s launch checklist and `RELEASE_CHECKLIST.md`, so it could easily be forgotten. |
| A2 one shared token, no expiry | confirmed | high | medium-low | **Extra:** Django admin's built-in "Tokens" screen lists every member's token. A staff member could copy one and act as that member. |
| A3 no API version or minimum app version | confirmed | high | medium | |
| A4 `Retry-After` dropped | confirmed | high | low | The app doesn't read it anyway. The 401 `WWW-Authenticate` header is dropped too. |
| S2 admin-add by email | confirmed, **worse** | high | **medium** | The reply includes the added person's display name, so it can be used as an "email → name" lookup. It works from a self-made pending organization. On a full organization it looks up the email without adding anyone. |
| S3 no blocking (Apple 1.2) | confirmed | medium | medium | How strictly Apple applies this to an events app with no messaging is uncertain. There's also no "report a member". |
| G2 host credit before the event ends | confirmed | high | medium-low | Cancelling later doesn't take the stage back (stages never go down), and Day One is also decided before the event ends. |
| G3 admin can hard-delete events | confirmed | high | low | Staff only, behind the two-step login. |
| G4 pending → hidden → approved without review | confirmed, **overstated** | high | low | It needs a staff member to act. The real issue is that the earlier status (pending or rejected) is lost. |
| O1/O2 no CI, auto-deploy from `main` | confirmed | high | medium | |
| O8 no crash reporting or alerts | confirmed | high | medium | **Correction:** `docs/STORE_PRIVACY.md:26` promises "no third-party … crash reporting". The Sentry proposal in `05-ops.md` conflicts with that promise. Use DigitalOcean's own alerts and log-based alerts instead, unless the owner changes the promise. |

## New findings

| # | Finding | Severity | Confidence | Evidence |
| --- | --- | --- | --- | --- |
| N1 | **A tiny image file can use hundreds of MB of memory and crash the server.** Uploads are checked for file size (5 MB) but not for pixel count. Pillow only *warns* below 179 million pixels. I reproduced it: a **20 KB** PNG of 13,000 × 13,000 pixels used **369 MB** while being checked. The production server has 512 MB (`.do/app.yaml:16`). The independent agent saw 663 MB with a 493 KB file. It can be sent **without logging in** through the problem report (5 per day, more with S1), and with a login through the profile and organization photos. | **high** | high (reproduced) | `backend/profiles/photos.py:33-43` |
| N2 | **The production health check may fail.** In production the server only accepts the real domain name and redirects plain HTTP to HTTPS. If DigitalOcean's health check calls the container directly (by IP, over HTTP), it gets `400` or `301` instead of `200`, and the deploy fails. This was simulated with production settings, but how DigitalOcean actually calls it can only be confirmed at the first deploy. | **high** (blocks the first deploy) | medium | `backend/config/settings.py:65,70`, `.do/app.yaml:18-19` |
| N3 | **An organizer can cancel an event that has already ended.** Everyone who was going gets a "cancelled" notification for a past event, and their attendance stops counting toward their badges. A host could use this to grief attendees. | medium | high (checked) | `backend/events/views.py:254-265` (no "has ended" check) |
| N4 | **Deleting a member from the Django admin skips all the cleanup that "Delete account" does.** The photo file stays, upcoming events stay live with no organizer, nobody gets notified, and organizations with no admin left stay live. Staff handling a deletion request by email would do exactly this. | medium-low | high | cleanup only in `backend/accounts/views.py:69-156` |
| N5 | **Reminders can keep going to a phone that has been logged out.** Logging out on phone B deletes the shared token, so phone A is logged out too (A2), but phone A's push token isn't removed. It keeps receiving that member's event titles on its lock screen. | medium-low | high | `backend/accounts/views.py:55-65` |
| N6 | **Production falls back to debug mode if `DJANGO_DEBUG` is missing.** The default is "on", which accepts any host name and the development secret key. `.do/app.yaml` sets it everywhere today, but a new job without it would quietly run insecurely. | low-medium | high | `backend/config/settings.py:54` |
| N7 | **Small race conditions:** two signups with the same email at the same moment cause a 500 error instead of `email_taken`, and simultaneous adds can exceed the 5-admin and daily limits. | low | medium | `backend/accounts/serializers.py`, `backend/organizations/views.py:326-328` |
| N8 | **When an organization is hidden because its last admin left, its upcoming events stay live,** and nobody but staff can edit or cancel them. | low | high | `backend/accounts/views.py:142-145` |

## Checked and found clean by the independent pass

- Mass assignment (`sponsor_name`, neighborhood) is blocked.
- The Partiful fetch can't be pointed at other sites.
- Neighborhood scoping is applied on every event route.
- Who is going and who follows is never returned.
- Celebrations are scoped to the caller.
- Screenshots are only served to staff.
- Account deletion cascades as documented.
- All 297 tests passed again.

## What this review still can't tell you

- How DigitalOcean's proxy and health check really behave (S1, N2). This
  can only be confirmed at the first deploy.
- Anything about real phones (push, geofencing, maps).
- The phone app's own code, beyond spot checks (out of scope).
