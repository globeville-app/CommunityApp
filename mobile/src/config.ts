import Constants from "expo-constants";

/** The app name, from shared/app_config.json (via app.config.ts). */
export const APP_NAME: string = Constants.expoConfig?.name ?? "";

/** Where the backend lives, without a trailing slash. Set in mobile/.env. */
export const API_BASE_URL: string = String(
  Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:8000",
).replace(/\/+$/, "");

/** How long to wait for the backend before giving up. */
export const REQUEST_TIMEOUT_MS = 15000;
