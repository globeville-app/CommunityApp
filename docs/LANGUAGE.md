# Language: English and Spanish (v1)

Globeville launches in Globeville, a largely Spanish-speaking neighborhood, so English and Spanish are both required at launch. Spanish is not a later add-on.

This file adds requirements to `MILESTONE_1.md` (Part A) and `MILESTONE_2.md` (Part B). Where they conflict, this file wins on anything about language.

## The core rule

**The member picks the language with an in-app toggle, and that choice applies everywhere until they change it.** That means every screen, every app restart, logging in and out, and every text message we send. The phone's language setting is used only once, as a first guess on first launch, and never overrides a choice the member has made.

---

## Part A: Build with Milestone 1

### Done when

1. Every word the app shows is available in English and Spanish, and no visible text is hard-coded in components.
2. An **English | Español** toggle is on the Join screen and in Profile/settings.
3. Switching languages updates the whole app instantly, with no restart, and keeps whatever the person had typed or chosen.
4. The selection survives navigation, closing and reopening the app, signing up, logging out and logging back in.
5. Signed-in members have their language saved on their profile.
6. The backend never sends display sentences. It sends codes, and the app shows them in the selected language.

### Decisions (fixed)

| Topic | Decision |
|---|---|
| Languages | `en` and `es` only. Use US Spanish, informal "tú", and a warm, plain tone. Structure the code so a third language is only a new file. |
| Libraries | `i18next` + `react-i18next` for strings. `expo-localization` only for the first-launch guess. Use `Intl` (built into Hermes) for dates, times and numbers. |
| String files | `mobile/src/i18n/en.json` and `mobile/src/i18n/es.json`. Group keys by screen, for example `join.address_label`, `profile.save_button`, `errors.outside_denver`. |
| Toggle labels | Always "English" and "Español", each written in its own language and never translated. The selected option is highlighted. |
| Storage on the phone | AsyncStorage key `app.language`, value `en` or `es`. This is a preference, not a secret, so it does not go in secure store. |
| Storage on the server | `Profile.language`, either `en` or `es`, required, default `en`. |
| Not translated | The globeville logo, neighborhood names and aliases (for example "Highland" or "LoHi"), and member display names. |

### How the selected language is decided

The app checks these in order and uses the first one that applies:

1. **The member's explicit choice on this phone** (`app.language` is set). This always wins.
2. **The profile language**, after login on a phone with no saved choice. The app copies it into `app.language`.
3. **First launch only:** if the phone's language starts with `es`, use `es`. Otherwise use `en`. Save the result to `app.language` right away so this guess never runs again.

When the choice syncs:

- **Toggled while logged out** (for example on the Join screen): saved on the phone, then written to the profile at signup.
- **Toggled while logged in:** saved on the phone at once, then `PATCH /api/profile/me {language}`. If the request fails, keep the phone value and retry on the next app start. Never undo the member's choice because of a network error.
- **Logging in on a phone that already has a choice:** if the profile language is different, the phone choice wins and gets written to the profile, because it is the most recent thing the person did.
- **Logging out:** keep `app.language`. The next person on a shared phone sees the last language used and can switch.

### Where the toggle appears

- **Join screen:** top right, visible before the person types anything. It must also be reachable from every step of the join flow: address, neighborhood confirmation and profile setup. Put it in the shared header for these screens.
- **Profile/settings:** a "Language / Idioma" row with the same toggle.
- No other screens need it. The choice carries everywhere.

### Implementation rules

- Make one `LanguageProvider` at the app root that owns the current language. All screens read from it, so nothing reads the language directly from storage or the device.
- No visible strings in components. Add an ESLint rule (`eslint-plugin-i18next`, `no-literal-string`) and make it fail the build.
- Dates and times use `Intl.DateTimeFormat` with the current language. Spanish dates read "24 oct". Event date blocks show "OCT / 24" in English and "24 / OCT" in Spanish.
- Spanish text runs about 20–30% longer. Buttons and cards must wrap or grow, not cut text off. Check every screen in Spanish.
- Outfit includes Spanish characters (á é í ó ú ü ñ ¿ ¡). Confirm they render correctly in headings and buttons.
- Accessibility labels are translated too. Screen readers must read them in the selected language.
- When the language changes, set the `lang` on the root view, so web builds and assistive tech pronounce the text correctly.

