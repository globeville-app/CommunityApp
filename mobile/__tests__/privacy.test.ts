/** Guard rails that keep this milestone's privacy promises on the phone. */
import fs from "fs";
import path from "path";

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

it("has no general-purpose storage library that could hold the address", () => {
  // AsyncStorage is allowed only for the language preference (below).
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

it("uses AsyncStorage only in the language store, for language keys only", () => {
  const users = sourceFiles()
    .filter(([, source]) => /async-storage/.test(source))
    .map(([file]) => path.relative(path.join(__dirname, ".."), file));
  expect(users).toEqual([path.join("src", "i18n", "languageStorage.ts")]);

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
