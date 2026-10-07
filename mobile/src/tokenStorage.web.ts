/**
 * BROWSER DEMO ONLY. The real app runs on phones and uses tokenStorage.ts.
 *
 * Browsers have no secure storage, so the demo keeps its fake login token
 * in this browser's localStorage. If storage is blocked, the demo still
 * works; you just won't stay logged in after reloading.
 */
const TOKEN_KEY = "demo_auth_token";

export async function readToken(): Promise<string | null> {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore: storage blocked
  }
}

export async function clearToken(): Promise<void> {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore: storage blocked
  }
}
