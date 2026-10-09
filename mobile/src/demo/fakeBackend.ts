/**
 * BROWSER DEMO ONLY: a pretend backend that runs inside the web page.
 *
 * It copies the real backend's rules and error codes (see backend/). The
 * neighborhood check uses Denver's REAL boundaries (the build script puts
 * backend/data/denver_statistical_neighborhoods.geojson into the page), but
 * turning an address into a location is SIMULATED, because a web page can't
 * call the Census geocoder. So the demo knows the locations of a few public
 * sample addresses, recognizes Denver neighborhood names typed into the
 * address, and treats nearby suburb names as outside Denver.
 *
 * Like the real backend, it never keeps the address. Accounts and profiles
 * are saved in this browser's localStorage so a reload keeps you logged in.
 */
import {
  ApiError,
  AuthResult,
  CategoryGroup,
  EventData,
  MatchResult,
  ProblemReportInput,
  Profile,
  ProfileInput,
} from "../apiTypes";
import { isLanguage, Language } from "../i18n";

// ---- Sample data -----------------------------------------------------------

type Ring = [number, number][]; // [longitude, latitude] points
type DemoNeighborhood = { id: number; name: string; rings: Ring[] };
type DemoData = {
  neighborhoods: DemoNeighborhood[];
  aliases: Record<string, string[]>;
  // The event categories, read from backend/events/categories.py at build time.
  categoryGroups: CategoryGroup[];
};

// Put into the page by scripts/build-web-demo.mjs.
const DATA: DemoData = (globalThis as { __DEMO_DATA__?: DemoData }).__DEMO_DATA__ ?? {
  neighborhoods: [],
  aliases: {},
  categoryGroups: [],
};

export const CATEGORY_GROUPS = DATA.categoryGroups;
export const CATEGORY_KEYS = CATEGORY_GROUPS.flatMap((group) => group.categories);
const NEIGHBORHOODS = [...DATA.neighborhoods].sort((a, b) => a.id - b.id);
const ALIASES = DATA.aliases;

// Public places and their real locations, used as the demo's sample inputs.
const KNOWN_ADDRESSES: { startsWith: string; lat: number; lon: number }[] = [
  { startsWith: "1437 bannock", lat: 39.73925, lon: -104.99036 }, // City and County Building
  { startsWith: "2001 colorado", lat: 39.74753, lon: -104.9427 }, // Museum of Nature & Science
  { startsWith: "1701 wynkoop", lat: 39.75277, lon: -105.00025 }, // Union Station
  { startsWith: "2620 16th", lat: 39.75928, lon: -105.01103 }, // Little Man Ice Cream, LoHi
  { startsWith: "2001 blake", lat: 39.75597, lon: -104.99415 }, // Coors Field
  { startsWith: "15151 e alameda", lat: 39.71, lon: -104.8123 }, // Aurora Municipal Center
];

const SUBURBS = [
  "aurora", "lakewood", "englewood", "littleton", "arvada", "golden", "westminster",
  "thornton", "centennial", "wheat ridge", "commerce city", "boulder",
];

/**
 * Which neighborhood contains this point? Uses the even-odd rule across all
 * of a neighborhood's rings, so holes (including the one the city's file
 * stores as a separate piece in Virginia Village) are left out, the same
 * result as the backend's repaired shapes. Lowest ID wins, like the backend.
 */
