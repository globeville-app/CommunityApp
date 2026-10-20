/**
 * Milestone 4 on the phone: the notification ask and Settings toggles,
 * requesting an organization, its page, Post as, Following. API mocked.
 */
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as Notifications from "expo-notifications";
import { Text } from "react-native";

import * as api from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { HIGHLAND_PROFILE, fakeStore, myBadges, renderApp, resetLanguage, sampleEvent } from "../test-utils/helpers";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;
const notifications = Notifications as unknown as { __setPermission: (status: string, canAskAgain?: boolean) => void };

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  fakeStore.set("auth_token", "tok-123");
  await resetLanguage();
  notifications.__setPermission("undetermined");
  useDefaultReplies(mocked);
});

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

async function useSpanish() {
  const settings = renderApp("/settings");
  await pressAndSettle(await screen.findByRole("radio", { name: "Español" }));
  settings.unmount();
}

function visibleText(): string[] {
  return screen.UNSAFE_getAllByType(Text).flatMap((node) => {
    const children = ([] as unknown[]).concat(node.props.children);
    return children.every((c) => typeof c === "string" || typeof c === "number") ? [children.join("")] : [];
  });
}

const CHURCH: api.OrgPage = {
  id: 5,
  name: "Our Lady Church",
  type: "faith",
  photo_url: null,
  description: "Mass, potlucks and a food pantry.",
  description_alt: "Misa, comidas y despensa.",
  language: "en",
  link: null,
  neighborhoods: [
    { id: 3, name: "Highland" },
    { id: 7, name: "Elyria Swansea" },
  ],
  badges: myBadges({ host: [2, 12] }).filter((b) => b.stage > 0),
  upcoming_events: [sampleEvent({ id: 21, title: "Parish potluck", organization: { id: 5, name: "Our Lady Church", type: "faith", has_page: true } })],
  past_event_count: 12,
  is_following: false,
  is_admin: false,
};

const ADMIN_VIEW: api.OrgPage = {
  ...CHURCH,
  is_admin: true,
  status: "approved",
  follower_count: 34,
  change_pending: false,
  admins: [{ member_id: 41, display_name: "Ana R.", is_you: true }],
};

const MY_CHURCH: api.MyOrg = {
  id: 5,
  name: "Our Lady Church",
  type: "faith",
  photo_url: null,
  status: "approved",
  neighborhoods: [
    { id: 7, name: "Elyria Swansea", center: { latitude: 39.78, longitude: -104.96 } },
    { id: 3, name: "Highland", center: { latitude: 39.76, longitude: -105.01 } },
  ],
};

// ---- Notifications ----------------------------------------------------------------

describe("the notification ask", () => {
  it("comes right after the auto check-in offer, once, and Not now keeps it off", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, checkin_offer_shown: false, notif_offer_shown: false });
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "I'm going" }));
    expect(await screen.findByText("We never see or store where you are.")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "Not now" }));
    expect(await screen.findByText("Get a reminder the day before events you're going to?")).toBeTruthy();
    expect(screen.getByText("We'll only notify you about events you said you're going to, or if one gets cancelled.")).toBeTruthy();
    expect(mocked.markNotifOfferSeen).toHaveBeenCalledWith("tok-123");
    await pressAndSettle(screen.getByRole("button", { name: "Not now" }));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.updateProfileSettings).not.toHaveBeenCalled();
  });

  it("shows on its own when the check-in offer was already seen, and Turn on asks the phone", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, notif_offer_shown: false });
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "I'm going" }));
    await pressAndSettle(await screen.findByRole("button", { name: "Turn on" }));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mocked.registerPushToken).toHaveBeenCalledWith("tok-123", "ExponentPushToken[test-phone]", "ios");
    expect(mocked.updateProfileSettings).toHaveBeenCalledWith("tok-123", { reminders_enabled: true, cancellation_alerts_enabled: true });
  });

  it("isn't shown once seen", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "I'm going" }));
    expect(screen.queryByText("Get a reminder the day before events you're going to?")).toBeNull();
  });
});

