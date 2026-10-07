/**
 * BROWSER DEMO ONLY: a pretend backend that runs inside the web page.
 *
 * It copies the real backend's rules and messages (see backend/), but the
 * neighborhood matching is SIMULATED: there is no geocoder and no boundary
 * map here. It recognizes a few public sample addresses, Denver
 * neighborhood names typed into the address, and nearby suburb names.
 *
 * Like the real backend, it never keeps the address. Accounts and profiles
 * are saved in this browser's localStorage so a reload keeps you logged in.
 */
import { APP_NAME } from "../config";
import { ApiError, MatchResult, Profile, ProfileInput } from "../apiTypes";

// ---- Sample data -----------------------------------------------------------

export const INTERESTS = ["Block parties", "Food drives", "Cleanups", "Live music", "Gardening"];

// Real Denver Statistical Neighborhood names (a subset), with made-up IDs.
const NEIGHBORHOODS = [
  "Baker", "Berkeley", "Capitol Hill", "Cheesman Park", "Cherry Creek", "City Park",
  "Civic Center", "Cole", "Congress Park", "Five Points", "Hale", "Highland",
  "Jefferson Park", "Lincoln Park", "Montclair", "Platt Park", "Sloan Lake", "Speer",
  "Sunnyside", "Union Station", "University", "Washington Park", "West Highland", "Whittier",
].map((name, index) => ({ id: index + 1, name }));

// Same file contents as backend/data/neighborhood_aliases.json.
const ALIASES: Record<string, string[]> = { LoHi: ["Highland"] };

// Public places with well-known addresses, used as the demo's sample inputs.
const KNOWN_ADDRESSES: { startsWith: string; neighborhood: string }[] = [
  { startsWith: "1437 bannock", neighborhood: "Civic Center" }, // City and County Building
  { startsWith: "2001 colorado", neighborhood: "City Park" }, // Museum of Nature & Science
  { startsWith: "1701 wynkoop", neighborhood: "Union Station" }, // Union Station
  { startsWith: "2620 16th", neighborhood: "Highland" }, // Little Man Ice Cream, LoHi
];

const SUBURBS = [
  "aurora", "lakewood", "englewood", "littleton", "arvada", "golden", "westminster",
  "thornton", "centennial", "wheat ridge", "commerce city", "boulder",
];

// Typing this into the address simulates the lookup service being down.
export const SIMULATE_OUTAGE = "#down";

// ---- Pretend database, saved in this browser -------------------------------

type Db = {
  users: Record<string, { password: string }>;
  tokens: Record<string, string>; // token → email
  matches: Record<string, number>; // email → neighborhood id (never the address)
  profiles: Record<string, Omit<Profile, "neighborhood"> & { neighborhoodId: number }>;
};

const DB_KEY = "demo_db_v1";

function emptyDb(): Db {
  return { users: {}, tokens: {}, matches: {}, profiles: {} };
}

function load(): Db {
  try {
    const saved = localStorage.getItem(DB_KEY);
    return saved ? { ...emptyDb(), ...JSON.parse(saved) } : emptyDb();
  } catch {
    return memoryDb ?? emptyDb();
  }
}

let memoryDb: Db | null = null;

