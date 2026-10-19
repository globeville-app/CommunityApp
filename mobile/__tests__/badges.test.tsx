/**
 * Milestone 3 on the phone: the <Badge> drawing, the map pin step, the
 * "Open in" sheet, auto check-in (offer, re-offer, Settings, geofences),
 * My Impact, the unlock moment and the share card. The API is mocked.
 */
import { render } from "@testing-library/react-native";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as Location from "expo-location";
import { AccessibilityInfo, Linking, Text } from "react-native";

import * as api from "../src/api";
import { canCelebrateOn } from "../src/components/AppWatchers";
import { Badge } from "../src/components/badges/Badge";
import { GEOFENCE_TASK, fenceId, onGeofenceEvent, syncGeofences } from "../src/checkin/geofencing";
import i18n from "../src/i18n";
import { useDefaultReplies } from "../test-utils/apiMock";
import { HIGHLAND_PROFILE, fakeStore, myBadges, renderApp, resetLanguage, sampleEvent } from "../test-utils/helpers";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;
const location = Location as unknown as {
  __setPermission: (p: { granted: boolean; canAskAgain: boolean }) => void;
  __watched: () => { task: string; regions: { identifier: string }[] } | null;
  __reset: () => void;
};

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  fakeStore.set("auth_token", "tok-123");
  await resetLanguage();
  await i18n.changeLanguage("en");
  location.__reset();
  useDefaultReplies(mocked);
  jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
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

function expectNoMissingKeys() {
  // (The invite link, globeville.app, looks like a key but isn't one.)
  expect(visibleText().filter((text) => /^[a-z_]+(\.[a-z_]+)+$/.test(text) && text !== "globeville.app")).toEqual([]);
}

const HOUR = 60 * 60 * 1000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

// ---- <Badge> -----------------------------------------------------------------------

describe("<Badge>", () => {
  it.each([1, 2, 3, 4, 5])("draws stage %i with the ring filled that far, at large and profile sizes", (stage) => {
    for (const size of [160, 72]) {
      const view = render(<Badge badgeKey="clean_sweeper" kind="growth" stage={stage} count={5} size={size} />);
      expect(view.getByTestId(`badge-arc-${stage}`)).toBeTruthy();
      expect(view.getByTestId("badge-pip")).toBeTruthy();
      view.unmount();
    }
  });

  it("has no pip at list size, the ring alone shows the stage", () => {
    render(<Badge badgeKey="local" kind="growth" stage={2} count={3} size={40} />);
    expect(screen.getByTestId("badge-arc-2")).toBeTruthy();
    expect(screen.queryByTestId("badge-pip")).toBeNull();
  });

  it("speaks the stage and count in English and Spanish", async () => {
    const view = render(<Badge badgeKey="clean_sweeper" kind="growth" stage={3} count={5} size={160} />);
    expect(screen.getByLabelText("Clean Sweeper, Bloom stage, 5 cleanups.")).toBeTruthy();
    view.unmount();
    await act(async () => {
      await i18n.changeLanguage("es");
    });
    render(<Badge badgeKey="clean_sweeper" kind="growth" stage={3} count={5} size={160} />);
    expect(screen.getByLabelText("Escobita, etapa Flor, 5 limpiezas.")).toBeTruthy();
  });

  it("uses singular units for 1", () => {
    render(<Badge badgeKey="local" kind="growth" stage={1} count={1} size={72} />);
    expect(screen.getByLabelText("Local, Seed stage, 1 event.")).toBeTruthy();
  });

  it("draws keepsakes with a stamp and no ring, and says earned", async () => {
    render(<Badge badgeKey="ambassador" kind="keepsake" stage={1} size={160} />);
    expect(screen.getByLabelText("Ambassador, earned.")).toBeTruthy();
    expect(screen.queryByTestId("badge-pip")).toBeNull();
    await act(async () => {
      await i18n.changeLanguage("es");
    });
    expect(screen.getByLabelText("Embajador, obtenida.")).toBeTruthy();
  });

  it("dims unearned badges and reads their description", () => {
    render(<Badge badgeKey="year_rounder" kind="keepsake" stage={0} size={120} />);
    expect(screen.getByLabelText("Year-Rounder, not earned yet. Show up in every season of the year.")).toBeTruthy();
  });
});