describe("notification settings", () => {
  it("turning reminders on asks the phone first, then saves", async () => {
    renderApp("/settings");
    const toggle = await screen.findByLabelText("Event reminders");
    await act(async () => {
      fireEvent(toggle, "valueChange", true);
    });
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(mocked.updateProfileSettings).toHaveBeenCalledWith("tok-123", { reminders_enabled: true });
  });

  it("cancellation alerts turn off", async () => {
    notifications.__setPermission("granted");
    renderApp("/settings");
    const toggle = await screen.findByLabelText("Cancellation alerts");
    await waitFor(() => expect(toggle).toHaveProp("value", true));
    await act(async () => {
      fireEvent(toggle, "valueChange", false);
    });
    expect(mocked.updateProfileSettings).toHaveBeenCalledWith("tok-123", { cancellation_alerts_enabled: false });
  });

  it("explains when the phone has notifications off, and opens its settings", async () => {
    const { Linking } = require("react-native");
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    notifications.__setPermission("denied", false);
    renderApp("/settings");
    expect(await screen.findByText("Notifications are off for this app in your phone's settings.")).toBeTruthy();
    expect(screen.getByLabelText("Event reminders")).toBeDisabled();
    await pressAndSettle(screen.getByRole("link", { name: "Open phone settings" }));
    expect(open).toHaveBeenCalled();
  });

  it("logging out forgets this phone", async () => {
    notifications.__setPermission("granted");
    mocked.logout.mockResolvedValue(undefined);
    renderApp("/settings");
    await pressAndSettle(await screen.findByRole("button", { name: "Log out" }));
    await pressAndSettle(screen.getAllByRole("button", { name: "Log out" }).at(-1)!);
    expect(mocked.logout).toHaveBeenCalledWith("tok-123", "ExponentPushToken[test-phone]");
  });
});

// ---- Organizations ------------------------------------------------------------------

describe("requesting an organization", () => {
  it("validates, shows the business rule, and thanks", async () => {
    mocked.requestOrganization.mockResolvedValue({ ...ADMIN_VIEW, status: "pending" });
    renderApp("/organization-form");
    const send = await screen.findByRole("button", { name: "Send request" });
    expect(send).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText("Organization name"), "Corner Cafe");
    fireEvent.press(screen.getByRole("checkbox", { name: "Business" }));
    expect(screen.getByText(/never sales, discounts or ads/i)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Find a neighborhood"), "high");
    fireEvent.press(screen.getByRole("checkbox", { name: "Highland" }));
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled(); // rule not agreed yet
    fireEvent.press(screen.getByRole("checkbox", { name: "I agree to this rule" }));
    await pressAndSettle(screen.getByRole("button", { name: "Send request" }));
    expect(mocked.requestOrganization).toHaveBeenCalledWith(
      "tok-123",
      expect.objectContaining({ name: "Corner Cafe", type: "business", neighborhoods: [3], business_rule_accepted: true }),
    );
    expect(await screen.findByText("Our team reviews new organizations, usually within a few days.")).toBeTruthy();
  });

  it("is reached from Settings → Your organizations", async () => {
    mocked.getMyOrganizations.mockResolvedValue({ organizations: [{ ...MY_CHURCH, status: "pending" }] });
    renderApp("/settings");
    await pressAndSettle(await screen.findByRole("button", { name: "Your organizations" }));
    expect(await screen.findByText("Faith community · Waiting for review")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Request an organization" })).toBeTruthy();
  });
});

describe("the organization page", () => {
  it("shows members the page with Follow, badges and events, and no admin tools", async () => {
    mocked.getOrganization.mockResolvedValue(CHURCH);
    mocked.setFollowing.mockResolvedValue({ is_following: true });
    renderApp("/organizations/5");
    expect(await screen.findByText("Our Lady Church")).toBeTruthy();
    expect(screen.getByText("Faith community")).toBeTruthy();
    expect(screen.getByText("Highland · Elyria Swansea")).toBeTruthy();
    expect(screen.getByText("Organization badges")).toBeTruthy();
    expect(screen.getByLabelText("Host, Sprout stage, 12 neighbors brought together.")).toBeTruthy();
    expect(screen.getByText("Parish potluck")).toBeTruthy();
    expect(screen.getByText("Past events: 12")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByText(/followers/)).toBeNull();
    await pressAndSettle(screen.getByRole("button", { name: "Follow" }));
    expect(mocked.setFollowing).toHaveBeenCalledWith("tok-123", 5, true);
    expect(screen.getByRole("button", { name: "Following · tap to unfollow" })).toBeTruthy();
  });

  it("gives admins Edit, Admins, Impact and the follower count", async () => {
    mocked.getOrganization.mockResolvedValue(ADMIN_VIEW);
    renderApp("/organizations/5");
    expect(await screen.findByText("34 followers (only admins see this)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Admins" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Organization impact" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Report" })).toBeNull();
  });

  it("is reached from Hosted by on an event", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ organization: { id: 5, name: "Our Lady Church", type: "faith", has_page: true }, organizer_name: null, organizer_member_id: null }));
    mocked.getOrganization.mockResolvedValue(CHURCH);
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "Hosted by Our Lady Church" }));
    expect(await screen.findByText("Past events: 12")).toBeTruthy();
  });

  it("shows the organization impact to admins", async () => {
    mocked.getOrganizationImpact.mockResolvedValue({
      impact: { brought_together: 48, first_timers: 12, came_back: 31, most_popular: { title: "Parish potluck", starts_at: "2026-10-12T17:00:00-06:00", attendee_count: 14 } },
      badges: myBadges({ host: [2, 12], fiestero: [1, 1] }).filter((b) => ["host", "fiestero", "clean_sweeper"].includes(b.key)),
    });
    renderApp("/organization-impact?id=5");
    expect(await screen.findByText("Your events brought together 48 neighbors.")).toBeTruthy();
    expect(screen.getByTestId("org-progress-fiestero")).toBeTruthy();
    expect(screen.getByTestId("org-progress-host")).toBeTruthy();
  });
});

