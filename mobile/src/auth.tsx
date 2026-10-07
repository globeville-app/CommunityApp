/**
 * Keeps the login token (see tokenStorage.ts), so people stay logged in
 * after closing the app.
 */
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { clearToken, readToken, saveToken } from "./tokenStorage";

type AuthState = {
  token: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readToken()
      .then((saved) => setToken(saved))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(newToken: string) {
    await saveToken(newToken);
    setToken(newToken);
  }

  async function signOut() {
    await clearToken();
    setToken(null);
  }

  return (
    <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