function save(db: Db) {
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
function pause(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function invalid(field: string, message: string): never {
  throw new ApiError("invalid", message, 400, { [field]: [message] });
}

function userFor(token: string | null): string {
  const email = token ? load().tokens[token] : undefined;
  if (!email) throw new ApiError("authentication_failed", "Invalid token.", 401);
  return email;
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

function toProfile(stored: Db["profiles"][string]): Profile {
  const { neighborhoodId, ...rest } = stored;
  const neighborhood = neighborhoodById(neighborhoodId);
  return { ...rest, neighborhood: { id: neighborhood.id, name: neighborhood.name } };
}

// ---- The endpoints ---------------------------------------------------------

export async function signup(emailInput: string, password: string) {
  await pause();
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("email", "Enter a valid email address.");
  const db = load();
  if (db.users[email]) invalid("email", "An account with this email already exists. Try logging in.");
  if (password.length < 8) {
    invalid("password", "This password is too short. It must contain at least 8 characters.");
  }
  if (/^\d+$/.test(password)) invalid("password", "This password is entirely numeric.");
  const token = newToken();
  db.users[email] = { password };
  db.tokens[token] = email;
  save(db);
  return { token };
}

export async function login(emailInput: string, password: string) {
  await pause();
  const email = emailInput.trim().toLowerCase();
  const db = load();
  if (db.users[email]?.password !== password) {
    throw new ApiError("invalid_credentials", "Email or password is incorrect.", 400);
  }
  const token = newToken();
  db.tokens[token] = email;
  save(db);
  return { token };
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
    throw new ApiError(
      "geocoder_unavailable",
      "We can't look up addresses right now. Please try again in a minute.",
      503,
    );
  }

  let name = KNOWN_ADDRESSES.find((k) => text.startsWith(k.startsWith))?.neighborhood;
  if (!name && SUBURBS.some((suburb) => text.includes(suburb))) {
    throw new ApiError("outside_denver", `${APP_NAME} is only in the City and County of Denver for now.`, 400);
  }
  if (!name) {
    // Longest names first, so "West Highland" wins over "Highland".
    const byLength = [...NEIGHBORHOODS].sort((a, b) => b.name.length - a.name.length);
    name = byLength.find((n) => text.includes(n.name.toLowerCase()))?.name;
    if (!name && text.includes("lohi")) name = "Highland";
  }
  if (!name) {
    throw new ApiError("no_match", "We couldn't find that address. Check the spelling and try again.", 400);
  }

  const neighborhood = NEIGHBORHOODS.find((n) => n.name === name)!;
  const db = load();
  db.matches[email] = neighborhood.id;
  save(db);
  return { neighborhood_id: neighborhood.id, name: neighborhood.name, aliases: aliasesFor(neighborhood.name) };
}

export async function saveProfile(token: string, input: ProfileInput): Promise<Profile> {
  await pause();
  const email = userFor(token);
  const db = load();
  const neighborhoodId = db.matches[email];
  if (!neighborhoodId) throw new ApiError("match_required", "Enter your address first.", 409);

  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  if (!firstName) invalid("first_name", "This field may not be blank.");
  if (!lastName) invalid("last_name", "This field may not be blank.");
  const neighborhood = neighborhoodById(neighborhoodId);
  const alias = input.alias.trim();
  if (alias && !aliasesFor(neighborhood.name).includes(alias)) {
    throw new ApiError("invalid_alias", `${alias} isn't a name for ${neighborhood.name}.`, 400);
  }

  const lastInitial = lastName.slice(0, 1).toUpperCase();
  const existing = db.profiles[email];
  db.profiles[email] = {
    display_name: `${firstName} ${lastInitial}.`,
    first_name: firstName,
    last_initial: lastInitial,
    photo_url: existing?.photo_url ?? null,
    interests: INTERESTS.filter((i) => input.interests.includes(i)),
    neighborhoodId,
    alias: alias || null,
    joined_at: existing?.joined_at ?? new Date().toISOString(),
  };
  save(db);
  return toProfile(db.profiles[email]);
}

export async function uploadPhoto(token: string, photo: { uri: string; mimeType: string }): Promise<Profile> {
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) {
    throw new ApiError("profile_not_found", "You haven't finished joining yet.", 404);
  }
  db.profiles[email].photo_url = await shrinkPhoto(photo.uri);
  save(db);
  return toProfile(db.profiles[email]);
}

export async function getMyProfile(token: string): Promise<Profile> {
  await pause(250);
  const email = userFor(token);
  const stored = load().profiles[email];
  if (!stored) throw new ApiError("profile_not_found", "You haven't finished joining yet.", 404);
  return toProfile(stored);
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
