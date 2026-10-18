/**
 * The remembered maps app ("Remember my choice"). Saved on this phone only,
 * because installed apps differ per device (docs/MILESTONE_3.md, Getting
 * there). Nothing about where anyone is goes here: just "google", say.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isMapApp, MapApp } from "./openIn";

const KEY = "maps.app";

export async function getRememberedMapApp(): Promise<MapApp | null> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return isMapApp(value) ? value : null;
  } catch {
    return null;
  }
}

/** null forgets it: "Ask every time". */
export async function setRememberedMapApp(app: MapApp | null) {
  try {
    if (app) await AsyncStorage.setItem(KEY, app);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Not saved; the sheet simply asks again next time.
  }
}
