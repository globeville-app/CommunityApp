/**
 * Auto check-in (docs/BADGES.md, How attendance is recorded).
 *
 * The phone does the watching: one geofence (about 150 m) around the pin of
 * each of the next 20 events the member is going to (an iPhone limit). When
 * the phone enters one during its window, from 30 minutes before the start
 * to the end, the app tells the server "checked in to event X".
 *
 * PRIVACY: no coordinates, location history or movement ever leave the
 * phone. The check-in request has no body at all (api.checkIn). Nothing
 * here logs or stores where anyone is.
 *
 * Needs an EAS development build ("Always" location permission and
 * background tasks don't work in Expo Go).
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { checkIn, getGeofences, getMyProfile } from "../api";
import { readToken } from "../tokenStorage";

export const GEOFENCE_TASK = "globeville-auto-checkin";

/** A fence's name holds the event id and its window: "event|42|<opens ms>|<closes ms>". */
export function fenceId(eventId: number, opensAt: string, closesAt: string) {
  return `event|${eventId}|${Date.parse(opensAt)}|${Date.parse(closesAt)}`;
}

export function parseFenceId(identifier: string) {
  const [kind, id, opens, closes] = identifier.split("|");
  if (kind !== "event") return null;
  return { eventId: Number(id), opens: Number(opens), closes: Number(closes) };
}

/** Runs in the background when the phone enters a fence. */
export async function onGeofenceEvent({ data, error }: TaskManager.TaskManagerTaskBody<unknown>) {
  if (error || !data) return;
  const { eventType, region } = data as { eventType: Location.GeofencingEventType; region: Location.LocationRegion };
  if (eventType !== Location.GeofencingEventType.Enter || !region.identifier) return;
  const fence = parseFenceId(region.identifier);
  const now = Date.now();
  if (!fence || now < fence.opens || now > fence.closes) return;
  const token = await readToken().catch(() => null);
  if (!token) return;
  // Already recorded, or the event changed: the server says no and that's fine.
  await checkIn(token, fence.eventId).catch(() => undefined);
}

if (!TaskManager.isTaskDefined(GEOFENCE_TASK)) {
  TaskManager.defineTask(GEOFENCE_TASK, onGeofenceEvent);
}

async function stopWatching() {
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}

/**
 * Make the phone watch exactly the right events: the next 20 upcoming
 * "I'm going" events with a pin, while auto check-in is on and allowed.
 * Call it on app open, after "I'm going" changes and when the setting
 * changes. Passed or cancelled events drop out by themselves.
 */
export async function syncGeofences(token: string, autoCheckin?: boolean) {
  // The phone's permission first: without it there's nothing to watch, and
  // no need to ask the server.
  if (!(await Location.getBackgroundPermissionsAsync()).granted) return stopWatching();
  const on = autoCheckin ?? (await getMyProfile(token)).auto_checkin;
  if (!on) return stopWatching();
  const now = Date.now();
  const { geofences } = await getGeofences(token);
  const regions = geofences
    .filter((fence) => Date.parse(fence.closes_at) > now)
    .slice(0, 20)
    .map((fence) => ({
      identifier: fenceId(fence.event_id, fence.opens_at, fence.closes_at),
      latitude: fence.latitude,
      longitude: fence.longitude,
      radius: fence.radius_meters,
      notifyOnEnter: true,
      notifyOnExit: false,
    }));
  if (regions.length === 0) return stopWatching();
  // Starting again replaces the whole set, so old fences are removed.
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}

export type PermissionResult = "granted" | "denied" | "blocked";

/**
 * Ask for location "While using", then "Always". Only after the
 * explanation screen. "blocked" means the phone won't ask again, so the
 * member has to change it in the phone's Settings.
 */
export async function askForAlwaysLocation(): Promise<PermissionResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return foreground.canAskAgain ? "denied" : "blocked";
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.granted) return "granted";
  return background.canAskAgain ? "denied" : "blocked";
}

/** Whether the phone would still show the permission prompt. */
export async function locationBlocked() {
  const background = await Location.getBackgroundPermissionsAsync();
  return !background.granted && !background.canAskAgain;
}

export { stopWatching as stopGeofencing };