### Backend changes

- Add `language` to `Profile`, and accept it in signup and in `PATCH /api/profile/me`. Reject any value other than `en` or `es`.
- **Errors are codes, not sentences.** For example `{ "code": "outside_denver" }`, `no_match`, `geocoder_unavailable`, `invalid_credentials` and `email_taken`. The app maps each code to `errors.<code>`. Any code the app doesn't recognize shows `errors.generic`.
- **The interests list in `/api/config` returns keys**, such as `block_parties`, `food_drives`, `cleanups`, `live_music` and `gardening`. The app translates them, and the profile stores the keys. (Milestone 2 replaces this list with the event category keys; see `MILESTONE_2.md`.)
- Django admin can stay in English.

### Tests

**Mobile**
- `en.json` and `es.json` have exactly the same keys. A test fails on any missing or extra key, or any empty value.
- The lint rule finds no literal strings in components.
- Toggling on the Join screen switches the visible text, and the half-typed address stays in the field.
- The choice survives moving between screens, a simulated app restart (re-mounting with the stored value), signup, and logout followed by login.
- On first launch with a Spanish device locale, the app starts in Spanish. Once a choice is saved, changing the device locale does nothing.
- If the profile PATCH fails, the phone keeps the new language and retries.
- Every error code renders in both languages, and an unknown code shows the generic message.

**Backend**
- `language` is saved at signup, updated through PATCH and rejected when invalid.
- Error responses contain codes and no English sentences.
- `/api/config` returns interest keys.

### Translation quality

- Claude Code writes the first draft of `es.json`.
- **A native Spanish speaker from the neighborhood reviews it before launch.** This is a launch blocker. List the file in the release checklist and mark it reviewed.

---

## Part B: Build with Milestone 2 (events)

### Done when

1. Organizers can optionally add a Spanish (or English) version of an event's title and description.
2. Neighbors see the version that matches their selected language whenever one exists.
3. When only one language exists, the event shows a **"Ver en español" / "See in English"** button that machine-translates the text on request.

### Data and API

- Add to `Event`:
  - `language`: the language the organizer wrote in, `en` or `es`. It defaults to the organizer's profile language.
  - `title_alt` and `description_alt`: optional, in the other language, with the same length limits.
- Add `POST /api/events/{id}/translate` → `{title, description, target}`:
  - It goes through a small `Translator` interface. The provider is the owner's decision (see open items).
  - Cache results per event, field and target language. Clear the cache when the event is edited.
  - If translation fails or isn't configured, return a code. The app hides the button and keeps the original text.
- **Mobile:** the event card and detail show the matching version automatically. A translated version is labeled "Traducido automáticamente / Auto-translated", with a link to show the original.
- **Tests:** they use a fake Translator. Never call a real translation service in tests.

### Out of scope

- Translating photo or video captions.
- Translating text messages on the fly.
- Translating neighborhood names.
- Any language beyond `en` and `es`.

---

## Later (text messages)

When mass texts arrive, each member gets the version in their `Profile.language`. Organizers write both versions, or use the translate step before sending. Texts are never sent in only one language to a mixed-language list without the owner choosing that on purpose.

## Open items for the owner

- **Who reviews the Spanish:** name a native speaker from the neighborhood to review `es.json`.
- **Translation provider for Part B:** Google Cloud Translation or DeepL. Both charge by volume, with a low cost at this scale. Decide before Milestone 2, and before any event text is sent to a third party.
- **Tone check:** informal "tú" is the default. Confirm it with neighbors.
