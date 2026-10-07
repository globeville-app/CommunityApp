/**
 * Keeps the login token, in the phone's secure storage (Keychain on iPhone,
 * Keystore on Android), so people stay logged in after closing the app.
 *
 * The token is the ONLY thing this app saves on the phone.
 */
import * as SecureStore from "expo-secure-store";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "auth_token";

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
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((saved) => setToken(saved))
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(newToken: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
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
