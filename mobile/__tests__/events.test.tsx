/**
 * Milestone 2 on the phone: the Events tab, the category and interests
 * pickers, posting, the event detail ("I'm going", translate, report,
 * organizer actions), with the API mocked.
 */
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";

import * as api from "../src/api";
import { ApiError } from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { CONFIG, HIGHLAND_PROFILE, fakeStore, renderApp, resetLanguage, sampleEvent } from "../test-utils/helpers";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  fakeStore.set("auth_token", "tok-123");
  await resetLanguage();
  useDefaultReplies(mocked);
});

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

/** Pick Español in Settings (the choice then applies everywhere). */
async function useSpanish() {
  const settings = renderApp("/settings");
  await pressAndSettle(await screen.findByRole("radio", { name: "Español" }));
  settings.unmount();
}

/** Tap the (mocked) map at a spot, which drops the pin there. */
async function dropPin(latitude: number, longitude: number) {
  await act(async () => {
    fireEvent(await screen.findByTestId("pin-map"), "press", { nativeEvent: { coordinate: { latitude, longitude } } });
  });
}

/** Every piece of visible text on screen. */
function visibleText(): string[] {
  return screen.UNSAFE_getAllByType(Text).flatMap((node) => {
    const children = ([] as unknown[]).concat(node.props.children);
    return children.every((c) => typeof c === "string" || typeof c === "number") ? [children.join("")] : [];
  });
}

/** A missing translation shows its key, like "events.post_button". */
function expectNoMissingKeys() {
  const keys = visibleText().filter((text) => /^[a-z_]+(\.[a-z_]+)+$/.test(text));
  expect(keys).toEqual([]);
}

describe("the Events tab", () => {
  it("lists upcoming events with date block, category, time, place and going count", async () => {
    mocked.listEvents.mockResolvedValue({
      events: [
        sampleEvent({ id: 1, title: "Fall potluck", going_count: 12 }),
        sampleEvent({ id: 2, title: "Old yard sale", category: "yard_sale", group: "buy_swap", status: "cancelled", going_count: 1 }),
      ],
    });
    renderApp();
    expect(await screen.findByText("Fall potluck")).toBeTruthy();
    expect(screen.getByRole("header", { name: "LoHi" })).toBeTruthy();
    expect(screen.getAllByText("OCT")).toHaveLength(2);
    expect(screen.getAllByText("24").length).toBeGreaterThan(0);
    expect(screen.getByText("Potluck / Cookout")).toBeTruthy();
    expect(screen.getAllByText("6:00 PM · Corner of 32nd and Lowell")).toHaveLength(2);
    expect(screen.getByText("12 neighbors going")).toBeTruthy();
    expect(screen.getByText("1 neighbor going")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("shows the empty state", async () => {
    renderApp();
    expect(await screen.findByText("No events yet. Post the first one.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Post an event" })).toBeTruthy();
  });

  it("filters by group", async () => {
    renderApp();
    await screen.findByText("No events yet. Post the first one.");
    await pressAndSettle(screen.getByRole("button", { name: "Community" }));
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith("tok-123", { following: false, forYou: false, group: "community" }));
    expect(await screen.findByText("No upcoming events in this group yet.")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith("tok-123", { following: false, forYou: false, group: undefined }));
  });

  it("tags only matching events 'For you', and filters to them", async () => {
    mocked.listEvents.mockImplementation(async (_token, filter) => ({
      events: filter?.forYou
        ? []
        : [
            sampleEvent({ id: 1, title: "Potluck", matches_interests: true }),
            sampleEvent({ id: 2, title: "Trivia", category: "game_night", group: "entertainment" }),
          ],
    }));
    renderApp();
    expect(await screen.findByText("Trivia")).toBeTruthy();
    // Exactly one card has the tag (the other "For you" is the filter chip).
    expect(screen.getAllByText("For you")).toHaveLength(2);

    // The filter chip comes first in the screen, before the cards.
    await pressAndSettle(screen.getAllByRole("button", { name: "For you" })[0]);
    await waitFor(() => expect(mocked.listEvents).toHaveBeenLastCalledWith("tok-123", { following: false, forYou: true, group: undefined }));
    expect(await screen.findByText("No upcoming events match your interests yet.")).toBeTruthy();
  });

  it("without interests, the For you chip opens the interests picker", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, interests: [] });
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Pick interests to see events for you" }));
    expect(await screen.findByRole("header", { name: "What are you into?" })).toBeTruthy();
  });
});

