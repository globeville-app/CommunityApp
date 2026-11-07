# Standards check: first release

Checked on November 7, 2026, against the `main` branch plus the
`first-release` changes (Milestones 1–4 and 5.1). This is a check by Claude
Code, not a legal opinion or an official store review. Re-run it before
each store submission.

**Legend:** ✅ meets it · 🔧 fixed in this check · ⏳ needs the owner · ⚠️ known, accepted for now

## Apple App Store

| Rule | Status | Where |
| --- | --- | --- |
| Privacy policy linked in the app and the store listing (5.1.1) | 🔧 Drafted; Settings and Sign up link to it | `/privacy`, `shared/app_config.json` |
| Account deletion inside the app (5.1.1(v)) | ✅ | Settings → Delete account |
| User-generated content (1.2): agree to terms with zero tolerance, report, block, act on reports, contact info | 🔧 Terms agreement added to Sign up; **Report member** added (events and organizations already had it); block ✅ | `signup.tsx`, `member/[id].tsx`, `MemberReport` in admin |
| Act on reports within 24 hours (1.2, promised in the terms) | ⏳ Someone checks the admin daily | Django admin → Member / Event / Organization reports |
| Permission explanations, in the app's languages (5.1.1) | 🔧 Spanish iPhone prompts added | `app.config.ts` (`locales`) |
| Location "Always" justified, explained before asking | ✅ | `checkin-offer.tsx` |
| No tracking, so no App Tracking Transparency prompt | ✅ | no ad or analytics SDKs (test: `privacy.test.ts`) |
| Sign in with Apple (4.8) | ✅ Not required: email sign-in only, no third-party logins | |
| App Privacy label | ⏳ Owner submits | `docs/STORE_PRIVACY.md` |
| A working demo account for App Review | ⏳ Create on production | `docs/STORE_PRIVACY.md` |
| Minimum age stated, and age rating | 🔧 13+, confirmed at sign-up; ⏳ owner confirms 13 and answers the questionnaire | `shared/app_config.json` → `legal.minimum_age` |

## Google Play

| Rule | Status | Where |
| --- | --- | --- |
| Privacy policy URL | 🔧 | `/privacy` |
| Account deletion: in the app **and** a web page | 🔧 Web page added | `/delete-account` |
| Data safety form | ⏳ Owner submits | `docs/STORE_PRIVACY.md` |
| Only the permissions the app uses | 🔧 Removed "draw over other apps", broad storage and media access; no location foreground service | `app.config.ts` (`blockedPermissions`), test in `privacy.test.ts` |
| Background location: prominent disclosure before the prompt, mentioning "when the app is closed" | 🔧 Wording updated | `checkin.what_it_does` in `en.json` / `es.json` |
| Background location declaration and video | ⏳ Owner records and submits | `docs/STORE_PRIVACY.md` |
| User-generated content policy: terms, report, block, moderation | 🔧 Same as Apple above | |
| Target API level | ✅ Set by Expo SDK 57 | |

## Privacy and consumer rules

| Rule | Status | Notes |
| --- | --- | --- |
| Privacy policy matches what the code does | 🔧 Written from the code: data, sharing, retention table, rights | Retention matches `accounts/retention.py`; keep them in step |
| Colorado Privacy Act | ✅ Likely below its thresholds (100,000 Colorado consumers a year); the policy honors access, correction, deletion and copy requests anyway, with an appeal | ⏳ legal review |
| Children (COPPA) | 🔧 Not for under-13s; age confirmed at sign-up; delete on report | ⏳ legal review |
| Texting rules (TCPA, carrier rules) | ✅ Off in 5.1. For 5.2: consent recorded, STOP/HELP, quiet hours, no texts without consent | ⏳ legal review and A2P 10DLC before `SMS_LIVE=1` |
| Address never stored or logged | ✅ Tested on every change | `config/tests/test_privacy.py` |
| HTTPS, secure cookies, admin with two-step sign-in | ✅ Tested against production settings | `config/tests/test_production.py` |
| Legal pages filled in (who runs the app, contact, mailing address, effective date) | ⏳ Pages say "Draft" until then | `shared/app_config.json` → `legal` |
| Legal review of the privacy policy and terms | ⏳ Before launch | |

## Security scans

| Scan | Result |
| --- | --- |
| Server libraries (`pip-audit`, also in CI) | ✅ No known vulnerabilities |
| Django production check (`check --deploy`, in CI) | ✅ |
| App libraries (`npm audit --omit=dev`) | ⚠️ 22 findings, none critical. All but one are in build and test tools that run on developers' computers, not in the installed app. The one inside the app: `decode-uri-component` (via expo-router), which can freeze the app on a phone that opens a deliberately malformed link. The fix needs Expo SDK 58; plan that upgrade after launch. |
| `expo-doctor` | ✅ 19 of 21 checks pass; the other 2 need Expo's website, which this sandbox can't reach. Re-run on a normal connection. |

## Re-running this check

```
cd backend && pip-audit -r requirements.txt && python manage.py test
cd mobile && npm audit --omit=dev && npx expo-doctor && npx jest
```
