/**
 * Every call to the backend goes through this file.
 *
 * Errors always arrive as an ApiError with a `code`, never a sentence; the
 * screens turn the code into words in the person's language.
 *
 * PRIVACY: nothing here logs requests or stores responses. The address is
 * sent to /api/join/match and then forgotten.
 */
import { ApiError, AppConfig, AuthResult, MatchResult, ProblemReportInput, Profile, ProfileInput } from "./apiTypes";
import { API_BASE_URL, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from "./config";
import type { Language } from "./i18n";

export * from "./apiTypes";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  token?: string | null;
  json?: unknown;
  form?: FormData;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) headers.Authorization = `Token ${options.token}`;

  let body: string | FormData | undefined;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form; // fetch sets the multipart Content-Type itself
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
  } catch {
    if (timedOut) throw new ApiError("timeout");
    // Offline, wrong API_BASE_URL, or the backend isn't running.
    throw new ApiError("network");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(data?.code ?? "server_error", response.status, data?.fields);
  }
  return data as T;
}

// ---- The endpoints ----

export function getConfig() {
  return request<AppConfig>("/api/config");
}

export function signup(email: string, password: string, language: Language) {
  return request<AuthResult>("/api/auth/signup", { method: "POST", json: { email, password, language } });
}

export function login(email: string, password: string) {
  return request<AuthResult>("/api/auth/login", { method: "POST", json: { email, password } });
}

/** Save the member's language on the server (works before the profile exists). */
export function updateLanguage(token: string, language: Language) {
  return request<{ language: Language }>("/api/profile/me", { method: "PATCH", token, json: { language } });
}

export function logout(token: string) {
  return request<void>("/api/auth/logout", { method: "POST", token });
}

export function matchAddress(token: string, address: string) {
  return request<MatchResult>("/api/join/match", { method: "POST", token, json: { address } });
}

export function saveProfile(token: string, profile: ProfileInput) {
  return request<Profile>("/api/profile", { method: "PUT", token, json: profile });
}

/** Works signed in or not (token may be null). Returns a reference number. */
export function sendProblemReport(token: string | null, report: ProblemReportInput) {
  const form = new FormData();
  const { screenshot, ...fields } = report;
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, String(value));
  }
  if (screenshot) {
    const extension = screenshot.mimeType === "image/png" ? "png" : "jpg";
    form.append("screenshot", { uri: screenshot.uri, name: `screenshot.${extension}`, type: screenshot.mimeType } as any);
  }
  return request<{ id: number }>("/api/support/report", { method: "POST", token, form, timeoutMs: UPLOAD_TIMEOUT_MS });
}

/** Permanently deletes the account. The password confirms it's really them. */
export function deleteAccount(token: string, password: string) {
  return request<void>("/api/account/delete", { method: "POST", token, json: { password } });
}

export function uploadPhoto(token: string, photo: { uri: string; mimeType: string }) {
  const form = new FormData();
  const extension = photo.mimeType === "image/png" ? "png" : "jpg";
  // React Native's FormData accepts this {uri, name, type} shape for files.
  form.append("photo", { uri: photo.uri, name: `photo.${extension}`, type: photo.mimeType } as any);
  return request<Profile>("/api/profile/photo", { method: "POST", token, form, timeoutMs: UPLOAD_TIMEOUT_MS });
}

export function getMyProfile(token: string) {
  return request<Profile>("/api/profile/me", { token });
}
