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
 * https://api.globeville.app). Screens read it through src/config.ts.
 *
 * Milestone 3 (maps and auto check-in):
 *   - GOOGLE_MAPS_ANDROID_KEY: the Google Maps key for Android's maps. The
 *     owner provides it (MILESTONE_3.md, Open items); iPhone needs none.
 *   - Background location ("Always") and geofencing need an EAS
 *     development build; they don't work in Expo Go.
 *
 * Milestone 4 (push notifications):
 *   - EAS_PROJECT_ID: from `npx eas init` (Expo account). Push tokens need it.
 *   - Android push also needs a Firebase project, set up in the Expo account
 *     (README, "Push notifications").
 */
import type { ExpoConfig } from "expo/config";

const shared = require("../shared/app_config.json") as {
  app_name: string;
  privacy_url: string;
  terms_url: string;
  invite_url: string;
  ios_store_url: string;
  android_store_url: string;
};

const appName = shared.app_name;

// The version: raise it for every store release ("1.0.0" → "1.0.1").
// The build number is counted up by EAS automatically for real builds
// (eas.json: appVersionSource "remote"); BUILD_NUMBER is only what Expo Go
// and the browser demo show at the bottom of Settings.
const VERSION = "1.0.0";
const BUILD_NUMBER = 1;

// The app's permanent ID in the App Store and Google Play. Set once and
// NEVER change it: a new ID is a new app to the stores.
const APP_ID = "app.globeville";
const slug = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme: slug,
  version: VERSION,
  orientation: "portrait",
  icon: "./assets/brand/icon.png",
  userInterfaceStyle: "dark",
  ios: {
    supportsTablet: false,
    bundleIdentifier: APP_ID,
    buildNumber: String(BUILD_NUMBER),
    infoPlist: {
      // Lets the "Open in" sheet see whether these maps apps are installed.
      LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
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
    versionCode: BUILD_NUMBER,
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
    // Shown on share cards and in the share message.
    inviteUrl: shared.invite_url,
    // The store pages, for the "Please update" screen. Empty until published.
    iosStoreUrl: shared.ios_store_url,
    androidStoreUrl: shared.android_store_url,
    // The same number for every platform, so Settings can show it anywhere.
    buildNumber: String(BUILD_NUMBER),
    // Push notifications need the Expo project's id.
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
};

export default config;
