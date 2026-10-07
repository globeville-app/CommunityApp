/**
 * Every call to the backend goes through this file.
 *
 * Errors always arrive as an ApiError with a `code` (what happened, for the
 * code) and a `message` (what to show the person).
 *
 * PRIVACY: nothing here logs requests or stores responses. The address is
 * sent to /api/join/match and then forgotten.
 */
import {
  ApiError,
  AppConfig,
  MatchResult,
  NETWORK_ERROR_MESSAGE,
  Profile,
  ProfileInput,
} from "./apiTypes";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";

export * from "./apiTypes";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  token?: string | null;
  json?: unknown;
  form?: FormData;
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
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: controller.signal,
    });
  } catch {
    // Offline, wrong API_BASE_URL, backend not running, or timed out.
    throw new ApiError("network", NETWORK_ERROR_MESSAGE);
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
    throw new ApiError(
      data?.code ?? "server_error",
      data?.detail ?? "Something went wrong on our side. Please try again.",
      response.status,
      data?.fields,
    );
  }
  return data as T;
}

// ---- The endpoints ----

export function getConfig() {
  return request<AppConfig>("/api/config");
}

export function signup(email: string, password: string) {
  return request<{ token: string }>("/api/auth/signup", { method: "POST", json: { email, password } });
}

export function login(email: string, password: string) {
  return request<{ token: string }>("/api/auth/login", { method: "POST", json: { email, password } });
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

export function uploadPhoto(token: string, photo: { uri: string; mimeType: string }) {
  const form = new FormData();
  const extension = photo.mimeType === "image/png" ? "png" : "jpg";
  // React Native's FormData accepts this {uri, name, type} shape for files.
  form.append("photo", { uri: photo.uri, name: `photo.${extension}`, type: photo.mimeType } as any);
  return request<Profile>("/api/profile/photo", { method: "POST", token, form });
}

export function getMyProfile(token: string) {
  return request<Profile>("/api/profile/me", { token });
}