// ---- The map pin --------------------------------------------------------------------

describe("the map pin", () => {
  it("is required before posting", async () => {
    renderApp("/event-form");
    fireEvent.press(await screen.findByRole("button", { name: "Community & Giving" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Cleanup" }));
    fireEvent.press(await screen.findByRole("link", { name: "Skip" }));
    fireEvent.changeText(await screen.findByLabelText("Title"), "Cleanup");
    fireEvent.changeText(screen.getByLabelText("Meeting spot"), "The park");
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
    await act(async () => {
      fireEvent(screen.getByTestId("pin-map"), "press", { nativeEvent: { coordinate: { latitude: 39.76, longitude: -105.01 } } });
    });
    expect(screen.getByRole("button", { name: "Post" })).toBeEnabled();
  });

  it("asks the organizer of an upcoming pinless event to add one", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ is_organizer: true, latitude: null, longitude: null, needs_pin: true }));
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "Add a map pin" }));
    expect(await screen.findByRole("header", { name: "Where exactly?" })).toBeTruthy();
  });

  it("isn't asked of neighbors", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ latitude: null, longitude: null, needs_pin: false }));
    renderApp("/event/7");
    expect(await screen.findByText("Posted by Ben R.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a map pin" })).toBeNull();
  });
});

// ---- Getting there ------------------------------------------------------------------

describe("the Open in sheet", () => {
  const installed = (...schemes: string[]) =>
    (Linking.canOpenURL as jest.Mock).mockImplementation(async (url: string) => schemes.some((s) => url.startsWith(s)));

  async function tapLocation() {
    mocked.getEvent.mockResolvedValue(sampleEvent());
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "Directions to Corner of 32nd and Lowell" }));
  }

  it("lists only installed apps (Apple Maps is always on iPhone)", async () => {
    installed("comgooglemaps://");
    await tapLocation();
    expect(await screen.findByText("Open in")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apple Maps" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google Maps" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Waze" })).toBeNull();
    await pressAndSettle(screen.getByRole("button", { name: "Google Maps" }));
    expect(Linking.openURL).toHaveBeenCalledWith("https://www.google.com/maps/search/?api=1&query=39.7615,-105.0112");
  });

  it("opens directly when only one app is installed", async () => {
    await tapLocation();
    expect(Linking.openURL).toHaveBeenCalledWith("https://maps.apple.com/?ll=39.7615,-105.0112&q=Corner%20of%2032nd%20and%20Lowell");
    expect(screen.queryByText("Open in")).toBeNull();
  });

  it("Remember my choice skips the sheet, and Settings resets it", async () => {
    installed("comgooglemaps://", "waze://");
    await tapLocation();
    fireEvent.press(await screen.findByRole("checkbox", { name: "Remember my choice" }));
    await pressAndSettle(screen.getByRole("button", { name: "Waze" }));
    expect(Linking.openURL).toHaveBeenLastCalledWith("https://waze.com/ul?ll=39.7615,-105.0112&navigate=yes");
    screen.unmount();

    (Linking.openURL as jest.Mock).mockClear();
    await tapLocation();
    expect(Linking.openURL).toHaveBeenCalledWith("https://waze.com/ul?ll=39.7615,-105.0112&navigate=yes");
    expect(screen.queryByText("Open in")).toBeNull();
    screen.unmount();

    renderApp("/settings");
    expect(await screen.findByText("Waze")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "Maps app" }));
    await pressAndSettle(await screen.findByRole("checkbox", { name: "Ask every time" }));
    screen.unmount();

    await tapLocation();
    expect(await screen.findByText("Open in")).toBeTruthy();
  });

  it("searches for the typed spot when there's no pin", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ latitude: null, longitude: null }));
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "Directions to Corner of 32nd and Lowell" }));
    expect(Linking.openURL).toHaveBeenCalledWith("https://maps.apple.com/?q=Corner%20of%2032nd%20and%20Lowell%2C%20Denver%2C%20CO");
  });
});

