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

/** `interests` are keys like "gardening"; the app shows them translated. */
export type AppConfig = { app_name: string; interests: string[]; languages: string[] };

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
