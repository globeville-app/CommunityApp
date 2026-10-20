/** "Please update" when the server says this version is too old (review P7). */
import { screen } from "expo-router/testing-library";

import * as api from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { CONFIG, fakeStore, renderApp, resetLanguage } from "../test-utils/helpers";
import { isOlderThan } from "../src/version";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  await resetLanguage();
  useDefaultReplies(mocked);
});

it("compares versions number by number", () => {
  expect(isOlderThan("1.0.0", "")).toBe(false);
  expect(isOlderThan("1.0.0", "1.0.1")).toBe(true);
  expect(isOlderThan("1.10.0", "1.9.0")).toBe(false);
  expect(isOlderThan("1.2", "1.2.0")).toBe(false);
  expect(isOlderThan("2.0.0", "10.0.0")).toBe(true);
});

it("shows the update screen instead of the app when too old", async () => {
  mocked.getConfig.mockResolvedValue({ ...CONFIG, min_app_version: "99.0.0" });
  renderApp();
  expect(await screen.findByText("Time to update")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Sign up" })).toBeNull();
});

it("opens normally when the version is new enough", async () => {
  mocked.getConfig.mockResolvedValue({ ...CONFIG, min_app_version: "0.0.1" });
  renderApp();
  expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
  expect(screen.queryByText("Time to update")).toBeNull();
});
