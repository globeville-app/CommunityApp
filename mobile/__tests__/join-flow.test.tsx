/**
 * Screen tests for the whole join flow, with the backend API mocked.
 */
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import * as api from "../src/api";
import { ApiError } from "../src/api";
import { APP_NAME, HIGHLAND_PROFILE, fakeStore, notFound, renderApp } from "../test-utils/helpers";

jest.mock("../src/api", () => {
  const actual = jest.requireActual("../src/api");
  return {
    ...actual,
    getConfig: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    matchAddress: jest.fn(),
    saveProfile: jest.fn(),
    uploadPhoto: jest.fn(),
    getMyProfile: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;
const ADDRESS = "3300 Example Blvd Apt 2, Denver, CO 80211";

beforeEach(() => {
  jest.clearAllMocks();
  fakeStore.clear();
  mocked.getConfig.mockResolvedValue({
    app_name: APP_NAME,
    interests: ["Block parties", "Food drives", "Cleanups", "Live music", "Gardening"],
  });
});

function loggedIn() {
  fakeStore.set("auth_token", "tok-123");
}

/** Press a button whose handler awaits the API, letting React finish updating. */
async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

/** Everything the app ever wrote to storage, as one string. */
function everythingStored() {
  const writes = (SecureStore.setItemAsync as jest.Mock).mock.calls.map((call) => call.join(" "));
  return [...writes, ...fakeStore.values()].join("\n");
}

describe("starting the app", () => {
  it("shows Welcome with the app name when logged out", async () => {
    renderApp();
    expect(await screen.findByText(APP_NAME)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
  });

  it("goes straight to Profile when logged in with a profile (stays logged in)", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    renderApp();
    expect(await screen.findByText("Ana R.")).toBeTruthy();
    expect(screen.getByText("LoHi (Highland)")).toBeTruthy();
    expect(mocked.getMyProfile).toHaveBeenCalledWith("tok-123");
  });

  it("resumes at Address when logged in without a profile", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
    renderApp();
    expect(await screen.findByText("Where's home?")).toBeTruthy();
  });

  it("logs out and shows Welcome when the saved token is no longer valid", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(new ApiError("authentication_failed", "Invalid token.", 401));
    renderApp();
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(fakeStore.has("auth_token")).toBe(false);
  });

  it("shows a retry when the backend can't be reached", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValueOnce(new ApiError("network", api.NETWORK_ERROR_MESSAGE));
    renderApp();
    expect(await screen.findByText(api.NETWORK_ERROR_MESSAGE)).toBeTruthy();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    await pressAndSettle(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ana R.")).toBeTruthy();
  });
});

describe("sign up and log in", () => {
  it("signs up, saves the token securely, and moves to Address", async () => {
    mocked.signup.mockResolvedValue({ token: "new-token" });
    mocked.getMyProfile.mockRejectedValue(notFound());
    renderApp();
    fireEvent.press(await screen.findByRole("button", { name: "Sign up" }));

    fireEvent.changeText(await screen.findByLabelText("Email"), " ana@example.com ");
    fireEvent.changeText(screen.getByLabelText("Password"), "a long pass phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Where's home?")).toBeTruthy();
    expect(mocked.signup).toHaveBeenCalledWith("ana@example.com", "a long pass phrase");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("auth_token", "new-token");
  });

  it("shows the server's message when login fails", async () => {
    mocked.login.mockRejectedValue(new ApiError("invalid_credentials", "Email or password is incorrect.", 400));
    renderApp("/login");
    fireEvent.changeText(await screen.findByLabelText("Email"), "ana@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    await pressAndSettle(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Email or password is incorrect.")).toBeTruthy();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe("address → match → profile setup → profile", () => {
  beforeEach(() => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
  });

  async function submitAddress() {
    const field = await screen.findByLabelText("Street address");
    fireEvent.changeText(field, ADDRESS);
    await pressAndSettle(screen.getByRole("button", { name: "Find my neighborhood" }));
  }

  it("runs the full flow, choosing the LoHi alias", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 3, name: "Highland", aliases: ["LoHi"] });
    mocked.saveProfile.mockResolvedValue(HIGHLAND_PROFILE);
    renderApp();
    await submitAddress();

    // Match screen
    expect(await screen.findByRole("header", { name: "Highland" })).toBeTruthy();
    expect(mocked.matchAddress).toHaveBeenCalledWith("tok-123", ADDRESS);
    expect(screen.getByRole("button", { name: "Join Highland" })).toBeTruthy();
    fireEvent.press(screen.getByRole("checkbox", { name: "LoHi" }));
    fireEvent.press(screen.getByRole("button", { name: "Join LoHi" }));

    // Profile setup
    fireEvent.changeText(await screen.findByLabelText("First name"), "Ana");
    fireEvent.changeText(screen.getByLabelText("Last name"), "Rivera");
    fireEvent.press(await screen.findByRole("checkbox", { name: "Gardening" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Block parties" }));
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    await pressAndSettle(screen.getByRole("button", { name: "Finish" }));

    // Profile
    expect(await screen.findByText("Ana R.")).toBeTruthy();
    expect(screen.getByText("LoHi (Highland)")).toBeTruthy();
    expect(screen.getByText("Gardening")).toBeTruthy();
    expect(mocked.saveProfile).toHaveBeenCalledWith("tok-123", {
      first_name: "Ana",
      last_name: "Rivera",
      alias: "LoHi",
      interests: ["Gardening", "Block parties"],
    });
    expect(mocked.uploadPhoto).not.toHaveBeenCalled();
  });

  it("keeps the official name when there are no aliases", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 1, name: "Hale", aliases: [] });
    renderApp();
    await submitAddress();
    expect(await screen.findByRole("button", { name: "Join Hale" })).toBeTruthy();
    expect(screen.queryByText("Which name do you use?")).toBeNull();
  });

  it("clears the address after a match and never stores or passes it on", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 3, name: "Highland", aliases: ["LoHi"] });
    const app = renderApp();
    await submitAddress();
    expect(await screen.findByRole("header", { name: "Highland" })).toBeTruthy();

    // The match shows on the same screen, and the field is already empty.
    expect(app.getPathname()).toBe("/address");
    expect((await screen.findByLabelText("Street address")).props.value).toBe("");

    // "Edit address" closes the sheet; the field is still empty.
    fireEvent.press(screen.getByRole("button", { name: "Edit address" }));
    expect(screen.queryByRole("button", { name: "Join Highland" })).toBeNull();
    expect(screen.getByLabelText("Street address").props.value).toBe("");

    // Joining passes only the neighborhood on, never the address.
    await submitAddress();
    fireEvent.press(await screen.findByRole("button", { name: "Join Highland" }));
    await screen.findByText("Set up your profile");
    expect(app.getPathname()).toBe("/profile-setup");
    expect(app.getPathnameWithParams()).not.toContain("Example");
    expect(JSON.stringify(app.getSearchParams())).not.toContain("Example");
    expect(app.getSearchParams()).toMatchObject({ neighborhood: "Highland" });

    // Storage only ever held the login token.
    expect(everythingStored()).not.toContain("Example");
    expect([...fakeStore.keys()]).toEqual(["auth_token"]);
  });

  it("sends the photo picked from the library as JPEG", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 1, name: "Hale", aliases: [] });
    mocked.saveProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, alias: null });
    mocked.uploadPhoto.mockResolvedValue(HIGHLAND_PROFILE);
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", fileSize: 200000 }],
    });
    renderApp();
    await submitAddress();
    fireEvent.press(await screen.findByRole("button", { name: "Join Hale" }));
    fireEvent.changeText(await screen.findByLabelText("First name"), "Ana");
    fireEvent.changeText(screen.getByLabelText("Last name"), "Rivera");
    await pressAndSettle(screen.getByRole("button", { name: "Add a photo" }));
    expect(await screen.findByLabelText("Selected photo")).toBeTruthy();

    const options = (ImagePicker.launchImageLibraryAsync as jest.Mock).mock.calls[0][0];
    expect(options).toMatchObject({ exif: false, preferredAssetRepresentationMode: "compatible" });
    expect(options.quality).toBeLessThan(1);

    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    await pressAndSettle(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() =>
      expect(mocked.uploadPhoto).toHaveBeenCalledWith("tok-123", {
        uri: "file:///photo.jpg",
        mimeType: "image/jpeg",
      }),
    );
  });

  it("keeps the saved profile and offers to continue when the photo upload fails", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 1, name: "Hale", aliases: [] });
    mocked.saveProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, alias: null });
    mocked.uploadPhoto.mockRejectedValue(new ApiError("timeout", api.TIMEOUT_ERROR_MESSAGE));
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", fileSize: 900000 }],
    });
    renderApp();
    await submitAddress();
    fireEvent.press(await screen.findByRole("button", { name: "Join Hale" }));
    fireEvent.changeText(await screen.findByLabelText("First name"), "Ana");
    fireEvent.changeText(screen.getByLabelText("Last name"), "Rivera");
    await pressAndSettle(screen.getByRole("button", { name: "Add a photo" }));
    await pressAndSettle(screen.getByRole("button", { name: "Finish" }));

    expect(
      await screen.findByText(`Your profile is saved, but the photo didn't upload. ${api.TIMEOUT_ERROR_MESSAGE}`),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try the photo again" })).toBeTruthy();

    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, alias: null });
    await pressAndSettle(screen.getByRole("button", { name: "Continue without photo" }));
    expect(await screen.findByText("Ana R.")).toBeTruthy();
    expect(mocked.saveProfile).toHaveBeenCalledTimes(1);
  });

  it("rejects a photo over 5 MB before uploading", async () => {
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 1, name: "Hale", aliases: [] });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///big.jpg", mimeType: "image/jpeg", fileSize: 6 * 1024 * 1024 }],
    });
    renderApp();
    await submitAddress();
    fireEvent.press(await screen.findByRole("button", { name: "Join Hale" }));
    await pressAndSettle(await screen.findByRole("button", { name: "Add a photo" }));
    expect(await screen.findByText("Photos must be 5 MB or smaller.")).toBeTruthy();
    expect(screen.queryByLabelText("Selected photo")).toBeNull();
  });

  describe("errors", () => {
    const cases: [string, string, boolean][] = [
      ["outside_denver", `${APP_NAME} is only in the City and County of Denver for now.`, false],
      ["no_match", "We couldn't find that address. Check the spelling and try again.", false],
      ["geocoder_unavailable", "We can't look up addresses right now. Please try again in a minute.", true],
      ["network", api.NETWORK_ERROR_MESSAGE, true],
    ];

    it.each(cases)("shows the %s message", async (code, message, offersRetry) => {
      mocked.matchAddress.mockRejectedValue(new ApiError(code, message, 400));
      renderApp();
      await submitAddress();
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByText("Where's home?")).toBeTruthy();
      expect(!!screen.queryByRole("button", { name: "Try again" })).toBe(offersRetry);
    });

    it("retries the same address after a network error", async () => {
      mocked.matchAddress
        .mockRejectedValueOnce(new ApiError("network", api.NETWORK_ERROR_MESSAGE))
        .mockResolvedValueOnce({ neighborhood_id: 1, name: "Hale", aliases: [] });
      renderApp();
      await submitAddress();
      await pressAndSettle(await screen.findByRole("button", { name: "Try again" }));
      expect(await screen.findByRole("button", { name: "Join Hale" })).toBeTruthy();
      expect(mocked.matchAddress).toHaveBeenCalledTimes(2);
    });
  });
});

describe("profile screen", () => {
  it("logs out: tells the server, forgets the token, shows Welcome", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    mocked.logout.mockResolvedValue(undefined);
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(mocked.logout).toHaveBeenCalledWith("tok-123");
    expect(fakeStore.has("auth_token")).toBe(false);
  });

  it("still logs out on the phone if the server can't be reached", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    mocked.logout.mockRejectedValue(new ApiError("network", api.NETWORK_ERROR_MESSAGE));
    renderApp();
    await pressAndSettle(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(fakeStore.has("auth_token")).toBe(false);
  });
});
