/**
 * BROWSER DEMO ONLY: a pretend backend that runs inside the web page.
 *
 * It copies the real backend's rules and messages (see backend/). The
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
import { APP_NAME } from "../config";
import { ApiError, MatchResult, Profile, ProfileInput } from "../apiTypes";

// ---- Sample data -----------------------------------------------------------

export const INTERESTS = ["Block parties", "Food drives", "Cleanups", "Live music", "Gardening"];

type Ring = [number, number][]; // [longitude, latitude] points
type DemoNeighborhood = { id: number; name: string; rings: Ring[] };
type DemoData = { neighborhoods: DemoNeighborhood[]; aliases: Record<string, string[]> };

// Put into the page by scripts/build-web-demo.mjs.
const DATA: DemoData = (globalThis as { __DEMO_DATA__?: DemoData }).__DEMO_DATA__ ?? {
  neighborhoods: [],
  aliases: {},
};
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
/**
 * "39.75928, -105.01103" (as Google Maps and Apple Maps show a dropped pin)
 * → { lat, lon }. Also accepts the two numbers the other way round, since
 * Denver's longitude (about -105) can't be a latitude.
 */
export function parseMapPoint(text: string): { lat: number; lon: number } | null {
  const t = text.trim().toLowerCase();
  // "39.75928, -105.01103" or "(39.75928 -105.01103)"
  const plain = t.match(/^\(?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
  // "39.75928° N, 105.01103° W"
  const compass = t.match(/^(\d{1,3}(?:\.\d+)?)\s*°?\s*([ns])\s*,?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*([ew])$/);
  let lat: number;
  let lon: number;
  if (plain) {
    lat = Number(plain[1]);
    lon = Number(plain[2]);
    if (Math.abs(lat) > 90) [lat, lon] = [lon, lat];
  } else if (compass) {
    lat = Number(compass[1]) * (compass[2] === "s" ? -1 : 1);
    lon = Number(compass[3]) * (compass[4] === "w" ? -1 : 1);
  } else {
    return null;
  }
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

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

  const outside = () =>
    new ApiError("outside_denver", `${APP_NAME} is only in the City and County of Denver for now.`, 400);

  let neighborhood: DemoNeighborhood | undefined;
  const known = KNOWN_ADDRESSES.find((k) => text.startsWith(k.startsWith));
  const point = parseMapPoint(text);
  if (point) {
    // A map point pasted from Google/Apple Maps: real location, real boundaries.
    neighborhood = findNeighborhood(point.lat, point.lon);
    if (!neighborhood) throw outside();
  } else if (known) {
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
    throw new ApiError("no_match", "We couldn't find that address. Check the spelling and try again.", 400);
  }

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
