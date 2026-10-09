/**
 * Settings & Support (docs/SETTINGS.md): the settings list, report a
 * problem, log out, delete account, and the placeholder legal pages.
 */
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import { Text } from "react-native";

import * as api from "../src/api";
import { ApiError } from "../src/api";
import {
  APP_NAME,
  HIGHLAND_PROFILE,
  fakeStore,
  languageStore,
  notFound,
  renderApp,
  resetLanguage,
} from "../test-utils/helpers";
import { useDefaultReplies } from "../test-utils/apiMock";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;
const ADDRESS = "3300 Example Blvd Apt 2, Denver, CO 80211";

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  await resetLanguage();
  useDefaultReplies(mocked);
  mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
  mocked.updateLanguage.mockImplementation(async (_token, language) => ({ language }));
  mocked.logout.mockResolvedValue(undefined);
  mocked.sendProblemReport.mockResolvedValue({ id: 1 });
  mocked.deleteAccount.mockResolvedValue(undefined);
});

function loggedIn() {
  fakeStore.set("auth_token", "tok-123");
}

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

/** Every piece of visible text on screen, top to bottom. */
function visibleText(): string[] {
  return screen.UNSAFE_getAllByType(Text).flatMap((node) => {
    const children = ([] as unknown[]).concat(node.props.children);
    return children.every((c) => typeof c === "string" || typeof c === "number") ? [children.join("")] : [];
  });
}

const ROWS_EN = [
  "Edit profile",
  "Language / Idioma",
  "Report a problem",
  "Privacy policy",
  "Terms of use",
  "Log out",
  "Delete account",
  "Version 1.0.0 (12)",
];
const ROWS_ES = [
  "Editar perfil",
  "Language / Idioma",
  "Reportar un problema",
  "Política de privacidad",
  "Términos de uso",
  "Cerrar sesión",
  "Eliminar cuenta",
  "Versión 1.0.0 (12)",
];

describe("the settings screen", () => {
  it("opens from the gear on the profile", async () => {
    loggedIn();
    renderApp("/profile");
    fireEvent.press(await screen.findByRole("button", { name: "Settings" }));
    expect(await screen.findByText("Edit profile")).toBeTruthy();
  });

  it("lists the eight items in order, in English and in Spanish", async () => {
    loggedIn();
    renderApp("/settings");
    await screen.findByText("Edit profile");
    expect(visibleText().filter((text) => ROWS_EN.includes(text))).toEqual(ROWS_EN);

    // The language toggle switches the screen at once.
    await pressAndSettle(screen.getByRole("radio", { name: "Español" }));
    expect(visibleText().filter((text) => ROWS_ES.includes(text))).toEqual(ROWS_ES);
    expect(screen.getByText("Configuración")).toBeTruthy();
  });

  it("shows 'Coming soon' for the privacy policy and terms until they exist", async () => {
    loggedIn();
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Privacy policy" }));
    expect(await screen.findByText("Coming soon")).toBeTruthy();
    expect(screen.getByRole("header", { name: "Privacy policy" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Back" }));
    fireEvent.press(await screen.findByRole("button", { name: "Terms of use" }));
    expect(await screen.findByRole("header", { name: "Terms of use" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it("edit profile opens the setup form filled in, with the neighborhood fixed", async () => {
    loggedIn();
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Edit profile" }));
    expect(await screen.findByRole("header", { name: "Edit profile" })).toBeTruthy();
    expect(screen.getByLabelText("First name").props.value).toBe("Ana");
    expect(screen.getByLabelText("Last name").props.value).toBe("R");
    expect(screen.getByRole("button", { name: "Edit interests" })).toBeTruthy();
    expect(screen.getByText("Your neighborhood: LoHi (Highland)")).toBeTruthy();

    mocked.saveProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, first_name: "Anita", display_name: "Anita R." });
    fireEvent.changeText(screen.getByLabelText("First name"), "Anita");
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, first_name: "Anita", display_name: "Anita R." });
    await pressAndSettle(screen.getByRole("button", { name: "Save changes" }));
    expect(mocked.saveProfile).toHaveBeenCalledWith("tok-123", {
      first_name: "Anita",
      last_name: "R",
      alias: "LoHi",
      interests: ["block_party", "gardening"],
      language: "en",
    });
    expect(await screen.findByText("Anita R.")).toBeTruthy();
  });
});

describe("report a problem", () => {
  it("requires a message", async () => {
    loggedIn();
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Report a problem" }));
    const send = await screen.findByRole("button", { name: "Send" });
    expect(send.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("What happened?"), "   ");
    expect(screen.getByRole("button", { name: "Send" }).props.accessibilityState.disabled).toBe(true);
    expect(mocked.sendProblemReport).not.toHaveBeenCalled();
  });

  it("sends the message with the details attached automatically, then says thanks", async () => {
    loggedIn();
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///shot.png", mimeType: "image/png", fileSize: 300000 }],
    });
    const app = renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Report a problem" }));
    fireEvent.changeText(await screen.findByLabelText("What happened?"), "The photo button does nothing.");
    expect(app.getPathname()).toBe("/report");
    // Members aren't asked for an email; the team has their account email.
    expect(screen.queryByLabelText("Email for a reply (optional)")).toBeNull();
    await pressAndSettle(screen.getByRole("button", { name: "Add a screenshot" }));
    expect(await screen.findByLabelText("Screenshot added")).toBeTruthy();
    await pressAndSettle(screen.getByRole("button", { name: "Send" }));

    expect(mocked.sendProblemReport).toHaveBeenCalledWith("tok-123", {
      message: "The photo button does nothing.",
      contact_email: undefined,
      screenshot: { uri: "file:///shot.png", mimeType: "image/png" },
      app_version: "1.0.0 (12)",
      os: "iOS 19.1",
      device_model: "iPhone 16",
      language: "en",
      screen: "settings",
    });
    expect(await screen.findByText("Thanks! We got it.")).toBeTruthy();
    // ...and goes back to where they were.
    await waitFor(() => expect(app.getPathname()).toBe("/settings"), { timeout: 4000 });
  });

  it("from the join screen: never sends the address typed there", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
    renderApp();
    fireEvent.changeText(await screen.findByLabelText("Street address"), ADDRESS);
    fireEvent.press(screen.getByRole("link", { name: "Having trouble?" }));
    fireEvent.changeText(await screen.findByLabelText("What happened?"), "It can't find my street.");
    await pressAndSettle(screen.getByRole("button", { name: "Send" }));

    const [, report] = mocked.sendProblemReport.mock.calls[0];
    expect(report.screen).toBe("join/address");
    expect(JSON.stringify(mocked.sendProblemReport.mock.calls)).not.toContain("Example");
    expect(JSON.stringify(mocked.sendProblemReport.mock.calls)).not.toContain("3300");
  });

  it("when signed out: offers an optional email and reports in Spanish", async () => {
    renderApp();
    await screen.findByRole("button", { name: "Sign up" });
    await pressAndSettle(screen.getByRole("radio", { name: "Español" }));
    fireEvent.press(screen.getByRole("link", { name: "¿Problemas?" }));
    fireEvent.changeText(await screen.findByLabelText("¿Qué pasó?"), "No puedo crear una cuenta.");
    fireEvent.changeText(screen.getByLabelText("Correo para responderte (opcional)"), " vecina@example.com ");
    await pressAndSettle(screen.getByRole("button", { name: "Enviar" }));

    expect(mocked.sendProblemReport).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ contact_email: "vecina@example.com", language: "es", screen: "join/welcome" }),
    );
    expect(await screen.findByText("¡Gracias! Lo recibimos.")).toBeTruthy();
  });

  it("explains the daily limit", async () => {
    loggedIn();
    mocked.sendProblemReport.mockRejectedValue(new ApiError("daily_limit", 429));
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Report a problem" }));
    fireEvent.changeText(await screen.findByLabelText("What happened?"), "Again");
    await pressAndSettle(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("You've reached today's limit. Please try again tomorrow.")).toBeTruthy();
  });
});

