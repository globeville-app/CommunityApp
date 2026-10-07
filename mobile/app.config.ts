/**
 * Expo app configuration.
 *
 * The app name comes from ../shared/app_config.json, the one place it is
 * written. Rename the app there, not here.
 *
 * The backend address comes from the API_BASE_URL setting in mobile/.env
 * (see the README). Screens read both values through src/config.ts.
 */
import type { ExpoConfig } from "expo/config";

const shared = require("../shared/app_config.json") as { app_name: string };

const appName = shared.app_name;
const slug = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme: slug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
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
  },
};

export default config;