describe("the category picker (posting)", () => {
  async function openPicker() {
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Post an event" }));
    expect(await screen.findByRole("header", { name: "What kind of event?" })).toBeTruthy();
  }

  it("tiles open their categories, with Other at the bottom", async () => {
    await openPicker();
    for (const group of ["Celebrate", "Buy, Sell & Swap", "Entertainment", "Get Active", "Community & Giving", "Learn & Connect"]) {
      expect(screen.getByRole("button", { name: group })).toBeTruthy();
    }
    fireEvent.press(screen.getByRole("button", { name: "Get Active" }));
    const options = screen.getAllByRole("checkbox").map((c) => c.props.accessibilityLabel);
    expect(options).toEqual(["Pickup Game", "Fitness", "Gardening", "Pet Meetup", "Other"]);
  });

  it("search finds 'limpieza' and 'trivia' in either language", async () => {
    await openPicker();
    fireEvent.changeText(screen.getByLabelText("Search categories"), "limpieza");
    expect(screen.getByRole("checkbox", { name: "Cleanup" })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search categories"), "trivia");
    expect(screen.getByRole("checkbox", { name: "Game Night" })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search categories"), "zzz");
    expect(screen.getByText("No category matches. Try another word.")).toBeTruthy();
  });

  it("'Other' needs a few words", async () => {
    await openPicker();
    fireEvent.press(screen.getByRole("button", { name: "Celebrate" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Other" }));
    fireEvent.press(screen.getByRole("button", { name: "Use this" }));
    expect(screen.getByText("Describe your event in a few words.")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Describe it in a few words"), "Quinceañera rehearsal");
    fireEvent.press(screen.getByRole("button", { name: "Use this" }));
    expect(await screen.findByRole("header", { name: "Got a Partiful link?" })).toBeTruthy();
  });
});

describe("posting an event", () => {
  async function chooseCleanup() {
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Post an event" }));
    fireEvent.press(await screen.findByRole("button", { name: "Community & Giving" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Cleanup" }));
    expect(await screen.findByRole("header", { name: "Got a Partiful link?" })).toBeTruthy();
  }

  it("the Partiful step fills in the title and offers, not forces, a suggestion", async () => {
    mocked.partifulPreview.mockResolvedValue({ title: "Fall Potluck on Lowell", suggested_category: "potluck" });
    await chooseCleanup();
    fireEvent.changeText(screen.getByLabelText("Partiful link"), "https://partiful.com/e/abc");
    await pressAndSettle(screen.getByRole("button", { name: "Continue" }));

    expect(mocked.partifulPreview).toHaveBeenCalledWith("tok-123", "https://partiful.com/e/abc");
    expect(await screen.findByLabelText("Title")).toHaveProp("value", "Fall Potluck on Lowell");
    // The choice stays Cleanup; the suggestion is one tap away.
    expect(screen.getByText("Cleanup")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Suggested: Potluck / Cookout" }));
    expect(screen.getByText("Potluck / Cookout")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Suggested: Potluck / Cookout" })).toBeNull();
  });

  it("posts the details in Denver time and lands on the new event", async () => {
    mocked.createEvent.mockResolvedValue(sampleEvent({ id: 42, title: "River cleanup", category: "cleanup", group: "community", is_organizer: true }));
    mocked.getEvent.mockResolvedValue(sampleEvent({ id: 42, title: "River cleanup", category: "cleanup", group: "community", is_organizer: true }));
    await chooseCleanup();
    fireEvent.press(screen.getByRole("link", { name: "Skip" }));

    fireEvent.changeText(await screen.findByLabelText("Title"), "River cleanup");
    fireEvent.changeText(screen.getByLabelText("Date"), "2030-10-24");
    fireEvent.changeText(screen.getByLabelText("Start time"), "09:30");
    fireEvent.press(screen.getByRole("link", { name: "Add an end time" }));
    fireEvent.changeText(screen.getByLabelText("End time"), "12:00");
    fireEvent.changeText(screen.getByLabelText("Meeting spot"), "Riverside park by the bridge");
    expect(screen.getByText("Neighbors will see this. For a block party, a block or cross street is enough.")).toBeTruthy();
    fireEvent.press(screen.getByRole("link", { name: "Add Spanish version" }));
    fireEvent.changeText(screen.getByLabelText("Title in Spanish (optional)"), "Limpieza del río");
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    await dropPin(39.7621, -105.0098);
    await pressAndSettle(screen.getByRole("button", { name: "Post" }));

    expect(mocked.createEvent).toHaveBeenCalledWith("tok-123", {
      category: "cleanup",
      category_other: "",
      title: "River cleanup",
      description: "",
      language: "en",
      title_alt: "Limpieza del río",
      description_alt: "",
      starts_at: "2030-10-24T09:30",
      ends_at: "2030-10-24T12:00",
      location_text: "Riverside park by the bridge",
      latitude: 39.7621,
      longitude: -105.0098,
      partiful_url: "",
    }, expect.any(String)); // the form's key: a double tap posts it once
    expect(await screen.findByRole("header", { name: "River cleanup" })).toBeTruthy();
  });

  it("shows the server's reason when posting fails", async () => {
    mocked.createEvent.mockRejectedValue(new ApiError("start_in_past", 400));
    await chooseCleanup();
    fireEvent.press(screen.getByRole("link", { name: "Skip" }));
    fireEvent.changeText(await screen.findByLabelText("Title"), "Cleanup");
    fireEvent.changeText(screen.getByLabelText("Meeting spot"), "The park");
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    await dropPin(39.76, -105.01);
    await pressAndSettle(screen.getByRole("button", { name: "Post" }));
    expect(await screen.findByText("The start time has to be in the future.")).toBeTruthy();
  });
});

describe("the event detail", () => {
  it("I'm going toggles and updates the count", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ going_count: 12 }));
    mocked.setGoing.mockImplementation(async (_t, _id, going) => ({ going_count: going ? 13 : 12, is_going: going }));
    renderApp("/event/7");
    expect(await screen.findByText("12 neighbors going")).toBeTruthy();
    expect(screen.getByText("Posted by Ben R.")).toBeTruthy();

    await pressAndSettle(screen.getByRole("button", { name: "I'm going" }));
    expect(mocked.setGoing).toHaveBeenLastCalledWith("tok-123", 7, true);
    expect(screen.getByText("13 neighbors going")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "You're going · tap to undo" }));
    expect(mocked.setGoing).toHaveBeenLastCalledWith("tok-123", 7, false);
    expect(screen.getByText("12 neighbors going")).toBeTruthy();
  });

  it("no I'm going on a cancelled event", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ status: "cancelled" }));
    renderApp("/event/7");
    expect(await screen.findByText("This event was cancelled.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I'm going" })).toBeNull();
  });

  it("the organizer sees Edit and Cancel; other members don't", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ is_organizer: false }));
    const first = renderApp("/event/7");
    await screen.findByText("12 neighbors going");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel event" })).toBeNull();
    first.unmount();

    mocked.getEvent.mockResolvedValue(sampleEvent({ is_organizer: true }));
    mocked.cancelEvent.mockResolvedValue(sampleEvent({ is_organizer: true, status: "cancelled" }));
    renderApp("/event/7");
    expect(await screen.findByRole("button", { name: "Edit" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Cancel event" }));
    expect(await screen.findByRole("header", { name: "Cancel this event?" })).toBeTruthy();
    await pressAndSettle(screen.getAllByRole("button", { name: "Cancel event" }).at(-1)!);
    expect(mocked.cancelEvent).toHaveBeenCalledWith("tok-123", 7);
    expect(await screen.findByText("This event was cancelled.")).toBeTruthy();
  });

  it("edit opens the details filled in, in Denver time", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ is_organizer: true, starts_at: "2030-01-10T18:00:00-07:00" }));
    mocked.updateEvent.mockResolvedValue(sampleEvent({ is_organizer: true, title: "Winter potluck" }));
    renderApp("/event/7");
    fireEvent.press(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("header", { name: "Edit event" })).toBeTruthy();
    expect(screen.getByLabelText("Title")).toHaveProp("value", "Fall potluck");
    expect(screen.getByLabelText("Date")).toHaveProp("value", "2030-01-10");
    expect(screen.getByLabelText("Start time")).toHaveProp("value", "18:00");
    fireEvent.changeText(screen.getByLabelText("Title"), "Winter potluck");
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    await pressAndSettle(screen.getByRole("button", { name: "Save changes" }));
    // The existing pin is kept.
    expect(mocked.updateEvent).toHaveBeenCalledWith(
      "tok-123",
      7,
      expect.objectContaining({ title: "Winter potluck", starts_at: "2030-01-10T18:00", latitude: 39.7615, longitude: -105.0112 }),
    );
  });

  it("report submits and confirms", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.reportEvent.mockResolvedValue({ ok: true });
    renderApp("/event/7");
    fireEvent.press(await screen.findByRole("link", { name: "Report" }));
    fireEvent.changeText(screen.getByLabelText("What's wrong?"), "Spam");
    await pressAndSettle(screen.getByRole("button", { name: "Send report" }));
    expect(mocked.reportEvent).toHaveBeenCalledWith("tok-123", 7, "Spam");
    expect(await screen.findByText("Thanks. We'll take a look.")).toBeTruthy();
  });

  it("opens Partiful when there's a link", async () => {
    const WebBrowser = require("expo-web-browser");
    mocked.getEvent.mockResolvedValue(sampleEvent({ partiful_url: "https://partiful.com/e/abc" }));
    renderApp("/event/7");
    fireEvent.press(await screen.findByRole("button", { name: "Open in Partiful" }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith("https://partiful.com/e/abc");
  });

  it("shows a former neighbor instead of a deleted organizer's name", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ organizer_name: null }));
    renderApp("/event/7");
    expect(await screen.findByText("Posted by Former neighbor")).toBeTruthy();
  });
});

