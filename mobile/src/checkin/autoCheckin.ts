/**
 * Turning auto check-in on: ask for "Always" location (only after the
 * explanation), then save the setting and start watching. If the phone
 * won't ask any more, open the phone's Settings instead.
 */
import { Linking } from "react-native";

import { updateProfileSettings } from "../api";
import { askForAlwaysLocation, PermissionResult, stopGeofencing, syncGeofences } from "./geofencing";

export async function turnOnAutoCheckin(token: string): Promise<PermissionResult> {
  const result = await askForAlwaysLocation();
  if (result === "granted") {
    await updateProfileSettings(token, { auto_checkin: true });
    await syncGeofences(token, true).catch(() => undefined);
  } else if (result === "blocked") {
    await Linking.openSettings().catch(() => undefined);
  }
  return result;
}

export async function turnOffAutoCheckin(token: string) {
  await updateProfileSettings(token, { auto_checkin: false });
  await stopGeofencing().catch(() => undefined);
}
