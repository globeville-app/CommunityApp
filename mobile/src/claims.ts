/**
 * Collecting a badge earned as a guest (docs/MILESTONE_5.md, "Deferred deep
 * link"). A collect link opened before the person has joined is kept here
 * until they finish signing up or logging in; AppWatchers then claims it.
 * The typed code (from the collect page) goes straight to the server.
 *
 * The token works like a password for that one badge, so it's kept in
 * secure storage, next to the login token, and removed once it's tried.
 * (claims.web.ts is the browser demo's version.)
 */
import * as SecureStore from "expo-secure-store";

const KEY = "pending_badge_claim";

export async function savePendingClaim(token: string) {
  await SecureStore.setItemAsync(KEY, token);
}

/** The saved claim token, removed as it's read so it's only tried once. */
export async function takePendingClaim(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(KEY);
  if (token) await SecureStore.deleteItemAsync(KEY);
  return token;
}
