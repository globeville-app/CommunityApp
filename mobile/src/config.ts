import Constants from "expo-constants";

/** The app name, from shared/app_config.json (via app.config.ts). */
export const APP_NAME: string = Constants.expoConfig?.name ?? "";

/** Where the backend lives, without a trailing slash. Set in mobile/.env. */
export const API_BASE_URL: string = String(
  Constants.expoConfig?.extra?.apiBaseUrl ?? "http://localhost:8000",
).replace(/\/+$/, "");

/** Privacy policy and terms pages, from shared/app_config.json. "" = not written yet. */
export const PRIVACY_URL: string = String(Constants.expoConfig?.extra?.privacyUrl ?? "");
export const TERMS_URL: string = String(Constants.expoConfig?.extra?.termsUrl ?? "");

/**
 * "1.0.0 (1)": the version and build number from app.config.ts. Read from
 * the app's config rather than the installed binary, so it's also right in
 * Expo Go (which would otherwise report Expo Go's own version).
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";
export const BUILD_NUMBER: string = String(
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "0",
);

/** How long to wait for the backend before giving up. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Photo uploads are much bigger than other requests, so they get longer. */
export const UPLOAD_TIMEOUT_MS = 90000;
