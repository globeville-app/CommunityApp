/**
 * BROWSER DEMO ONLY. Browsers can't watch places in the background, so auto
 * check-in does nothing here; the demo shows the screens and the setting.
 * The phone version is geofencing.ts.
 */
export type PermissionResult = "granted" | "denied" | "blocked";

export async function syncGeofences(_token: string, _autoCheckin?: boolean) {}

export async function askForAlwaysLocation(): Promise<PermissionResult> {
  return "granted";
}

export async function locationBlocked() {
  return false;
}

export async function stopGeofencing() {}
