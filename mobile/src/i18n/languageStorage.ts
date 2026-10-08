/**
 * The language choice on this phone (docs/LANGUAGE.md).
 *
 * It's a preference, not a secret, so it lives in AsyncStorage rather than
 * secure storage. This is the ONLY file allowed to use AsyncStorage, and it
 * only ever writes the keys below (a test checks both), so nothing private,
 * like an address, can end up there.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isLanguage, Language } from ".";

export const LANGUAGE_KEY = "app.language";
/**
 * Where the saved language came from:
 *  - "choice": the person picked it with the toggle. Always wins.
 *  - "device": a first-launch guess from the phone's settings.
 *  - "account": copied from the member's account after logging in.
 * Only a real choice overrides the account's language at login.
 */
export const SOURCE_KEY = "app.language_source";
/** "1" while a change hasn't reached the server yet; retried at app start. */
export const UNSYNCED_KEY = "app.language_unsynced";

export type LanguageSource = "choice" | "device" | "account";
export type SavedLanguage = { language: Language; source: LanguageSource };

export async function readSavedLanguage(): Promise<SavedLanguage | null> {
  try {
    const [language, source] = await Promise.all([
      AsyncStorage.getItem(LANGUAGE_KEY),
      AsyncStorage.getItem(SOURCE_KEY),
    ]);
    if (!isLanguage(language)) return null;
    const known = source === "device" || source === "account" ? source : "choice";
    return { language, source: known };
  } catch {
    return null;
  }
}

export async function saveLanguage(language: Language, source: LanguageSource) {
  try {
    await AsyncStorage.multiSet([
      [LANGUAGE_KEY, language],
      [SOURCE_KEY, source],
    ]);
  } catch {
    // Storage unavailable: the choice still applies until the app closes.
  }
}

export async function markUnsynced(unsynced: boolean) {
  try {
    if (unsynced) await AsyncStorage.setItem(UNSYNCED_KEY, "1");
    else await AsyncStorage.removeItem(UNSYNCED_KEY);
  } catch {
    // ignore: worst case we retry once more than needed
  }
}

export async function isUnsynced() {
  try {
    return (await AsyncStorage.getItem(UNSYNCED_KEY)) === "1";
  } catch {
    return false;
  }
}
