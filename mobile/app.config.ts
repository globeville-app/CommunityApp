/**
 * Expo app configuration.
 *
 * The app name comes from ../shared/app_config.json, the one place it is
 * written. Rename the app there, not here.
 *
 * Icons and the splash screen use the brand files in assets/brand/
 * (see design/BRAND.md).
 *
 * The backend address comes from API_BASE_URL: mobile/.env on your computer,
 * or the build profile in eas.json for real builds (production is
 * https://api.globeville.org). Screens read it through src/config.ts.
 *
 * Milestone 3 (maps and auto check-in):
 *   - GOOGLE_MAPS_ANDROID_KEY: the Google Maps key for Android's maps. The
 *     owner provides it (MILESTONE_3.md, Open items); iPhone needs none.
 *   - Background location ("Always") and geofencing need an EAS
 *     development build; they don't work in Expo Go.
 *
 * Milestone 4 (push notifications):
 *   - The Expo project (`npx eas init`, Nov 2026): @adubin/globeville, ID in
 *     EXPO_PROJECT_ID below. Builds and push tokens need it. It isn't a
 *     secret. EAS_PROJECT_ID in the environment overrides it (e.g. a test project).
 *   - Android push also needs a Firebase project, set up in the Expo account
 *     (README, "Push notifications").
 *
 * Milestone 5 (invite links): globeville.org/e/... and /c/... open the app
 * when it's installed (iOS Universal Links, Android App Links). The domain
 * is the invite_url in shared/app_config.json. The server's
 * /.well-known files need APPLE_TEAM_ID and ANDROID_CERT_SHA256 (README).
 * Changing this needs a new app build.
 */
import type { ExpoConfig } from "expo/config";

const shared = require("../shared/app_config.json") as {
  app_name: string;
  privacy_url: string;
  terms_url: string;
  invite_url: string;
  ios_store_url: string;
  android_store_url: string;
  legal: { minimum_age: number };
};

const appName = shared.app_name;

// The version: raise it for every store release ("1.0.0" → "1.0.1").
// The build number is counted up by EAS automatically for real builds
// (eas.json: appVersionSource "remote"); BUILD_NUMBER is only what Expo Go
// and the browser demo show at the bottom of Settings.
const VERSION = "1.0.1";
const BUILD_NUMBER = 1;

// The app's permanent ID in the App Store and Google Play. Set once and
// NEVER change it: a new ID is a new app to the stores.
const APP_ID = "app.globeville";
const slug = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
const linkDomain = new URL(shared.invite_url).host;

// The Expo account and project the builds belong to (expo.dev/accounts/adubin/projects/globeville).
const EXPO_OWNER = "adubin";
const EXPO_PROJECT_ID = "4c1bdd43-0055-45c7-ac5d-41526095a720";

const config: ExpoConfig = {
  name: appName,
  slug,
  owner: EXPO_OWNER,
  scheme: slug,
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/brand/icon.png",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: false,
    bundleIdentifier: APP_ID,
    buildNumber: String(BUILD_NUMBER),
    associatedDomains: [`applinks:${linkDomain}`],
    // Only standard HTTPS, which is exempt from US export rules, so App Store
    // Connect doesn't hold each build waiting for the encryption question.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      // Lets the "Open in" sheet see whether these maps apps are installed.
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
      // English and Spanish (the permission questions above, in `locales`).
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1A0F3D",
      foregroundImage: "./assets/brand/adaptive-icon.png",
      backgroundImage: "./assets/brand/adaptive-icon-background.png",
    },
    predictiveBackGestureEnabled: false,
    package: APP_ID,
    // Permissions libraries add that the app doesn't need. Google Play flags
    // drawing over other apps, and limits broad photo and file access: the
    // profile photo uses the system photo picker, which needs none of them.
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
    versionCode: BUILD_NUMBER,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: linkDomain, pathPrefix: "/e/" },
          { scheme: "https", host: linkDomain, pathPrefix: "/c/" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  // The phone's permission questions in Spanish, for iPhones set to Spanish
  // (docs/LANGUAGE.md). English is set by the plugins below; keep both in step.
  // Android writes its own permission questions in the phone's language.
  locales: {
    es: {
      ios: {
        CFBundleDisplayName: appName,
        NSLocationWhenInUseUsageDescription: `${appName} registra tu llegada cuando llegas a los eventos a los que vas. Nunca vemos ni guardamos dónde estás.`,
        NSLocationAlwaysAndWhenInUseUsageDescription: `${appName} registra tu llegada cuando llegas a los eventos a los que vas, incluso con la app cerrada. Nunca vemos ni guardamos dónde estás.`,
        NSPhotoLibraryUsageDescription: `${appName} usa tus fotos para que puedas agregar una foto de perfil.`,
      },
    },
  },
  web: {
    favicon: "./assets/brand/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/brand/splash-icon.png",
        imageWidth: 160,
        resizeMode: "contain",
        backgroundColor: "#1A0F3D",
      },
    ],
    "expo-secure-store",
    [
      "expo-location",
      {
        // Draft wording: the owner approves it before launch (MILESTONE_3.md, Open items).
        locationWhenInUsePermission: `${appName} checks you in when you arrive at events you're going to. We never see or store where you are.`,
        locationAlwaysAndWhenInUsePermission: `${appName} checks you in when you arrive at events you're going to, even when the app is closed. We never see or store where you are.`,
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        // Auto check-in uses geofencing only, which needs no location
        // "foreground service" (and its Google Play declaration and video).
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ["react-native-maps", { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? "" }],
    "./plugins/withMapAppQueries",
    ["expo-notifications", { color: "#FFF3A3" }],
    [
      "expo-image-picker",
      {
        photosPermission: `${appName} uses your photo library so you can add a profile photo.`,
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  extra: {
    // Your computer's address on your Wi-Fi, e.g. http://192.168.1.23:8000
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:8000",
    // Empty until the real pages exist; Settings then shows "Coming soon".
    privacyUrl: shared.privacy_url,
    termsUrl: shared.terms_url,
    // Shown on Sign up ("you're 13 or older"), from the "legal" section.
    minimumAge: shared.legal.minimum_age,
    // Shown on share cards and in the share message.
    inviteUrl: shared.invite_url,
    // The store pages, for the "Please update" screen. Empty until published.
    iosStoreUrl: shared.ios_store_url,
    androidStoreUrl: shared.android_store_url,
    // The same number for every platform, so Settings can show it anywhere.
    buildNumber: String(BUILD_NUMBER),
    // Push notifications need the Expo project's id.
    eas: { projectId: process.env.EAS_PROJECT_ID || EXPO_PROJECT_ID },
  },
};

export default config;