// ---- Auto check-in -------------------------------------------------------------------

describe("auto check-in", () => {
  it("is offered once, on the first I'm going, and Not now keeps it off", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, checkin_offer_shown: false });
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "I'm going" }));
    expect(await screen.findByText("Your phone notices when you arrive at events you're going to, and your badge grows on its own.")).toBeTruthy();
    expect(screen.getByText("We never see or store where you are.")).toBeTruthy();
    expect(mocked.markCheckinOfferSeen).toHaveBeenCalledWith("tok-123", "first");
    await pressAndSettle(screen.getByRole("button", { name: "Not now" }));
    expect(mocked.updateProfileSettings).not.toHaveBeenCalled();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("isn't offered again once seen", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "I'm going" }));
    expect(screen.getByText("13 neighbors going")).toBeTruthy();
    expect(screen.queryByText("We never see or store where you are.")).toBeNull();
  });

  it("the Settings toggle explains first, then asks for Always, then saves it", async () => {
    location.__setPermission({ granted: true, canAskAgain: true });
    renderApp("/settings");
    const toggle = await screen.findByLabelText("Auto check-in");
    await act(async () => {
      fireEvent(toggle, "valueChange", true);
    });
    expect(await screen.findByText("We never see or store where you are.")).toBeTruthy();
    expect(Location.requestBackgroundPermissionsAsync).not.toHaveBeenCalled();
    await pressAndSettle(screen.getByRole("button", { name: "Turn on" }));
    expect(Location.requestBackgroundPermissionsAsync).toHaveBeenCalled();
    expect(mocked.updateProfileSettings).toHaveBeenCalledWith("tok-123", { auto_checkin: true });
  });

  it("stays off when the permission is declined", async () => {
    location.__setPermission({ granted: false, canAskAgain: true });
    renderApp("/checkin-offer?which=settings");
    await pressAndSettle(await screen.findByRole("button", { name: "Turn on" }));
    expect(await screen.findByText("Auto check-in stays off. You can still collect after each event.")).toBeTruthy();
    expect(mocked.updateProfileSettings).not.toHaveBeenCalled();
  });

  it("turns off from Settings", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, auto_checkin: true });
    renderApp("/settings");
    await waitFor(() => expect(screen.getByLabelText("Auto check-in")).toHaveProp("value", true));
    await act(async () => {
      fireEvent(screen.getByLabelText("Auto check-in"), "valueChange", false);
    });
    expect(mocked.updateProfileSettings).toHaveBeenCalledWith("tok-123", { auto_checkin: false });
  });
});

