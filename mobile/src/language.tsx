/**
 * The one place that owns the app's language (docs/LANGUAGE.md). Screens
 * read it with useLanguage(); text comes from useTranslation().
 *
 * Which language is used, first match wins:
 *   1. The person's choice on this phone (the toggle). Always wins.
 *   2. After logging in on a phone with no choice: the account's language.
 *   3. First launch: Spanish if the phone is set to Spanish, else English.
 *      Saved right away, so the phone's setting is never checked again.
 *
 * A choice made while logged in is saved on the phone at once and then sent
 * to the server. If that fails, the phone keeps the choice and tries again
 * the next time the app starts. A network error never undoes a choice.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { updateLanguage } from "./api";
import { useAuth } from "./auth";
import i18n, { Language } from "./i18n";
import { guessFromDevice } from "./i18n/deviceLanguage";
import { isUnsynced, markUnsynced, readSavedLanguage, saveLanguage } from "./i18n/languageStorage";

type LanguageState = {
  language: Language;
  /** The toggle: switch now, remember on this phone, and tell the server. */
  setLanguage: (language: Language) => void;
  /**
   * Call right after signup or login with the account's language. A choice
   * made on this phone wins and is sent to the server; otherwise the
   * account's language is used.
   */
  syncAfterLogin: (token: string, accountLanguage: Language) => Promise<void>;
};

const LanguageContext = createContext<LanguageState | null>(null);

async function sendToServer(token: string, language: Language) {
  try {
    await updateLanguage(token, language);
    await markUnsynced(false);
  } catch {
    await markUnsynced(true); // keep the choice; retry at next start
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { token, isLoading: authLoading } = useAuth();
  const [language, setCurrent] = useState<Language | null>(null);
  const retried = useRef(false);

  const apply = useCallback((next: Language) => {
    i18n.changeLanguage(next);
    setCurrent(next);
  }, []);

  // Decide the language once, at startup.
  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await readSavedLanguage();
      let next: Language;
      if (saved) {
        next = saved.language;
      } else {
        next = guessFromDevice();
        await saveLanguage(next, "device");
      }
      if (active) apply(next);
    })();
    return () => {
      active = false;
    };
  }, [apply]);

  // Retry a change that didn't reach the server last time.
  useEffect(() => {
    if (authLoading || !token || !language || retried.current) return;
    retried.current = true;
    isUnsynced().then((unsynced) => {
      if (unsynced) sendToServer(token, language);
    });
  }, [authLoading, token, language]);

  const setLanguage = useCallback(
    (next: Language) => {
      apply(next);
      saveLanguage(next, "choice");
      if (token) sendToServer(token, next);
    },
    [apply, token],
  );

  const syncAfterLogin = useCallback(
    async (newToken: string, accountLanguage: Language) => {
      const saved = await readSavedLanguage();
      if (saved?.source === "choice") {
        // The most recent thing the person did was pick this language here.
        if (saved.language !== accountLanguage) await sendToServer(newToken, saved.language);
        return;
      }
      apply(accountLanguage);
      await saveLanguage(accountLanguage, "account");
    },
    [apply],
  );

  // Nothing shows until the language is known, so text never flips.
  if (!language) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, syncAfterLogin }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return value;
}
