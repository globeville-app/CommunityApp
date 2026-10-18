/**
 * Getting there: open an event's pin in a maps app, using each app's
 * standard link (docs/MILESTONE_3.md). Apple Maps is offered on iPhone only.
 * Google Maps and Waze are offered when installed; on iPhone that needs the
 * schemes under LSApplicationQueriesSchemes, on Android the <queries>
 * entries (both in app.config.ts).
 */
import { Linking, Platform } from "react-native";

export const MAP_APPS = ["apple", "google", "waze"] as const;
export type MapApp = (typeof MAP_APPS)[number];

export function isMapApp(value: unknown): value is MapApp {
  return typeof value === "string" && (MAP_APPS as readonly string[]).includes(value);
}

/** What to open: the pin if there is one, else the typed meeting spot as a search. */
export type Place = { latitude: number | null; longitude: number | null; label: string };

// The app schemes that tell us an app is installed.
const INSTALLED_CHECK: Partial<Record<MapApp, string>> = { google: "comgooglemaps://", waze: "waze://" };

export async function installedMapApps(): Promise<MapApp[]> {
  const found: MapApp[] = Platform.OS === "ios" ? ["apple"] : [];
  for (const app of ["google", "waze"] as const) {
    try {
      if (await Linking.canOpenURL(INSTALLED_CHECK[app]!)) found.push(app);
    } catch {
      // Not allowed to ask: treat it as not installed.
    }
  }
  return found;
}

export function mapLink(app: MapApp, place: Place): string {
  const label = encodeURIComponent(place.label);
  const hasPin = place.latitude !== null && place.longitude !== null;
  const at = `${place.latitude},${place.longitude}`;
  // Without a pin, search for the typed spot in Denver.
  const search = encodeURIComponent(`${place.label}, Denver, CO`);
  switch (app) {
    case "apple":
      return hasPin ? `https://maps.apple.com/?ll=${at}&q=${label}` : `https://maps.apple.com/?q=${search}`;
    case "google":
      return hasPin
        ? `https://www.google.com/maps/search/?api=1&query=${at}`
        : `https://www.google.com/maps/search/?api=1&query=${search}`;
    case "waze":
      return hasPin ? `https://waze.com/ul?ll=${at}&navigate=yes` : `https://waze.com/ul?q=${search}&navigate=yes`;
  }
}

export function openInMapApp(app: MapApp, place: Place) {
  return Linking.openURL(mapLink(app, place));
}