describe("reading an event in your language", () => {
  it("uses the organizer's Spanish version automatically", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ title_alt: "Comida compartida de otoño" }));
    await useSpanish();
    renderApp("/event/7");
    expect(await screen.findByRole("header", { name: "Comida compartida de otoño" })).toBeTruthy();
    expect(screen.queryByText("Ver en español")).toBeNull();
    expect(screen.queryByText("Traducido automáticamente")).toBeNull();
  });

  it("'Ver en español' translates, labels it, and can show the original", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent());
    mocked.translateEvent.mockResolvedValue({ title: "Comida de otoño", description: "Trae un platillo.", target: "es", machine: true });
    await useSpanish();
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("link", { name: "Ver en español" }));
    expect(mocked.translateEvent).toHaveBeenCalledWith("tok-123", 7, "es");
    expect(screen.getByRole("header", { name: "Comida de otoño" })).toBeTruthy();
    expect(screen.getByText("Traducido automáticamente")).toBeTruthy();
    fireEvent.press(screen.getByRole("link", { name: "Ver original" }));
    expect(screen.getByRole("header", { name: "Fall potluck" })).toBeTruthy();
  });

  it("hides the button and keeps the original when translation isn't available", async () => {
    mocked.getEvent.mockResolvedValue(sampleEvent({ language: "es", title: "Limpieza del río" }));
    mocked.translateEvent.mockRejectedValue(new ApiError("translation_unavailable", 503));
    renderApp("/event/7");
    await pressAndSettle(await screen.findByRole("link", { name: "See in English" }));
    expect(screen.queryByRole("link", { name: "See in English" })).toBeNull();
    expect(screen.getByRole("header", { name: "Limpieza del río" })).toBeTruthy();
  });
});

