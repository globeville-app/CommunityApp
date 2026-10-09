# Release checklist

Items that must be done before real neighbors use the app. Tick each one
with the date and who did it.

## Launch blockers

- [ ] **Spanish review.** A native Spanish speaker from the neighborhood reads
      every line of `mobile/src/i18n/es.json` and checks it on a phone in
      Spanish (every screen, every error). Claude Code wrote the first draft.
      Reviewed by: ______________ on ______________
- [ ] **Tone check.** Neighbors confirm that informal "tú" is right.
      (docs/LANGUAGE.md, open items)

- [ ] **Privacy policy and terms.** Required by the App Store and Play Store.
      They should say home addresses are never stored. Put the links in
      `privacy_url` and `terms_url` in `shared/app_config.json`.
- [ ] **Problem report emails.** Set `PROBLEM_REPORT_EMAILS` on the server.
- [ ] **Email service.** Choose one (for example Postmark or Amazon SES) and
      set the `EMAIL_*` settings on the server (see the README).
- [ ] **Reply promise.** Decide whether people who report a problem get a
      reply, and how fast.

## Before Milestone 2 (events)

- [ ] Choose the translation provider for event text (Google Cloud
      Translation or DeepL), before any event text is sent to a third party.