describe("geofences", () => {
  const fence = (id: number, startsInHours: number) => ({
    event_id: id,
    latitude: 39.76,
    longitude: -105.01,
    radius_meters: 150,
    opens_at: iso(startsInHours * HOUR - 30 * 60 * 1000),
    closes_at: iso((startsInHours + 2) * HOUR),
  });

  it("registers the next 20, only while on and allowed", async () => {
    location.__setPermission({ granted: true, canAskAgain: true });
    mocked.getGeofences.mockResolvedValue({ geofences: Array.from({ length: 25 }, (_, i) => fence(i + 1, i + 1)) });
    await syncGeofences("tok", true);
    const watched = location.__watched()!;
    expect(watched.task).toBe(GEOFENCE_TASK);
    expect(watched.regions).toHaveLength(20);
    expect(watched.regions[0]).toEqual(expect.objectContaining({ latitude: 39.76, longitude: -105.01, radius: 150, notifyOnEnter: true }));

    await syncGeofences("tok", false);
    expect(location.__watched()).toBeNull();
  });

  it("drops passed and cancelled events and ones no longer going", async () => {
    location.__setPermission({ granted: true, canAskAgain: true });
    mocked.getGeofences.mockResolvedValue({ geofences: [fence(1, 3), fence(2, -5)] });
    await syncGeofences("tok", true);
    expect(location.__watched()!.regions.map((r) => r.identifier)).toEqual([expect.stringMatching(/^event\|1\|/)]);
    // The server leaves out cancelled events and ones you're not going to.
    mocked.getGeofences.mockResolvedValue({ geofences: [] });
    await syncGeofences("tok", true);
    expect(location.__watched()).toBeNull();
  });

  it("does nothing without the Always permission", async () => {
    mocked.getGeofences.mockResolvedValue({ geofences: [fence(1, 3)] });
    await syncGeofences("tok", true);
    expect(location.__watched()).toBeNull();
    expect(mocked.getGeofences).not.toHaveBeenCalled();
  });

  it("checks in with no location, only inside the window", async () => {
    mocked.checkIn.mockResolvedValue({ celebrations: [] });
    const region = (opens: number, closes: number) => ({
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: fenceId(9, iso(opens), iso(closes)), latitude: 39.76, longitude: -105.01, radius: 150 },
    });
    await onGeofenceEvent({ data: region(-HOUR, HOUR), error: null, executionInfo: { eventId: "1", taskName: GEOFENCE_TASK } });
    expect(mocked.checkIn).toHaveBeenCalledWith("tok-123", 9);
    expect(mocked.checkIn.mock.calls[0]).toHaveLength(2);

    mocked.checkIn.mockClear();
    await onGeofenceEvent({ data: region(HOUR, 3 * HOUR), error: null, executionInfo: { eventId: "2", taskName: GEOFENCE_TASK } });
    expect(mocked.checkIn).not.toHaveBeenCalled();
  });
});

// ---- My Impact -----------------------------------------------------------------------

