/**
 * Where the login token is kept on the phone: secure storage (Keychain on
 * iPhone, Keystore on Android). The token is the only secret the app saves,
 * besides a not-yet-collected guest badge link (claims.ts, Milestone 5).
 *
 * (tokenStorage.web.ts is the browser demo's version.)
 */
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

export function readToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function saveToken(token: string) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function clearToken() {
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}
