/** Guard rails that keep this milestone's privacy promises on the phone. */
import fs from "fs";
import path from "path";

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

it("has no general-purpose storage library that could hold the address", () => {
  const storage = deps.filter((d) => /async-storage|mmkv|sqlite|expo-file-system|realm/i.test(d));
  expect(storage).toEqual([]);
});

it("has no analytics or crash-reporting SDKs", () => {
  const tracking = deps.filter((d) => /analytics|sentry|bugsnag|crashlytics|amplitude|segment|mixpanel/i.test(d));
  expect(tracking).toEqual([]);
});

it("the address screen never calls storage or console", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "app", "address.tsx"), "utf8");
  expect(source).not.toMatch(/SecureStore|AsyncStorage|console\./);
});
