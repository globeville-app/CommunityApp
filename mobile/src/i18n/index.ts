/**
 * Translations (docs/LANGUAGE.md). Every word the app shows lives in a JSON
 * file here, grouped by screen. To add a language: add its file and one line
 * to RESOURCES and LANGUAGE_NAMES.
 *
 * Screens never read the language from storage or the phone. They use
 * useTranslation() for text and useLanguage() (../language.tsx) for the
 * current choice.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import es from "./es.json";

const RESOURCES = { en, es };

export type Language = keyof typeof RESOURCES;
export const LANGUAGES = Object.keys(RESOURCES) as Language[];
export const DEFAULT_LANGUAGE: Language = "en";

/** Each language's name in its own language. Never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", es: "Español" };

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as string[]).includes(value);
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(RESOURCES).map(([lang, strings]) => [lang, { translation: strings }])),
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false }, // React already escapes
  initAsync: false, // the strings are bundled, so start right away
  returnNull: false,
});

export default i18n;