describe("My Impact", () => {
  const card = (overrides: Partial<api.CollectCard> = {}): api.CollectCard => ({
    event_id: 11,
    title: "Alley Cleanup",
    title_alt: null,
    language: "en",
    category: "cleanup",
    starts_at: "2026-10-12T09:00:00-06:00",
    collect_until: "2026-10-19T11:00:00-06:00",
    grows: [
      { badge: "local", stage: 1, count: 1, next_threshold: 3 },
      { badge: "clean_sweeper", stage: 1, count: 1, next_threshold: 2 },
    ],
    ...overrides,
  });

  it("shows collect cards, and Collect records it", async () => {
    mocked.getCollectCards.mockResolvedValue({ cards: [card()], show_checkin_reoffer: false });
    mocked.collectEvent.mockResolvedValue({ celebrations: [] });
    renderApp("/impact");
    expect(await screen.findByText("Alley Cleanup")).toBeTruthy();
    expect(screen.getByText("Ready to collect")).toBeTruthy();
    expect(screen.getByText("1 more to Sprout")).toBeTruthy();
    mocked.getCollectCards.mockResolvedValue({ cards: [], show_checkin_reoffer: false });
    await pressAndSettle(screen.getByRole("button", { name: "Collect" }));
    expect(mocked.collectEvent).toHaveBeenCalledWith("tok-123", 11);
    await waitFor(() => expect(screen.queryByText("Alley Cleanup")).toBeNull());
  });

  it("I didn't make it dismisses the card", async () => {
    mocked.getCollectCards.mockResolvedValue({ cards: [card()], show_checkin_reoffer: false });
    renderApp("/impact");
    await pressAndSettle(await screen.findByRole("button", { name: "I didn't make it" }));
    expect(mocked.declineEvent).toHaveBeenCalledWith("tok-123", 11);
    expect(screen.queryByText("Alley Cleanup")).toBeNull();
  });

  it("sorts progress closest to the next stage first", async () => {
    mocked.getMyBadges.mockResolvedValue({
      badges: myBadges({ local: [2, 4], clean_sweeper: [1, 1], best_guest: [1, 3], fiestero: [3, 9] }),
    });
    renderApp("/impact");
    await screen.findByText("Badge progress");
    const order = screen.getAllByTestId(/^progress-/).map((node) => node.props.testID);
    // 1 to go (fiestero 9/10, clean sweeper 1/2, best guest 3/4), then local 4/9.
    expect(order).toEqual(["progress-fiestero", "progress-best_guest", "progress-clean_sweeper", "progress-local"]);
  });

  it("never names a sensitive category in a hint", async () => {
    mocked.getCollectCards.mockResolvedValue({ cards: [card({ title: "Fall drive", category: "donation_drive", grows: [] })], show_checkin_reoffer: false });
    mocked.getMyBadges.mockResolvedValue({ badges: myBadges({ helping_hand: [2, 3] }) });
    renderApp("/impact");
    expect(await screen.findByText("Fall drive")).toBeTruthy();
    const text = visibleText().join(" ");
    expect(text).not.toMatch(/resource fair|donation drive|Resource|Donation/i);
    expect(text).toContain("2 more to Bloom");
  });

  it("shows the host section only after a counted hosted event", async () => {
    renderApp("/impact");
    await screen.findByText("Only you can see this.");
    expect(screen.queryByText("Your impact as a host")).toBeNull();
    screen.unmount();

    mocked.getImpact.mockResolvedValue({
      brought_together: 48,
      first_timers: 12,
      came_back: 31,
      most_popular: { title: "Alley Cleanup", starts_at: "2026-10-12T09:00:00-06:00", attendee_count: 14 },
    });
    renderApp("/impact");
    expect(await screen.findByText("Your impact as a host")).toBeTruthy();
    expect(screen.getByText("Your events brought together 48 neighbors.")).toBeTruthy();
    expect(screen.getByText("12 of them were at their first event in the neighborhood.")).toBeTruthy();
    expect(screen.getByText("31 came back to another neighborhood event.")).toBeTruthy();
    expect(screen.getByText(/Your most popular: Alley Cleanup, .*, with 14 neighbors\./)).toBeTruthy();
  });

  it("shows the re-offer card once, and either button removes it for good", async () => {
    for (const button of ["No thanks", "Turn on"]) {
      jest.clearAllMocks();
      useDefaultReplies(mocked);
      mocked.getCollectCards.mockResolvedValue({ cards: [], show_checkin_reoffer: true });
      renderApp("/impact");
      expect(await screen.findByText("Missed a few? Auto check-in can collect for you.")).toBeTruthy();
      await pressAndSettle(screen.getByRole("button", { name: button }));
      expect(mocked.markCheckinOfferSeen).toHaveBeenCalledWith("tok-123", "reoffer");
      expect(screen.queryByText("Missed a few? Auto check-in can collect for you.")).toBeNull();
      screen.unmount();
    }
  });
});

// ---- Profile, member page, See all --------------------------------------------------

describe("badges on profiles", () => {
  it("the Profile shows earned badges, opening the detail", async () => {
    mocked.getMyBadges.mockResolvedValue({ badges: myBadges({ clean_sweeper: [3, 5] }) });
    renderApp("/profile");
    await pressAndSettle(await screen.findByRole("button", { name: "Clean Sweeper, Bloom stage, 5 cleanups." }));
    expect(await screen.findByText("5 cleanups")).toBeTruthy();
    expect(screen.getByText("Help clean up the neighborhood.")).toBeTruthy();
    expect(screen.getByText("5 more to Tree")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  });

  it("a neighbor's page shows their badges, and none when they chose Only me", async () => {
    const page = {
      id: 52,
      display_name: "Ben R.",
      photo_url: null,
      neighborhood: { id: 3, name: "Highland" },
      alias: null,
      member_since: "2026-03-14",
      badges: myBadges({ host: [2, 12] }).filter((b) => b.stage > 0),
    };
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.getMember.mockResolvedValue(page);
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("button", { name: "Posted by Ben R." }));
    expect(await screen.findByText(/Member since/)).toBeTruthy();
    expect(screen.getByLabelText("Host, Sprout stage, 12 neighbors brought together.")).toBeTruthy();
    expect(screen.queryByText("My Impact")).toBeNull();
    screen.unmount();

    mocked.getMember.mockResolvedValue({ ...page, badges: [] });
    renderApp("/member/52");
    expect(await screen.findByText(/Member since/)).toBeTruthy();
    expect(screen.queryByText("Badges")).toBeNull();
  });

  it("See all shows every badge, earned with a stage and unearned with the description", async () => {
    mocked.getMyBadges.mockResolvedValue({ badges: myBadges({ local: [2, 3], ambassador: [1, 0] }) });
    renderApp("/badges");
    expect(await screen.findByText("Growth badges")).toBeTruthy();
    expect(screen.getByText("Keepsakes")).toBeTruthy();
    expect(screen.getAllByTestId(/^badge-/).filter((n) => /^badge-[a-z_]+$/.test(n.props.testID) && !/arc|pip/.test(n.props.testID))).toHaveLength(15);
    expect(screen.getByText("Sprout")).toBeTruthy();
    expect(screen.getByText("Show up in every season of the year.")).toBeTruthy();
    expect(screen.getByLabelText("Ambassador, earned.")).toBeTruthy();
  });
});