describe("the interests picker", () => {
  async function openInterests(interests: string[] = []) {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, interests });
    renderApp("/interests?onboarding=1");
    expect(await screen.findByRole("header", { name: "What are you into?" })).toBeTruthy();
  }

  it("shows every group and category from the config, but not Other", async () => {
    await openInterests();
    expect(screen.getByText("Pick up to 8. We'll point out events you might like.")).toBeTruthy();
    for (const group of CONFIG.category_groups) {
      for (const key of group.categories) {
        expect(screen.getByRole("checkbox", { name: require("../src/i18n/en.json").categories[key] })).toBeTruthy();
      }
    }
    expect(screen.queryByRole("checkbox", { name: "Other" })).toBeNull();
    expect(screen.getByText("0 of 8")).toBeTruthy();
  });

  it("allows 8 and blocks a 9th with a message", async () => {
    await openInterests(["block_party", "potluck", "festival", "parade", "market", "swap", "comedy"]);
    expect(screen.getByText("7 of 8")).toBeTruthy();
    fireEvent.press(screen.getByRole("checkbox", { name: "Fitness" }));
    expect(screen.getByText("8 of 8")).toBeTruthy();
    fireEvent.press(screen.getByRole("checkbox", { name: "Expo" }));
    expect(screen.getByText("You can pick up to 8. Remove one to add another.")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Expo" }).props.accessibilityState.checked).toBe(false);
    await pressAndSettle(screen.getByRole("button", { name: "Done" }));
    expect(mocked.updateInterests).toHaveBeenCalledWith("tok-123", [
      "block_party", "potluck", "festival", "parade", "market", "swap", "comedy", "fitness",
    ]);
  });

  it("search finds categories in both languages", async () => {
    await openInterests();
    fireEvent.changeText(screen.getByLabelText("Search categories"), "jardín");
    expect(screen.getByRole("checkbox", { name: "Gardening" })).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("Search categories"), "potluck");
    expect(screen.getByRole("checkbox", { name: "Potluck / Cookout" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Other" })).toBeNull();
  });

  it("'Skip for now' leaves without saving", async () => {
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, interests: [] });
    renderApp("/interests?onboarding=1");
    fireEvent.press(await screen.findByRole("link", { name: "Skip for now" }));
    expect(await screen.findByText("Upcoming events")).toBeTruthy();
    expect(mocked.updateInterests).not.toHaveBeenCalled();
  });
});

