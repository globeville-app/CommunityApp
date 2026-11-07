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

- [ ] **Privacy policy and terms.** Drafted by Claude Code from the code
      (Nov 7, 2026) at `/privacy`, `/terms` and `/delete-account`, in English
      and Spanish (`backend/web/templates/web/legal/`); the app links to them.
      Still needed: fill in the `legal` section of `shared/app_config.json`
      (who runs the app, contact email, mailing address, effective date;
      the pages say "Draft" until then), confirm the minimum age (13), and
      a legal review. See docs/STANDARDS_CHECK.md.
- [ ] **Problem report emails.** Set `PROBLEM_REPORT_EMAILS` on the server.
- [ ] **Email service.** Choose one (for example Postmark or Amazon SES) and
      set the `EMAIL_*` settings on the server (see the README).
- [ ] **Reply promise.** Decide whether people who report a problem get a
      reply, and how fast.

## Events (Milestone 2)

- [ ] **Translation provider.** Choose Google Cloud Translation or DeepL
      before any event text is sent to a third party, then set
      `TRANSLATOR_CLASS` (see the README).
- [ ] **Spanish category names.** The reviewer also checks `categories`,
      `category_groups`, `category_groups_short` and `category_hints` in
      `es.json`.
- [ ] **Group colors.** DESIGN.md has four accent colors; lavender and peach
      were added for the fifth and sixth groups. Confirm with design.
- [ ] **Moderation.** Decide who reviews event reports in the admin.
- [ ] **Attendance and names.** Decide whether "I'm going" is enough for
      badges, and whether neighbors should ever see who's going.
