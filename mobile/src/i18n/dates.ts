/**
 * Dates in the person's language, with the Intl support built into the
 * phone's JavaScript engine (Hermes).
 */
import type { Language } from ".";

/** "Oct 24" in English, "24 oct" in Spanish. */
export function shortDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

/** The two lines of an event date block: "OCT / 24" in English, "24 / OCT" in Spanish. */
export function dateBlock(date: Date, language: Language): [string, string] {
  const month = new Intl.DateTimeFormat(language, { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const day = String(date.getUTCDate());
  return language === "es" ? [day, month] : [month, day];
}
