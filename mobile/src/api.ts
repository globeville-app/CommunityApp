/**
 * Every call to the backend goes through this file.
 *
 * Errors always arrive as an ApiError with a `code`, never a sentence; the
 * screens turn the code into words in the person's language.
 *
 * PRIVACY: nothing here logs requests or stores responses. The address is
 * sent to /api/join/match and then forgotten.
 */
import {
  ApiError,
  AppConfig,
  AuthResult,
  BadgeCatalog,
  BadgeData,
  Celebration,
  CollectCard,
  Geofence,
  Impact,
  MemberPage,
  ProfileSettings,
  EventData,
  EventInput,
  MatchResult,
  ProblemReportInput,
  Profile,
  ProfileInput,
  Translation,
} from "./apiTypes";
import { API_BASE_URL, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from "./config";
import type { Language } from "./i18n";

export * from "./apiTypes";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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

/** Interests are category keys (up to 8, never "other"). */
export function updateInterests(token: string, interests: string[]) {
  return request<Profile>("/api/profile/me", { method: "PATCH", token, json: { interests } });
}

// ---- Events ----

export function listEvents(token: string, filter: { group?: string; forYou?: boolean } = {}) {
  const query = new URLSearchParams();
  if (filter.group) query.set("group", filter.group);
  if (filter.forYou) query.set("for_you", "true");
  const suffix = query.toString() ? `?${query}` : "";
  return request<{ events: EventData[] }>(`/api/events${suffix}`, { token });
}

export function getEvent(token: string, id: number) {
  return request<EventData>(`/api/events/${id}`, { token });
}

export function createEvent(token: string, event: EventInput) {
  return request<EventData>("/api/events", { method: "POST", token, json: event });
}

export function updateEvent(token: string, id: number, changes: Partial<EventInput>) {
  return request<EventData>(`/api/events/${id}`, { method: "PATCH", token, json: changes });
}

export function cancelEvent(token: string, id: number) {
  return request<EventData>(`/api/events/${id}/cancel`, { method: "POST", token });
}

/** I'm going (true) or not anymore (false). */
export function setGoing(token: string, id: number, going: boolean) {
  return request<{ going_count: number; is_going: boolean }>(`/api/events/${id}/going`, {
    method: going ? "PUT" : "DELETE",
    token,
  });
}

export function reportEvent(token: string, id: number, reason: string) {
  return request<{ ok: boolean }>(`/api/events/${id}/report`, { method: "POST", token, json: { reason } });
}

/** Title and a suggested category from a Partiful link; both null if not found. */
export function partifulPreview(token: string, url: string) {
  return request<{ title: string | null; suggested_category: string | null }>("/api/events/partiful-preview", {
    method: "POST",
    token,
    json: { url },
  });
}

export function translateEvent(token: string, id: number, target: Language) {
  return request<Translation>(`/api/events/${id}/translate`, { method: "POST", token, json: { target } });
}

// ---- Badges and attendance (Milestone 3) ----

export function updateProfileSettings(token: string, settings: ProfileSettings) {
  return request<Profile>("/api/profile/me", { method: "PATCH", token, json: settings });
}

export function getBadgeCatalog(token: string) {
  return request<BadgeCatalog>("/api/badges/catalog", { token });
}

export function getMyBadges(token: string) {
  return request<{ badges: BadgeData[] }>("/api/me/badges", { token });
}

export function getMember(token: string, id: number) {
  return request<MemberPage>(`/api/members/${id}`, { token });
}

export function getCollectCards(token: string) {
  return request<{ cards: CollectCard[]; show_checkin_reoffer: boolean }>("/api/me/collect", { token });
}

export function collectEvent(token: string, id: number) {
  return request<{ celebrations: Celebration[] }>(`/api/events/${id}/collect`, { method: "POST", token });
}

/** "I didn't make it": off the going count, nothing counted. */
export function declineEvent(token: string, id: number) {
  return request<void>(`/api/events/${id}/decline`, { method: "POST", token });
}

/**
 * Auto check-in: "I arrived at event X". PRIVACY: no body at all, so no
 * location can ever be sent.
 */
export function checkIn(token: string, id: number) {
  return request<{ celebrations: Celebration[] }>(`/api/events/${id}/checkin`, { method: "POST", token });
}

export function getGeofences(token: string) {
  return request<{ geofences: Geofence[] }>("/api/me/geofences", { token });
}

export function getImpact(token: string) {
  return request<Impact>("/api/me/impact", { token });
}

export function getCelebrations(token: string) {
  return request<{ celebrations: Celebration[] }>("/api/me/celebrations", { token });
}

export function markCelebrationsSeen(token: string, ids: number[]) {
  return request<void>("/api/me/celebrations/seen", { method: "POST", token, json: { ids } });
}

/** Counts a share: the badge and the date only. */
export function logShare(token: string, badgeKey: string) {
  return request<void>(`/api/badges/${badgeKey}/shared`, { method: "POST", token });
}

export function markCheckinOfferSeen(token: string, which: "first" | "reoffer") {
  return request<void>("/api/me/checkin-offer/seen", { method: "POST", token, json: { which } });
}
