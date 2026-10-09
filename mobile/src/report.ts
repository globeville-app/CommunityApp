/**
 * The technical details attached to every problem report, so the person
 * doesn't have to explain them. Deliberately short: no location, no
 * contacts, nothing from other screens or form fields.
 */
import * as Device from "expo-device";
import { Platform } from "react-native";

import { APP_VERSION, BUILD_NUMBER } from "./config";

export function deviceDetails() {
  const osName = Device.osName ?? Platform.OS;
  const osVersion = Device.osVersion ?? String(Platform.Version ?? "");
  return {
    app_version: `${APP_VERSION} (${BUILD_NUMBER})`,
    os: `${osName} ${osVersion}`.trim(),
    device_model: Device.modelName ?? (Platform.OS === "web" ? "Web browser" : "Unknown"),
  };
}