// ---- Unlock moments and sharing -----------------------------------------------------

describe("the unlock moment", () => {
  const celebrations: api.Celebration[] = [
    { id: 1, badge_key: "clean_sweeper", kind: "earned", stage: 1, count: 1 },
    { id: 2, badge_key: "local", kind: "stage_up", stage: 2, count: 3 },
    { id: 3, badge_key: "local", kind: "grove_milestone", stage: 5, count: 120 },
  ];

  it("groups several into one moment and marks them seen", async () => {
    mocked.getCelebrations.mockResolvedValue({ celebrations });
    mocked.getMyBadges.mockResolvedValue({ badges: myBadges({ clean_sweeper: [1, 1], local: [2, 3] }) });
    renderApp("/events");
    expect(await screen.findByText("3 badges grew 🌱")).toBeTruthy();
    expect(screen.getByText("You earned Clean Sweeper!")).toBeTruthy();
    expect(screen.getByText("Local grew to Sprout!")).toBeTruthy();
    expect(screen.getByText("Local: 120 events!")).toBeTruthy();
    expect(screen.getAllByTestId("badge-animated")).toHaveLength(3);
    mocked.getCelebrations.mockResolvedValue({ celebrations: [] });
    await pressAndSettle(screen.getAllByRole("link", { name: "Not now" })[0]);
    expect(mocked.markCelebrationsSeen).toHaveBeenCalledWith("tok-123", [1, 2, 3]);
  });

  it("is still when reduce-motion is on", async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
    mocked.getCelebrations.mockResolvedValue({ celebrations: [celebrations[0]] });
    renderApp("/celebrate");
    expect(await screen.findByText("You earned Clean Sweeper!")).toBeTruthy();
    expect(screen.getByTestId("badge-still")).toBeTruthy();
    expect(screen.queryByTestId("badge-animated")).toBeNull();
  });

  it("never appears mid-post", async () => {
    mocked.getCelebrations.mockResolvedValue({ celebrations });
    expect(canCelebrateOn("/event-form")).toBe(false);
    expect(canCelebrateOn("/events")).toBe(true);
    renderApp("/event-form");
    expect(await screen.findByText("Celebrate")).toBeTruthy();
    expect(mocked.getCelebrations).not.toHaveBeenCalled();
    expect(screen.queryByText("3 badges grew 🌱")).toBeNull();
  });
});

