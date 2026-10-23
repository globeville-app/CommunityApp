/**
 * Milestone 5 on the phone: who can see an event, Invite people, the host's
 * guest list, invite and collect links opening the app, and typing a badge
 * code, with the API mocked.
 */
import * as Clipboard from "expo-clipboard";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Share, Text } from "react-native";

import * as api from "../src/api";
import { ApiError } from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { fakeStore, renderApp, resetLanguage, sampleEvent } from "../test-utils/helpers";

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

const hosted = (overrides: Partial<api.EventData> = {}) =>
  sampleEvent({ id: 42, title: "River cleanup", is_organizer: true, organizer_name: "Me", ...overrides });

describe("posting: who can see this", () => {
  async function fillAndPost(choice?: string) {
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Post an event" }));
    fireEvent.press(await screen.findByRole("button", { name: "Community & Giving" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Cleanup" }));
    fireEvent.press(await screen.findByRole("link", { name: "Skip" }));
    fireEvent.changeText(await screen.findByLabelText("Title"), "River cleanup");
    fireEvent.changeText(screen.getByLabelText("Meeting spot"), "Riverside park");
    expect(screen.getByText("Who can see this?")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Neighborhood + link" })).toBeChecked();
    expect(
      screen.getByText("On your neighborhood's calendar, and anyone you send the link to can see it."),
    ).toBeTruthy();
    if (choice) {
      fireEvent.press(screen.getByRole("checkbox", { name: choice }));
      expect(screen.getByText("Not on any calendar. Only people you send the link to can see it.")).toBeTruthy();
    }
    await pressAndSettle(screen.getByRole("button", { name: "Next: map pin" }));
    await act(async () => {
      fireEvent(await screen.findByTestId("pin-map"), "press", {
        nativeEvent: { coordinate: { latitude: 39.76, longitude: -105.01 } },
      });
    });
    await pressAndSettle(screen.getByRole("button", { name: "Post" }));
  }

  it("Link only is sent, and posting lands on Invite people", async () => {
    mocked.createEvent.mockResolvedValue(hosted({ visibility: "link_only" }));
    await fillAndPost("Link only");
    expect(mocked.createEvent).toHaveBeenCalledWith(
      "tok-123",
      expect.objectContaining({ visibility: "link_only" }),
      expect.any(String),
    );
    expect(await screen.findByRole("header", { name: "Invite people" })).toBeTruthy();
    expect(mocked.getInvite).toHaveBeenCalledWith("tok-123", 42);
    expect(screen.getByText("Text this link to anyone you want to invite. It sends from your phone.")).toBeTruthy();
  });

  it("editing loads the saved choice", async () => {
    mocked.getEvent.mockResolvedValue(hosted({ visibility: "link_only" }));
    renderApp("/event-form?id=42");
    expect(await screen.findByRole("checkbox", { name: "Link only" })).toBeChecked();
  });
});

describe("Invite people", () => {
  it("Share opens the share sheet with the message, then counts the share", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    renderApp("/invite/42");
    await pressAndSettle(await screen.findByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith({
      message: "Come to the event 42! RSVP here: https://globeville.app/e/Abc234defG",
    });
    expect(mocked.logInviteShare).toHaveBeenCalledWith("tok-123", 42);
  });

  it("Copy link copies just the link", async () => {
    renderApp("/invite/42");
    await pressAndSettle(await screen.findByRole("button", { name: "Copy link" }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("https://globeville.app/e/Abc234defG");
    expect(screen.getByRole("button", { name: "Link copied" })).toBeTruthy();
  });

  it("Reset link asks first, then shows the new link", async () => {
    mocked.resetInvite.mockResolvedValue({
      code: "NewCode234",
      url: "https://globeville.app/e/NewCode234",
      message: "Come! https://globeville.app/e/NewCode234",
    });
    renderApp("/invite/42");
    await pressAndSettle(await screen.findByRole("link", { name: "Reset link" }));
    expect(mocked.resetInvite).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: "Reset link" });
    await pressAndSettle(confirm[confirm.length - 1]);
    expect(mocked.resetInvite).toHaveBeenCalledWith("tok-123", 42);
    expect(await screen.findByText("Come! https://globeville.app/e/NewCode234")).toBeTruthy();
    expect(screen.getByText("Done. Here's the new link.")).toBeTruthy();
  });
});

describe("the host's event detail and guest list", () => {
  it("only the host sees Invite people and Guest list; Link only is tagged", async () => {
    mocked.getEvent.mockResolvedValue(hosted({ visibility: "link_only" }));
    const view = renderApp("/event/42");
    expect(await screen.findByRole("button", { name: "Invite people" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Guest list" })).toBeTruthy();
    expect(screen.getByText("Link only")).toBeTruthy();
    view.unmount();

    mocked.getEvent.mockResolvedValue(sampleEvent());
    renderApp("/event/7");
    expect(await screen.findByText("Fall potluck")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Invite people" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Guest list" })).toBeNull();
  });

  it("lists members and guests (never phone numbers), with Came X of Y and Remove", async () => {
    mocked.getGuests.mockResolvedValue({
      going_count: 3,
      names_hidden: false,
      members: [{ display_name: "Rosa M." }],
      guests: [
        { id: 5, first_name: "Maria" },
        { id: 6, first_name: "Joe" },
      ],
      came: { confirmed: 2, of: 3 },
    });
    mocked.removeGuest.mockResolvedValue(undefined);
    renderApp("/guests/42");
    expect(await screen.findByText("Rosa M.")).toBeTruthy();
    expect(screen.getByText("Maria (guest)")).toBeTruthy();
    expect(screen.getByText("Came: 2 of 3 (confirmed)")).toBeTruthy();
    expect(screen.getByText(/Some people come and never confirm/)).toBeTruthy();

    await pressAndSettle(screen.getAllByRole("link", { name: "Remove" })[0]);
    expect(
      screen.getByText("Remove Maria from this event? They'll get a text saying the host removed their RSVP."),
    ).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "Remove" }));
    expect(mocked.removeGuest).toHaveBeenCalledWith("tok-123", 42, 5);
    expect(mocked.getGuests).toHaveBeenCalledTimes(2);
  });

  it("resource fairs and donation drives show counts only", async () => {
    mocked.getGuests.mockResolvedValue({ going_count: 9, names_hidden: true, members: [], guests: [], came: null });
    renderApp("/guests/42");
    expect(await screen.findByText("9 neighbors going")).toBeTruthy();
    expect(screen.getByText(/only the count is shown/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Remove" })).toBeNull();
  });
});

describe("links that open the app", () => {
  it("an invite link opens another neighborhood's event, and I'm going is recorded as from the invite", async () => {
    const elsewhere = sampleEvent({ id: 77, title: "Swansea cookout" });
    mocked.openInvite.mockResolvedValue(elsewhere);
    mocked.getEvent.mockResolvedValue(elsewhere);
    mocked.setGoing.mockResolvedValue({ going_count: 13, is_going: true });
    renderApp("/e/Abc234defG");
    expect(await screen.findByRole("header", { name: "Swansea cookout" })).toBeTruthy();
    expect(mocked.openInvite).toHaveBeenCalledWith("tok-123", "Abc234defG");
    await pressAndSettle(screen.getByRole("button", { name: "I'm going" }));
    expect(mocked.setGoing).toHaveBeenCalledWith("tok-123", 77, true, "invite_link");
  });

  it("a reset invite link says it has expired", async () => {
    mocked.openInvite.mockRejectedValue(new ApiError("invite_revoked", 410));
    renderApp("/e/OldCode234");
    expect(await screen.findByText("This invite link has expired. Ask the host for a new one.")).toBeTruthy();
  });

  it("not signed in: an invite link offers the web page or joining", async () => {
    fakeStore.clear();
    renderApp("/e/Abc234defG");
    expect(await screen.findByRole("header", { name: "You're invited!" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open the event page" })).toBeTruthy();
    expect(mocked.openInvite).not.toHaveBeenCalled();
  });

  it("a collect link opened before joining is claimed once they reach the app", async () => {
    fakeStore.clear();
    const before = renderApp("/c/claim-token-abc");
    await waitFor(() => expect(fakeStore.get("pending_badge_claim")).toBe("claim-token-abc"));
    expect(mocked.claimBadge).not.toHaveBeenCalled();
    before.unmount();

    // They sign up (or log in) and land on the events tab.
    fakeStore.set("auth_token", "tok-123");
    mocked.claimBadge.mockResolvedValue({
      celebrations: [{ id: 9, badge_key: "clean_sweeper", kind: "earned", stage: 1, count: 1 }],
    });
    mocked.getCelebrations.mockResolvedValue({
      celebrations: [{ id: 9, badge_key: "clean_sweeper", kind: "earned", stage: 1, count: 1 }],
    });
    renderApp("/events");
    await waitFor(() => expect(mocked.claimBadge).toHaveBeenCalledWith("tok-123", { token: "claim-token-abc" }));
    expect(await screen.findByText("You earned Clean Sweeper!")).toBeTruthy();
    expect(fakeStore.has("pending_badge_claim")).toBe(false);
  });

  it("a collect link is kept for later if the phone is offline", async () => {
    fakeStore.set("pending_badge_claim", "claim-token-abc");
    mocked.claimBadge.mockRejectedValue(new ApiError("network"));
    renderApp("/events");
    await waitFor(() => expect(mocked.claimBadge).toHaveBeenCalled());
    await waitFor(() => expect(fakeStore.get("pending_badge_claim")).toBe("claim-token-abc"));
  });
});

describe("Have a badge code?", () => {
  it("on the last joining step: the code is collected, the moment waits for the events tab", async () => {
    mocked.claimBadge.mockResolvedValue({
      celebrations: [{ id: 9, badge_key: "clean_sweeper", kind: "earned", stage: 1, count: 1 }],
    });
    renderApp("/interests?onboarding=1");
    fireEvent.changeText(await screen.findByLabelText("Badge code"), "k7m2qp");
    await pressAndSettle(screen.getByRole("button", { name: "Collect my badge" }));
    expect(mocked.claimBadge).toHaveBeenCalledWith("tok-123", { code: "K7M2QP" });
    expect(screen.getByText("Collected! It's on your profile now.")).toBeTruthy();
    expect(screen.queryByText("You earned Clean Sweeper!")).toBeNull();
  });

  it("in My Impact: a wrong code says so", async () => {
    mocked.claimBadge.mockRejectedValue(new ApiError("claim_not_found", 404));
    renderApp("/impact");
    fireEvent.changeText(await screen.findByLabelText("Badge code"), "ZZZZZZ");
    await pressAndSettle(screen.getByRole("button", { name: "Collect my badge" }));
    expect(await screen.findByText("That code isn't right. Check it and try again.")).toBeTruthy();
  });

  it("in My Impact: a good code opens the unlock moment", async () => {
    const celebration = { id: 9, badge_key: "clean_sweeper", kind: "earned" as const, stage: 1, count: 1 };
    mocked.claimBadge.mockResolvedValue({ celebrations: [celebration] });
    renderApp("/impact");
    fireEvent.changeText(await screen.findByLabelText("Badge code"), "K7M2QP");
    mocked.getCelebrations.mockResolvedValue({ celebrations: [celebration] });
    await pressAndSettle(screen.getByRole("button", { name: "Collect my badge" }));
    expect(await screen.findByText("You earned Clean Sweeper!")).toBeTruthy();
  });
});

describe("in Spanish", () => {
  /** A missing translation shows its key, like "invite.title". */
  function expectNoMissingKeys() {
    const keys = screen.UNSAFE_getAllByType(Text).flatMap((node) => {
      const children = ([] as unknown[]).concat(node.props.children);
      const text = children.every((c) => typeof c === "string" || typeof c === "number") ? children.join("") : "";
      return /^[a-z_]+(\.[a-z_]+)+$/.test(text) ? [text] : [];
    });
    expect(keys).toEqual([]);
  }

  it("every new screen renders with no missing words", async () => {
    const settings = renderApp("/settings");
    await pressAndSettle(await screen.findByRole("radio", { name: "Español" }));
    settings.unmount();

    mocked.getEvent.mockResolvedValue(hosted({ visibility: "link_only" }));
    mocked.getGuests.mockResolvedValue({
      going_count: 1,
      names_hidden: false,
      members: [],
      guests: [{ id: 5, first_name: "Maria" }],
      came: { confirmed: 1, of: 1 },
    });
    for (const [url, header] of [
      ["/invite/42", "Invitar gente"],
      ["/guests/42", "Lista de invitados"],
      ["/event-form?id=42", null],
      ["/event/42", null],
      ["/impact", null],
    ] as const) {
      const view = renderApp(url);
      if (header) expect(await screen.findByRole("header", { name: header })).toBeTruthy();
      else await screen.findAllByText(/./);
      await act(async () => undefined);
      expectNoMissingKeys();
      view.unmount();
    }
    fakeStore.clear();
    const signedOut = renderApp("/e/Abc234defG");
    expect(await screen.findByRole("header", { name: "¡Estás invitado!" })).toBeTruthy();
    expectNoMissingKeys();
    signedOut.unmount();
  });
});
