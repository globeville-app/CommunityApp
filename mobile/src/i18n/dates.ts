/**
 * Dates in the person's language, with the Intl support built into the
 * phone's JavaScript engine (Hermes). Event times are always shown in
 * Denver time, whatever time zone the phone is set to.
 */
import type { Language } from ".";

export const EVENT_TIME_ZONE = "America/Denver";

function locale(language: Language) {
  return `${language}-US`;
}

/** "Oct 24" in English, "24 oct" in Spanish. */
export function shortDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(locale(language), { day: "numeric", month: "short", timeZone: EVENT_TIME_ZONE })
    .format(date)
    .replace(".", "");
}

/** The two lines of an event date block: "OCT / 24" in English, "24 / OCT" in Spanish. */
export function dateBlock(date: Date, language: Language): [string, string] {
  const parts = new Intl.DateTimeFormat(locale(language), {
    day: "numeric",
    month: "short",
    timeZone: EVENT_TIME_ZONE,
  }).formatToParts(date);
  const month = (parts.find((p) => p.type === "month")?.value ?? "").replace(".", "").toUpperCase();
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return language === "es" ? [day, month] : [month, day];
}

/** "Sat, Oct 24" / "sáb, 24 oct". */
export function weekdayDate(date: Date, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: EVENT_TIME_ZONE,
  })
    .format(date)
    .replace(/\./g, "");
}

/** "6:00 PM" / "6:00 p.m." in Denver time. */
export function clockTime(date: Date, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);
}

/** "6:00 PM – 9:00 PM", or just the start. */
export function timeRange(startsAt: string, endsAt: string | null, language: Language) {
  const start = clockTime(new Date(startsAt), language);
  return endsAt ? `${start} – ${clockTime(new Date(endsAt), language)}` : start;
}

/**
 * The Denver wall-clock date and time of a time from the server, which
 * always sends Denver time ("2026-10-24T18:00:00-06:00" → 2026-10-24, 18:00).
 */
export function denverParts(serverTime: string) {
  return { date: serverTime.slice(0, 10), time: serverTime.slice(11, 16) };
}

/** What the server expects: Denver time without a zone, "2026-10-24T18:00". */
export function toServerTime(date: string, time: string) {
  return `${date}T${time}`;
}