function findNeighborhood(lat: number, lon: number) {
  return NEIGHBORHOODS.find((n) => {
    let inside = false;
    for (const ring of n.rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

// Typing this into the address simulates the lookup service being down.
export const SIMULATE_OUTAGE = "#down";

// ---- Pretend database, saved in this browser -------------------------------

export type DemoEvent = Omit<EventData, "group" | "is_past" | "organizer_name" | "is_organizer" | "going_count" | "is_going" | "matches_interests"> & {
  neighborhoodId: number;
  organizerEmail: string | null; // null once deleted
  organizerName: string; // made-up neighbors in the samples
  goingEmails: string[];
  extraGoing: number; // pretend neighbors going, in the samples
  createdAt: string;
};

export type Db = {
  users: Record<string, { password: string; language?: Language }>;
  tokens: Record<string, string>; // token → email
  matches: Record<string, number>; // email → neighborhood id (never the address)
  profiles: Record<string, Omit<Profile, "neighborhood" | "language"> & { neighborhoodId: number }>;
  // Only how many reports were sent; the demo has no team to read them.
  reportsSent?: number;
  events: Record<string, DemoEvent>;
  nextEventId: number;
  seededNeighborhoods: number[];
};

const DB_KEY = "demo_db_v3"; // v3: events, interests are event categories

function emptyDb(): Db {
  return { users: {}, tokens: {}, matches: {}, profiles: {}, events: {}, nextEventId: 1, seededNeighborhoods: [] };
}

export function load(): Db {
  try {
    const saved = localStorage.getItem(DB_KEY);
    return saved ? { ...emptyDb(), ...JSON.parse(saved) } : emptyDb();
  } catch {
    return memoryDb ?? emptyDb();
  }
}

let memoryDb: Db | null = null;

export function save(db: Db) {
  memoryDb = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage blocked: keep it in memory only
  }
}

export function resetDemo() {
  memoryDb = null;
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    // ignore
  }
}

// ---- Helpers ---------------------------------------------------------------

/** Make the demo feel like a network call. */
export function pause(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A form error, shaped like the backend's: a top code plus per-field codes. */
export function invalid(field: string, code: string): never {
  throw new ApiError(code, 400, { [field]: [code] });
}

export function userFor(token: string | null): string {
  const email = token ? load().tokens[token] : undefined;
  if (!email) throw new ApiError("authentication_failed", 401);
  return email;
}

export function languageOf(db: Db, email: string): Language {
  return db.users[email]?.language ?? "en";
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function neighborhoodById(id: number) {
  return NEIGHBORHOODS.find((n) => n.id === id)!;
}

function aliasesFor(name: string) {
  return Object.keys(ALIASES)
    .filter((alias) => ALIASES[alias].includes(name))
    .sort();
}

function newToken() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toProfile(db: Db, email: string): Profile {
  const { neighborhoodId, ...rest } = db.profiles[email];
  const neighborhood = neighborhoodById(neighborhoodId);
  return {
    ...rest,
    neighborhood: { id: neighborhood.id, name: neighborhood.name },
    language: languageOf(db, email),
  };
}

// ---- The endpoints ---------------------------------------------------------

export async function signup(emailInput: string, password: string, language: Language): Promise<AuthResult> {
  await pause();
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("email", "invalid_email");
  const db = load();
  if (db.users[email]) invalid("email", "email_taken");
  if (password.length < 8) invalid("password", "password_too_short");
  if (/^\d+$/.test(password)) invalid("password", "password_entirely_numeric");
  if (!isLanguage(language)) invalid("language", "invalid_language");
  const token = newToken();
  db.users[email] = { password, language };
  db.tokens[token] = email;
  save(db);
  return { token, language };
}

export async function login(emailInput: string, password: string): Promise<AuthResult> {
  await pause();
  const email = emailInput.trim().toLowerCase();
  const db = load();
  if (db.users[email]?.password !== password) throw new ApiError("invalid_credentials", 400);
  const token = newToken();
  db.tokens[token] = email;
  save(db);
  return { token, language: languageOf(db, email) };
}

export async function updateLanguage(token: string, language: Language) {
  await pause(200);
  const email = userFor(token);
  if (!isLanguage(language)) invalid("language", "invalid_language");
  const db = load();
  db.users[email] = { ...db.users[email], language };
  save(db);
  return { language };
}

export async function logout(token: string) {
  await pause(200);
  const db = load();
  delete db.tokens[token];
  save(db);
}

export async function matchAddress(token: string, address: string): Promise<MatchResult> {
  await pause(700);
  const email = userFor(token);
  // PRIVACY: `text` exists only inside this function call.
  const text = address.trim().toLowerCase();

  if (text.includes(SIMULATE_OUTAGE)) {
    throw new ApiError("geocoder_unavailable", 503);
  }

  const outside = () => new ApiError("outside_denver", 400);

  let neighborhood: DemoNeighborhood | undefined;
  const known = KNOWN_ADDRESSES.find((k) => text.startsWith(k.startsWith));
  if (known) {
    // Real location + real boundaries: the same check the backend does.
    neighborhood = findNeighborhood(known.lat, known.lon);
    if (!neighborhood) throw outside();
  } else if (SUBURBS.some((suburb) => text.includes(suburb))) {
    throw outside();
  } else {
    // Simulated: a Denver neighborhood name typed into the address.
    // Longest names first, so "West Highland" wins over "Highland".
    const byLength = [...NEIGHBORHOODS].sort((a, b) => b.name.length - a.name.length);
    neighborhood = byLength.find((n) => new RegExp(`\\b${escapeRegExp(n.name.toLowerCase())}\\b`).test(text));
    if (!neighborhood) {
      const aliasTarget = Object.keys(ALIASES).find((alias) =>
        new RegExp(`\\b${escapeRegExp(alias.toLowerCase())}\\b`).test(text),
      );
      if (aliasTarget) neighborhood = NEIGHBORHOODS.find((n) => n.name === ALIASES[aliasTarget][0]);
    }
  }
  if (!neighborhood) {
    throw new ApiError("no_match", 400);
  }

  const db = load();
  db.matches[email] = neighborhood.id;
  save(db);
  return { neighborhood_id: neighborhood.id, name: neighborhood.name, aliases: aliasesFor(neighborhood.name) };
}

/** Like the backend: category keys, at most 8, no duplicates, never "other". */
function checkInterests(interests: string[]) {
  if (interests.some((key) => !CATEGORY_KEYS.includes(key)) || new Set(interests).size !== interests.length) {
    throw new ApiError("invalid_interest", 400);
  }
  if (interests.length > 8) throw new ApiError("too_many_interests", 400);
  return interests;
}

export async function updateInterests(token: string, interests: string[]): Promise<Profile> {
  await pause(300);
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) throw new ApiError("profile_not_found", 404);
  db.profiles[email].interests = checkInterests(interests);
  save(db);
  return toProfile(db, email);
}

export async function saveProfile(token: string, input: ProfileInput): Promise<Profile> {
  await pause();
  const email = userFor(token);
  const db = load();
  const neighborhoodId = db.matches[email];
  if (!neighborhoodId) throw new ApiError("match_required", 409);

  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  if (!firstName) invalid("first_name", "invalid_first_name");
  if (!lastName) invalid("last_name", "invalid_last_name");
  const neighborhood = neighborhoodById(neighborhoodId);
  const alias = input.alias.trim();
  if (alias && !aliasesFor(neighborhood.name).includes(alias)) {
    throw new ApiError("invalid_alias", 400);
  }

  const lastInitial = lastName.slice(0, 1).toUpperCase();
  const existing = db.profiles[email];
  db.profiles[email] = {
    display_name: `${firstName} ${lastInitial}.`,
    first_name: firstName,
    last_initial: lastInitial,
    photo_url: existing?.photo_url ?? null,
    interests: checkInterests(input.interests),
    neighborhoodId,
    alias: alias || null,
    joined_at: existing?.joined_at ?? new Date().toISOString(),
  };
  if (input.language && isLanguage(input.language)) db.users[email] = { ...db.users[email], language: input.language };
  save(db);
  return toProfile(db, email);
}

export async function uploadPhoto(token: string, photo: { uri: string; mimeType: string }): Promise<Profile> {
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) throw new ApiError("profile_not_found", 404);
  db.profiles[email].photo_url = await shrinkPhoto(photo.uri);
  save(db);
  return toProfile(db, email);
}

export async function sendProblemReport(token: string | null, report: ProblemReportInput) {
  await pause(600);
  if (token) userFor(token);
  const message = report.message.trim();
  if (!message) throw new ApiError("message_required", 400);
  if (message.length > 1000) throw new ApiError("message_too_long", 400);
  const db = load();
  if ((db.reportsSent ?? 0) >= 5) throw new ApiError("daily_limit", 429);
  db.reportsSent = (db.reportsSent ?? 0) + 1;
  save(db);
  return { id: db.reportsSent };
}

export async function deleteAccount(token: string, password: string) {
  await pause();
  const email = userFor(token);
  const db = load();
  if (db.users[email]?.password !== password) throw new ApiError("wrong_password", 400);
  delete db.users[email];
  delete db.profiles[email];
  delete db.matches[email];
  for (const [key, owner] of Object.entries(db.tokens)) if (owner === email) delete db.tokens[key];
  // Like the backend: upcoming events they organized are cancelled, the
  // rest show "Former neighbor", and their "I'm going" marks are removed.
  for (const event of Object.values(db.events)) {
    if (event.organizerEmail === email) {
      if (new Date(event.starts_at) > new Date()) event.status = "cancelled";
      event.organizerEmail = null;
    }
    event.goingEmails = event.goingEmails.filter((e) => e !== email);
  }
  save(db);
}

export async function getMyProfile(token: string): Promise<Profile> {
  await pause(250);
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) throw new ApiError("profile_not_found", 404);
  return toProfile(db, email);
}

/**
 * Redraw the photo at 320px on a canvas. Like the real server, this keeps
 * only the pixels, so EXIF/GPS metadata is gone. It's also small enough to
 * keep in the browser.
 */
async function shrinkPhoto(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const bitmap = await createImageBitmap(blob);
  const size = 320;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const width = bitmap.width * scale;
  const height = bitmap.height * scale;
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
