import { getLocales } from "expo-localization";

import { Language } from ".";

/** First launch only: Spanish if the phone is set to Spanish, otherwise English. */
export function guessFromDevice(): Language {
  try {
    const code = getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode ?? "";
    return code.toLowerCase().startsWith("es") ? "es" : "en";
  } catch {
    return "en";
  }
}
