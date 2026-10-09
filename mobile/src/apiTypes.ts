/**
 * Shapes shared by the real API client (api.ts) and the browser demo
 * (api.web.ts), so both behave the same for the screens.
 */

import type { Language } from "./i18n";

/**
 * An error from the server (or from reaching it). It carries only a code,
 * such as "outside_denver"; screens show it with errorMessage() from
 * src/i18n/errors.ts, in the person's language.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;

  constructor(code: string, status = 0, fields?: Record<string, string[]>) {
    super(code);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

// ---- Types the backend sends back ----

/** Event categories, grouped. Also the list members pick interests from. */
export type CategoryGroup = { key: string; categories: string[] };

export type AppConfig = {
  app_name: string;
  languages: string[];
  category_groups: CategoryGroup[];
  other_category: string;
  other_max_length: number;
  max_interests: number;
};

/** An event as the server sends it. Times are Denver time, e.g. "2026-10-24T18:00:00-06:00". */
export type EventData = {
  id: number;
  group: string | null;
  category: string;
  category_other: string | null;
  title: string;
  description: string;
  language: Language;
  title_alt: string | null;
  description_alt: string | null;
  starts_at: string;
  ends_at: string | null;
  location_text: string;
  partiful_url: string | null;
  status: "active" | "cancelled";
  is_past: boolean;
  /** null once the organizer deleted their account ("Former neighbor"). */
  organizer_name: string | null;
  is_organizer: boolean;
  going_count: number;
  is_going: boolean;
  matches_interests: boolean;
};

/** What the post/edit form sends. Times are Denver time without a zone, "2026-10-24T18:00". */
export type EventInput = {
  category: string;
  category_other?: string;
  title: string;
  description?: string;
  language?: Language;
  title_alt?: string;
  description_alt?: string;
  starts_at: string;
  ends_at?: string | null;
  location_text: string;
  partiful_url?: string;
};

export type Translation = { title: string; description: string; target: Language; machine: boolean };

/** Signup and login both return the token and the account's language. */
export type AuthResult = { token: string; language: Language };

export type MatchResult = { neighborhood_id: number; name: string; aliases: string[] };

export type Profile = {
  display_name: string;
  first_name: string;
  last_initial: string;
  photo_url: string | null;
  interests: string[];
  neighborhood: { id: number; name: string };
  alias: string | null;
  role?: "member" | "organizer";
  language: Language;
  joined_at: string;
};

/**
 * A "Report a problem" form. Only what the person typed, plus technical
 * details the app adds (see src/report.ts). Never an address or location.
 */
export type ProblemReportInput = {
  message: string;
  contact_email?: string;
  screenshot?: { uri: string; mimeType: string } | null;
  app_version: string;
  os: string;
  device_model: string;
  language: Language;
  screen: string;
};

export type ProfileInput = {
  first_name: string;
  last_name: string;
  alias: string;
  interests: string[];
  language?: Language;
};
