/**
 * Expo app configuration.
 *
 * The app name comes from ../shared/app_config.json, the one place it is
 * written. Rename the app there, not here.
 *
 * Icons and the splash screen use the brand files in assets/brand/
 * (see design/BRAND.md).
 *
 * The backend address comes from the API_BASE_URL setting in mobile/.env
 * (see the README). Screens read both values through src/config.ts.
 */
import type { ExpoConfig } from "expo/config";

const shared = require("../shared/app_config.json") as {
  app_name: string;
  privacy_url: string;
  terms_url: string;
};

const appName = shared.app_name;

// Shown at the bottom of Settings as "Version 1.0.0 (1)". Raise the build
// number for every build sent to the stores.
const VERSION = "1.0.0";
const BUILD_NUMBER = 1;
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
    buildNumber: String(BUILD_NUMBER),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1A0F3D",
      foregroundImage: "./assets/brand/adaptive-icon.png",
      backgroundImage: "./assets/brand/adaptive-icon-background.png",
    },
    predictiveBackGestureEnabled: false,
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
    // The same number for every platform, so Settings can show it anywhere.
    buildNumber: String(BUILD_NUMBER),
  },
};

export default config;
