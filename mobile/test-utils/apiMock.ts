/**
 * One fake API for the screen tests: every call that talks to the server is
 * a jest.fn(). Use in a test file with:
 *
 *   jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());
 *
 * then `useDefaultReplies(mocked)` in beforeEach.
 */
import type * as Api from "../src/api";
import { CATALOG, CONFIG, HIGHLAND_PROFILE, myBadges } from "./data";

const SERVER_CALLS = [
  "getConfig",
  "signup",
  "login",
  "logout",
  "requestPasswordReset",
  "confirmPasswordReset",
  "verifyEmail",
  "resendVerification",
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
  "updateProfileSettings",
  "getBadgeCatalog",
  "getMyBadges",
  "getMember",
  "setBlocked",
  "getBlockedMembers",
  "getCollectCards",
  "collectEvent",
  "declineEvent",
  "checkIn",
  "getGeofences",
  "getImpact",
  "getCelebrations",
  "markCelebrationsSeen",
  "logShare",
  "markCheckinOfferSeen",
  "registerPushToken",
  "removePushToken",
  "markNotifOfferSeen",
  "listNeighborhoods",
  "listOrganizations",
  "getMyOrganizations",
  "requestOrganization",
  "getOrganization",
  "updateOrganization",
  "uploadOrganizationPhoto",
  "addOrganizationAdmin",
  "cancelOrganizationInvites",
  "getOrganizationInvites",
  "answerOrganizationInvite",
  "removeOrganizationAdmin",
  "setFollowing",
  "reportOrganization",
  "translateOrganization",
  "getOrganizationImpact",
  "getInvite",
  "resetInvite",
  "logInviteShare",
  "openInvite",
  "getGuests",
  "removeGuest",
  "claimBadge",
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
  mocked.getBadgeCatalog.mockResolvedValue(CATALOG);
  mocked.getMyBadges.mockResolvedValue({ badges: myBadges() });
  mocked.getCollectCards.mockResolvedValue({ cards: [], show_checkin_reoffer: false });
  mocked.getImpact.mockResolvedValue({});
  mocked.getCelebrations.mockResolvedValue({ celebrations: [] });
  mocked.markCelebrationsSeen.mockResolvedValue(undefined);
  mocked.getGeofences.mockResolvedValue({ geofences: [] });
  mocked.markCheckinOfferSeen.mockResolvedValue(undefined);
  mocked.logShare.mockResolvedValue(undefined);
  mocked.declineEvent.mockResolvedValue(undefined);
  mocked.registerPushToken.mockResolvedValue(undefined);
  mocked.markNotifOfferSeen.mockResolvedValue(undefined);
  mocked.getMyOrganizations.mockResolvedValue({ organizations: [] });
  mocked.getOrganizationInvites.mockResolvedValue({ invites: [] });
  mocked.listOrganizations.mockResolvedValue({ organizations: [] });
  mocked.listNeighborhoods.mockResolvedValue({
    neighborhoods: [
      { id: 7, name: "Elyria Swansea" },
      { id: 1, name: "Hale" },
      { id: 3, name: "Highland" },
    ],
  });
  mocked.getInvite.mockImplementation(async (_token, id) => ({
    code: "Abc234defG",
    url: "https://globeville.app/e/Abc234defG",
    message: `Come to the event ${id}! RSVP here: https://globeville.app/e/Abc234defG`,
  }));
  mocked.logInviteShare.mockResolvedValue(undefined);
  mocked.updateProfileSettings.mockImplementation(async (_token, settings) => ({ ...HIGHLAND_PROFILE, ...settings }));
}
