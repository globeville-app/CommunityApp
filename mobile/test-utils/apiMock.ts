/**
 * One fake API for the screen tests: every call that talks to the server is
 * a jest.fn(). Use in a test file with:
 *
 *   jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());
 *
 * then `useDefaultReplies(mocked)` in beforeEach.
 */
import type * as Api from "../src/api";
import { CONFIG, HIGHLAND_PROFILE } from "./data";

const SERVER_CALLS = [
  "getConfig",
  "signup",
  "login",
  "logout",
  "matchAddress",
  "saveProfile",
  "uploadPhoto",
  "getMyProfile",
  "updateLanguage",
  "updateInterests",
  "sendProblemReport",
  "deleteAccount",
  "listEvents",
  "getEvent",
  "createEvent",
  "updateEvent",
  "cancelEvent",
  "setGoing",
  "reportEvent",
  "partifulPreview",
  "translateEvent",
] as const;

export function fakeApi() {
  const actual = jest.requireActual("../src/api");
  return { ...actual, ...Object.fromEntries(SERVER_CALLS.map((name) => [name, jest.fn()])) };
}

/** Sensible answers; each test overrides what it cares about. */
export function useDefaultReplies(mocked: jest.Mocked<typeof Api>) {
  mocked.getConfig.mockResolvedValue(CONFIG);
  mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
  mocked.updateLanguage.mockImplementation(async (_token, language) => ({ language }));
  mocked.updateInterests.mockImplementation(async (_token, interests) => ({ ...HIGHLAND_PROFILE, interests }));
  mocked.listEvents.mockResolvedValue({ events: [] });
  mocked.logout.mockResolvedValue(undefined);
}