describe("Post as", () => {
  it("is offered only to admins of an approved organization, and limits the neighborhoods", async () => {
    renderApp("/event-form");
    expect(await screen.findByText("What kind of event?")).toBeTruthy();
    expect(screen.queryByText("Post as")).toBeNull();
    screen.unmount();

    mocked.getMyOrganizations.mockResolvedValue({ organizations: [MY_CHURCH, { ...MY_CHURCH, id: 6, name: "New Club", status: "pending" }] });
    mocked.createEvent.mockResolvedValue(sampleEvent({ id: 42 }));
    mocked.getEvent.mockResolvedValue(sampleEvent({ id: 42 }));
    renderApp("/event-form");
    expect(await screen.findByText("Post as")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "New Club" })).toBeNull();
    fireEvent.press(screen.getByRole("checkbox", { name: "Our Lady Church" }));
    expect(await screen.findByText("Which neighborhood?")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Elyria Swansea" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Hale" })).toBeNull();
    fireEvent.press(screen.getByRole("checkbox", { name: "Elyria Swansea" }));
    fireEvent.press(await screen.findByRole("button", { name: "Community & Giving" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Cleanup" }));
    fireEvent.press(await screen.findByRole("link", { name: "Skip" }));
    expect(await screen.findByText("Posting as Our Lady Church in Elyria Swansea")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Title"), "Parish cleanup");
    fireEvent.changeText(screen.getByLabelText("Meeting spot"), "The parish hall");
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    await act(async () => {
      fireEvent(screen.getByTestId("pin-map"), "press", { nativeEvent: { coordinate: { latitude: 39.78, longitude: -104.96 } } });
    });
    await pressAndSettle(screen.getByRole("button", { name: "Post" }));
    expect(mocked.createEvent).toHaveBeenCalledWith(
      "tok-123",
      expect.objectContaining({ organization: 5, neighborhood: 7 }),
      expect.any(String),
    );
  });
});

