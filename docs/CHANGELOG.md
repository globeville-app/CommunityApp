# Changelog

How versions work (Apple's and Google's format, `MAJOR.MINOR.PATCH`):

- **Patch** (1.0.**1**): bug fixes only.
- **Minor** (1.**1**.0): new features; existing things keep working.
- **Major** (**2**.0.0): a big redesign or a change in how the app works.

The version is set in `mobile/app.config.ts` (`VERSION`) and is what people
see on the App Store and TestFlight. The build number in brackets, e.g.
1.0.1 **(2)**, counts every upload and is raised by EAS automatically.

## 1.0.1: stabilization (bug fixes)

App:
- Profile, organization and problem-report photos upload reliably. They go
  through the phone's native uploader and are shrunk to a small JPEG first.
  If an upload still fails, the message shows the phone's reason in
  brackets.
- Screen changes no longer show two pages on top of each other (Welcome
  under Sign up and Log in, a page under Report a problem, and going Back).
  Each screen now fades in over the glow.
- Hosts no longer see "Report" on their own event.

Server and web:
- Sign-up, "send a new code" and password reset keep working when the
  email service refuses or is down (they used to fail after the account
  was created, so retrying said "email taken").
- The web event and badge pages no longer show "Open in app", which made
  Safari say "address is invalid" on phones without the app. They offer
  the store links instead.

## 1.0.0: first TestFlight build

Milestones 1–4 and 5.1.