describe("in Spanish", () => {
  it("every new screen renders with no missing words", async () => {
    mocked.listEvents.mockResolvedValue({ events: [sampleEvent({ matches_interests: true }), sampleEvent({ id: 8, status: "cancelled" })] });
    mocked.getEvent.mockResolvedValue(sampleEvent({ is_organizer: true, partiful_url: "https://partiful.com/e/1" }));
    await useSpanish();

    const screens: [string, string][] = [
      ["/events", "Próximos eventos"],
      ["/profile", "Intereses"],
      ["/event/7", "12 vecinos van"],
      ["/event-form", "¿Qué tipo de evento?"],
      ["/interests", "¿Qué te interesa?"],
    ];
    for (const [url, text] of screens) {
      const view = renderApp(url);
      expect(await screen.findByText(text)).toBeTruthy();
      expectNoMissingKeys();
      view.unmount();
    }
  });

  it("the date block reads 24 / OCT", async () => {
    mocked.listEvents.mockResolvedValue({ events: [sampleEvent()] });
    await useSpanish();
    renderApp("/events");
    expect(await screen.findByText("Comida compartida / Carne asada")).toBeTruthy();
    const text = visibleText();
    expect(text.indexOf("24")).toBeLessThan(text.indexOf("OCT"));
    expect(screen.getByText("Para ti")).toBeTruthy(); // the filter chip
  });
});
