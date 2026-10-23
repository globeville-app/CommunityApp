/** Guard rails that keep this milestone's privacy promises on the phone. */
import fs from "fs";
import path from "path";

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

it("has no general-purpose storage library that could hold the address", () => {
  // AsyncStorage is allowed only for the language and maps app preferences (below).
  const storage = deps.filter((d) => /mmkv|sqlite|expo-file-system|realm/i.test(d));
  expect(storage).toEqual([]);
});

/** Every source file under src/, as [path, contents]. */
function sourceFiles(dir = path.join(__dirname, "..", "src")): [string, string][] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [[full, fs.readFileSync(full, "utf8")] as [string, string]] : [];
  });
}

it("uses AsyncStorage only for the language and the maps app choice", () => {
  const users = sourceFiles()
    .filter(([, source]) => /async-storage/.test(source))
    .map(([file]) => path.relative(path.join(__dirname, ".."), file));
  expect(users.sort()).toEqual([path.join("src", "i18n", "languageStorage.ts"), path.join("src", "maps", "mapsPreference.ts")]);

  // The maps app choice: one fixed key, holding just an app name.
  const maps = fs.readFileSync(path.join(__dirname, "..", "src", "maps", "mapsPreference.ts"), "utf8");
  expect([...maps.matchAll(/KEY = "([^"]+)"/g)].map((m) => m[1])).toEqual(["maps.app"]);
  for (const write of maps.matchAll(/setItem\(([^)]*)/g)) expect(write[1]).toMatch(/^KEY, app$/);

  const source = fs.readFileSync(path.join(__dirname, "..", "src", "i18n", "languageStorage.ts"), "utf8");
  const keys = [...source.matchAll(/_KEY = "([^"]+)"/g)].map((m) => m[1]);
  expect(keys.sort()).toEqual(["app.language", "app.language_source", "app.language_unsynced"]);
  // Writes only ever use those named keys, never a computed one.
  for (const write of source.matchAll(/(setItem|multiSet)\(([^)]*)/g)) {
    expect(write[2]).toMatch(/^\s*(\[\s*)?\[?\s*[A-Z_]+_KEY/);
  }
});

it("has no analytics or crash-reporting SDKs", () => {
  const tracking = deps.filter((d) => /analytics|sentry|bugsnag|crashlytics|amplitude|segment|mixpanel/i.test(d));
  expect(tracking).toEqual([]);
});

it("the address screen never calls storage or console", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", "address.tsx"), "utf8");
  expect(source).not.toMatch(/SecureStore|AsyncStorage|console\./);
});

it("auto check-in never sends or keeps a location", () => {
  const api = fs.readFileSync(path.join(__dirname, "..", "src", "api.ts"), "utf8");
  // The check-in request has no body at all.
  const checkIn = api.match(/export function checkIn[\s\S]*?\n}/)![0];
  expect(checkIn).not.toMatch(/json|form|latitude|longitude|coords/);

  const geofencing = fs.readFileSync(path.join(__dirname, "..", "src", "checkin", "geofencing.ts"), "utf8");
  // Never reads where the phone is; only the OS's "entered event X" signal.
  expect(geofencing).not.toMatch(/getCurrentPositionAsync|watchPositionAsync|getLastKnownPositionAsync|startLocationUpdatesAsync/);
  expect(geofencing).not.toMatch(/AsyncStorage|SecureStore\.set|console\./);
});

it("never asks for the phone's contacts (Milestone 5: invites go through the share sheet)", () => {
  expect(deps).not.toContain("expo-contacts");
  expect(deps.filter((d) => /contacts/i.test(d))).toEqual([]);
  for (const [file, source] of sourceFiles()) {
    expect([file, /expo-contacts|READ_CONTACTS|NSContactsUsageDescription/.test(source)]).toEqual([file, false]);
  }
  const config = fs.readFileSync(path.join(__dirname, "..", "app.config.ts"), "utf8");
  expect(config).not.toMatch(/contacts/i);
});