describe("Following", () => {
  it("has a chip with an empty state, and tags followed organizations' events", async () => {
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Following" }));
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith("tok-123", { following: true, forYou: false, group: undefined }));
    expect(await screen.findByText("Follow organizations to see their events here.")).toBeTruthy();
    screen.unmount();

    mocked.listEvents.mockResolvedValue({
      events: [sampleEvent({ title: "Parish potluck", is_following: true, organization: { id: 5, name: "Our Lady Church", type: "faith", has_page: true } })],
    });
    renderApp();
    expect(await screen.findByText("Hosted by Our Lady Church")).toBeTruthy();
    expect(screen.getAllByText("Following").length).toBeGreaterThan(1); // the chip and the tag
  });
});

// ---- Inviting admins (review P8) -------------------------------------------------

describe("inviting admins", () => {
  it("sends an invitation and shows only a count of open ones", async () => {
    mocked.getOrganization.mockResolvedValue(ADMIN_VIEW);
    mocked.addOrganizationAdmin.mockResolvedValue({ ...ADMIN_VIEW, pending_invites: 1 });
    mocked.cancelOrganizationInvites.mockResolvedValue({ ...ADMIN_VIEW, pending_invites: 0 });
    renderApp("/organization-admins?id=5");

    fireEvent.changeText(await screen.findByLabelText("Their email (they need to have joined)"), "ben@example.com");
    await pressAndSettle(screen.getByRole("button", { name: "Send invitation" }));
    expect(mocked.addOrganizationAdmin).toHaveBeenCalledWith("tok-123", 5, "ben@example.com");
    expect(await screen.findByText(/Invitation sent/)).toBeTruthy();
    expect(screen.getByText("1 invitation waiting for an answer.")).toBeTruthy();

    await pressAndSettle(screen.getByRole("link", { name: "Cancel open invitations" }));
    expect(mocked.cancelOrganizationInvites).toHaveBeenCalledWith("tok-123", 5);
    expect(screen.queryByText("1 invitation waiting for an answer.")).toBeNull();
  });

  it("lets the invited member accept under Your organizations", async () => {
    mocked.getOrganizationInvites.mockResolvedValueOnce({ invites: [{ id: 9, organization: { id: 5, name: "Our Lady Church" } }] });
    mocked.answerOrganizationInvite.mockResolvedValue(undefined);
    renderApp("/my-organizations");
    expect(await screen.findByText("You're invited to help run Our Lady Church.")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "Accept" }));
    expect(mocked.answerOrganizationInvite).toHaveBeenCalledWith("tok-123", 9, true);
  });
});

// ---- Spanish --------------------------------------------------------------------

describe("in Spanish", () => {
  it.each(["/notif-offer", "/organization-form", "/organizations/5", "/my-organizations", "/organizations", "/organization-impact?id=5", "/organization-admins?id=5", "/settings"])(
    "%s has no missing words",
    async (path) => {
      mocked.getOrganization.mockResolvedValue(ADMIN_VIEW);
      mocked.getMyOrganizations.mockResolvedValue({ organizations: [MY_CHURCH] });
      mocked.listOrganizations.mockResolvedValue({ organizations: [CHURCH] });
      mocked.getOrganizationImpact.mockResolvedValue({ impact: {}, badges: myBadges({ host: [1, 2] }).filter((b) => b.key === "host") });
      await useSpanish();
      renderApp(path);
      await waitFor(() => expect(visibleText().length).toBeGreaterThan(3));
      expect(visibleText().filter((text) => /^[a-z_]+(\.[a-z_]+)+$/.test(text))).toEqual([]);
    },
  );

  it("reads in Spanish", async () => {
    mocked.getOrganization.mockResolvedValue(CHURCH);
    await useSpanish();
    renderApp("/organizations/5");
    expect(await screen.findByText("Comunidad de fe")).toBeTruthy();
    expect(screen.getByText("Misa, comidas y despensa.")).toBeTruthy(); // the admins' own Spanish
    expect(screen.getByText("Insignias de la organización")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Seguir" })).toBeTruthy();
  });
});
