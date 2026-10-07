/**
 * Shapes shared by the real API client (api.ts) and the browser demo
 * (api.web.ts), so both behave the same for the screens.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;

  constructor(code: string, message: string, status = 0, fields?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Check your internet connection and try again.";

// ---- Types the backend sends back ----

export type AppConfig = { app_name: string; interests: string[] };

export type MatchResult = { neighborhood_id: number; name: string; aliases: string[] };

export type Profile = {
  display_name: string;
  first_name: string;
  last_initial: string;
  photo_url: string | null;
  interests: string[];
  neighborhood: { id: number; name: string };
  alias: string | null;
  joined_at: string;
};

export type ProfileInput = {
  first_name: string;
  last_name: string;
  alias: string;
  interests: string[];
};
