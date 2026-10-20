/**
 * BROWSER DEMO ONLY. The real app runs on phones and uses api.ts, which
 * talks to the Django backend. In a web browser, the screens use this file
 * instead, which answers from a pretend backend inside the page
 * (src/demo/fakeBackend.ts and fakeEvents.ts). Same functions, same errors,
 * same shapes.
 */
import { AppConfig } from "./apiTypes";
import { APP_NAME } from "./config";
import { CATEGORY_GROUPS } from "./demo/fakeBackend";

export * from "./apiTypes";
export {
  confirmPasswordReset,
  deleteAccount,
  getMyProfile,
  login,
  logout,
  matchAddress,
  requestPasswordReset,
  resendVerification,
  saveProfile,
  sendProblemReport,
  signup,
  updateInterests,
  updateLanguage,
  uploadPhoto,
  verifyEmail,
} from "./demo/fakeBackend";
export {
  cancelEvent,
  createEvent,
  getEvent,
  listEvents,
  partifulPreview,
  reportEvent,
  setGoing,
  translateEvent,
  updateEvent,
} from "./demo/fakeEvents";
export {
  checkIn,
  collectEvent,
  declineEvent,
  getBadgeCatalog,
  getBlockedMembers,
  getCelebrations,
  getCollectCards,
  getGeofences,
  getImpact,
  getMember,
  getMyBadges,
  logShare,
  markCelebrationsSeen,
  markCheckinOfferSeen,
  setBlocked,
  updateProfileSettings,
} from "./demo/fakeBadges";
export {
  addOrganizationAdmin,
  getMyOrganizations,
  getOrganization,
  getOrganizationImpact,
  listNeighborhoods,
  listOrganizations,
  markNotifOfferSeen,
  registerPushToken,
  removeOrganizationAdmin,
  removePushToken,
  reportOrganization,
  requestOrganization,
  setFollowing,
  translateOrganization,
  updateOrganization,
  uploadOrganizationPhoto,
} from "./demo/fakeOrgs";

export async function getConfig(): Promise<AppConfig> {
  return {
    app_name: APP_NAME,
    languages: ["en", "es"],
    min_app_version: "",
    category_groups: CATEGORY_GROUPS,
    other_category: "other",
    other_max_length: 40,
    max_interests: 8,
  };
}
