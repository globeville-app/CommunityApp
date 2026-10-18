import * as Application from "expo-application";
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

/** "1.0.0 (1)": the version (app.config.ts) and build number. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";
export const BUILD_NUMBER: string =
  // A real build knows its own build number (EAS counts it up); Expo Go and
  // the browser demo would report Expo Go's, so they use the config's.
  (Constants.executionEnvironment !== "storeClient" && Application.nativeBuildVersion) ||
  String(Constants.expoConfig?.extra?.buildNumber ?? "0");

/** How long to wait for the backend before giving up. */
export const REQUEST_TIMEOUT_MS = 15000;

/** Photo uploads are much bigger than other requests, so they get longer. */
export const UPLOAD_TIMEOUT_MS = 90000;