describe("the share card", () => {
  const mine = { badges: myBadges({ clean_sweeper: [3, 5] }) };

  it("shows the first name only, never the last name or photo, and the neighborhood toggle works", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, photo_url: "https://example.org/ana.jpg" });
    mocked.getMyBadges.mockResolvedValue(mine);
    renderApp("/share/clean_sweeper");
    expect((await screen.findAllByText("Ana earned")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("5 cleanups in LoHi (Highland)").length).toBeGreaterThan(0);
    const text = visibleText().join(" ");
    expect(text).not.toMatch(/Ana R\b|R\./);
    expect(screen.queryByLabelText("Profile photo")).toBeNull();

    await act(async () => {
      fireEvent(screen.getByLabelText("Show my neighborhood"), "valueChange", false);
    });
    expect(screen.queryByText("5 cleanups in LoHi (Highland)")).toBeNull();
    expect(screen.getAllByText("5 cleanups").length).toBeGreaterThan(0);
  });

  it("Share opens the share sheet with the message, then counts the share", async () => {
    const { Share } = require("react-native");
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    mocked.getMyBadges.mockResolvedValue(mine);
    renderApp("/share/clean_sweeper");
    await pressAndSettle(await screen.findByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith({
      url: "file:///tmp/badge-card.png",
      message: "I earned the Clean Sweeper badge on globeville 🎉 Join our neighborhood: https://globeville.app",
    });
    expect(mocked.logShare).toHaveBeenCalledWith("tok-123", "clean_sweeper");
  });

  it("doesn't count a share when the sheet is closed without sharing", async () => {
    const { Share } = require("react-native");
    jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction });
    mocked.getMyBadges.mockResolvedValue(mine);
    renderApp("/share/clean_sweeper");
    await pressAndSettle(await screen.findByRole("button", { name: "Share" }));
    expect(mocked.logShare).not.toHaveBeenCalled();
  });
});

describe("logging out", () => {
  it("stops watching event places on this phone", async () => {
    location.__setPermission({ granted: true, canAskAgain: true });
    mocked.getGeofences.mockResolvedValue({
      geofences: [{ event_id: 1, latitude: 39.76, longitude: -105.01, radius_meters: 150, opens_at: iso(HOUR), closes_at: iso(3 * HOUR) }],
    });
    await syncGeofences("tok", true);
    expect(location.__watched()).not.toBeNull();
    mocked.logout.mockResolvedValue(undefined);
    renderApp("/settings");
    await pressAndSettle(await screen.findByRole("button", { name: "Log out" }));
    await pressAndSettle(screen.getAllByRole("button", { name: "Log out" }).at(-1)!);
    await waitFor(() => expect(location.__watched()).toBeNull());
  });
});

// ---- Spanish ------------------------------------------------------------------------

describe("in Spanish", () => {
  it.each(["/impact", "/badges", "/badges/clean_sweeper", "/share/clean_sweeper", "/checkin-offer", "/maps-app", "/credits", "/celebrate", "/member/52", "/settings"])(
    "%s has no missing words",
    async (path) => {
      mocked.getMyBadges.mockResolvedValue({ badges: myBadges({ clean_sweeper: [3, 5], ambassador: [1, 0] }) });
      mocked.getCollectCards.mockResolvedValue({
        cards: [
          {
            event_id: 11,
            title: "Alley Cleanup",
            title_alt: "Limpieza del callejón",
            language: "en",
            category: "cleanup",
            starts_at: "2026-10-12T09:00:00-06:00",
            collect_until: "2026-10-19T11:00:00-06:00",
            grows: [{ badge: "clean_sweeper", stage: 3, count: 5, next_threshold: 10 }],
          },
        ],
        show_checkin_reoffer: true,
      });
      mocked.getCelebrations.mockResolvedValue({ celebrations: [{ id: 1, badge_key: "clean_sweeper", kind: "stage_up", stage: 3, count: 5 }] });
      mocked.getMember.mockResolvedValue({
        id: 52,
        display_name: "Ben R.",
        photo_url: null,
        neighborhood: { id: 3, name: "Highland" },
        alias: null,
        member_since: "2026-03-14",
        badges: [],
      });
      await useSpanish();
      renderApp(path);
      await waitFor(() => expect(visibleText().length).toBeGreaterThan(3));
      expectNoMissingKeys();
    },
  );

  it("My Impact and the unlock moment read in Spanish", async () => {
    mocked.getCelebrations.mockResolvedValue({ celebrations: [{ id: 1, badge_key: "clean_sweeper", kind: "stage_up", stage: 3, count: 5 }] });
    await useSpanish();
    renderApp("/celebrate");
    expect(await screen.findByText("¡Escobita creció a Flor!")).toBeTruthy();
    expect(screen.getByText("Ayuda a limpiar el barrio.")).toBeTruthy();
  });
});