describe("log out", () => {
  it("asks first; Cancel keeps you signed in", async () => {
    loggedIn();
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("header", { name: "Log out?" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("header", { name: "Log out?" })).toBeNull());
    expect(mocked.logout).not.toHaveBeenCalled();
    expect(fakeStore.has("auth_token")).toBe(true);
  });

  it("clears the token, keeps the language and returns to Join", async () => {
    loggedIn();
    renderApp("/settings");
    await pressAndSettle(await screen.findByRole("radio", { name: "Español" }));
    fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    await pressAndSettle((await screen.findAllByRole("button", { name: "Cerrar sesión" })).at(-1)!);

    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeTruthy();
    expect(mocked.logout).toHaveBeenCalledWith("tok-123");
    expect(fakeStore.has("auth_token")).toBe(false);
    expect(await languageStore()).toMatchObject({ "app.language": "es" });
  });
});

describe("delete account", () => {
  async function openDelete() {
    loggedIn();
    renderApp("/settings");
    fireEvent.press(await screen.findByRole("button", { name: "Delete account" }));
    expect(
      await screen.findByText("This permanently deletes your profile, photo and login. It can't be undone."),
    ).toBeTruthy();
  }

  it("needs the password", async () => {
    await openDelete();
    expect(screen.getByRole("button", { name: "Delete my account" }).props.accessibilityState.disabled).toBe(true);

    mocked.deleteAccount.mockRejectedValueOnce(new ApiError("wrong_password", 400));
    fireEvent.changeText(screen.getByLabelText("Your password"), "wrong");
    await pressAndSettle(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByText("That password isn't right.")).toBeTruthy();
    expect(fakeStore.has("auth_token")).toBe(true);
  });

  it("deletes, logs out and confirms on the Join screen", async () => {
    await openDelete();
    fireEvent.changeText(screen.getByLabelText("Your password"), "a long pass phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Delete my account" }));
    expect(mocked.deleteAccount).toHaveBeenCalledWith("tok-123", "a long pass phrase");
    expect(await screen.findByText("Your account was deleted.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(fakeStore.has("auth_token")).toBe(false);
  });
});
