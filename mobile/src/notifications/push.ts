/**
 * Push notifications on the phone (docs/MILESTONE_4.md): asking the phone
 * for permission and registering this phone's Expo push token with the
 * server. The server decides what to send; nothing here schedules anything.
 *
 * Needs an EAS development build (not Expo Go) and EAS_PROJECT_ID.
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Linking, Platform } from "react-native";

import { registerPushToken } from "../api";

export type PhonePermission = "granted" | "denied" | "undetermined";

/** Whether the phone lets this app show notifications. */
export async function phonePermission(): Promise<PhonePermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PhonePermission;
}

/** This phone's Expo push token, or null if it can't have one (no permission, Expo Go, no project id). */
export async function pushTokenForThisPhone(): Promise<string | null> {
  try {
    if ((await phonePermission()) !== "granted") return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null;
  }
}

/**
 * Ask the phone (the system prompt), then tell the server where to send.
 * Returns the phone's answer. If the phone won't ask again, opens Settings.
 */
export async function allowNotifications(token: string): Promise<PhonePermission> {
  let status = await phonePermission();
  if (status === "undetermined") status = (await Notifications.requestPermissionsAsync()).status as PhonePermission;
  if (status === "granted") {
    await registerThisPhone(token);
  } else if (!(await Notifications.getPermissionsAsync()).canAskAgain) {
    await Linking.openSettings().catch(() => undefined);
  }
  return status;
}

/** Make sure the server knows this phone (on app open; tokens can change). */
export async function registerThisPhone(token: string) {
  const pushToken = await pushTokenForThisPhone();
  if (pushToken) await registerPushToken(token, pushToken, Platform.OS).catch(() => undefined);
}

export function openPhoneSettings() {
  return Linking.openSettings().catch(() => undefined);
}
