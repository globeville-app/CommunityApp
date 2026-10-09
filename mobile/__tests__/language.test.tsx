/**
 * English | Español (docs/LANGUAGE.md): the toggle, where the choice is kept,
 * and how it syncs with the account. The backend API is mocked.
 */
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

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
  setDeviceLocale,
} from "../test-utils/helpers";

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
    updateLanguage: jest.fn(),
  };
});

const mocked = api as jest.Mocked<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  await resetLanguage();
  mocked.getConfig.mockResolvedValue({
    app_name: APP_NAME,
    interests: ["block_parties", "gardening"],
    languages: ["en", "es"],
  });
  mocked.updateLanguage.mockImplementation(async (_token, language) => ({ language }));
  mocked.logout.mockResolvedValue(undefined);
});

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

const toSpanish = () => pressAndSettle(screen.getByRole("radio", { name: "Español" }));
const toEnglish = () => pressAndSettle(screen.getByRole("radio", { name: "English" }));

function loggedIn() {
  fakeStore.set("auth_token", "tok-123");
}

describe("the toggle", () => {
  it("is on Welcome before anything is typed, and switches the text at once", async () => {
    renderApp();
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "English" }).props.accessibilityState.selected).toBe(true);

    await toSpanish();
    expect(screen.getByRole("button", { name: "Crear cuenta" })).toBeTruthy();
    expect(screen.getByText("Conoce a tus vecinos en Denver.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Español" }).props.accessibilityState.selected).toBe(true);
    // The logo is never translated.
    expect(screen.getByLabelText(APP_NAME)).toBeTruthy();
  });

  it("keeps a half-typed address when switching on the Join screen", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
    renderApp();
    fireEvent.changeText(await screen.findByLabelText("Street address"), "1437 Bann");

    await toSpanish();
    expect(screen.getByText("¿Dónde vives?")).toBeTruthy();
    expect(screen.getByLabelText("Dirección").props.value).toBe("1437 Bann");
    expect(screen.getByRole("button", { name: "Buscar mi vecindario" })).toBeTruthy();
  });

  it("is reachable at every join step, and keeps the neighborhood name as it is", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
    mocked.matchAddress.mockResolvedValue({ neighborhood_id: 3, name: "Highland", aliases: ["LoHi"] });
    renderApp();
    fireEvent.changeText(await screen.findByLabelText("Street address"), "2620 16th St");
    await pressAndSettle(screen.getByRole("button", { name: "Find my neighborhood" }));

    // Neighborhood confirmation
    expect(await screen.findByRole("header", { name: "Highland" })).toBeTruthy();
    await toSpanish();
    expect(screen.getByText("¿Qué nombre usas?")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "LoHi" })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Unirme a Highland" }));

    // Profile setup: still Spanish, with its own toggle; typed names survive a switch.
    fireEvent.changeText(await screen.findByLabelText("Nombre"), "Ana");
    expect(screen.getByRole("checkbox", { name: "Jardinería" })).toBeTruthy();
    await toEnglish();
    expect(screen.getByLabelText("First name").props.value).toBe("Ana");
    expect(screen.getByRole("checkbox", { name: "Gardening" })).toBeTruthy();
  });

  it("re-translates an error that's already showing", async () => {
    loggedIn();
    mocked.getMyProfile.mockRejectedValue(notFound());
    mocked.matchAddress.mockRejectedValue(new ApiError("outside_denver", 400));
    renderApp();
    fireEvent.changeText(await screen.findByLabelText("Street address"), "15151 E Alameda Pkwy, Aurora");
    await pressAndSettle(screen.getByRole("button", { name: "Find my neighborhood" }));
    expect(await screen.findByText(`${APP_NAME} is only in the City and County of Denver for now.`)).toBeTruthy();
    await toSpanish();
    expect(screen.getByText(`Por ahora, ${APP_NAME} solo está en la Ciudad y Condado de Denver.`)).toBeTruthy();
  });
});

describe("the choice is kept", () => {
  it("across screens, a restart, signup, logout and login", async () => {
    mocked.signup.mockResolvedValue({ token: "new-token", language: "es" });
    mocked.getMyProfile.mockRejectedValue(notFound());
    const first = renderApp();
    await screen.findByRole("button", { name: "Sign up" });
    await toSpanish();
    expect(await languageStore()).toMatchObject({ "app.language": "es", "app.language_source": "choice" });

    // Another screen
    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Crea tu cuenta")).toBeTruthy();

    // Restart: a fresh mount reads the saved choice.
    first.unmount();
    renderApp();
    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeTruthy();

    // Signup sends the language to the new account.
    fireEvent.press(screen.getByRole("button", { name: "Crear cuenta" }));
    fireEvent.changeText(await screen.findByLabelText("Correo electrónico"), "ana@example.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "a long pass phrase");
    await pressAndSettle(screen.getAllByRole("button", { name: "Crear cuenta" }).at(-1)!);
    expect(await screen.findByText("¿Dónde vives?")).toBeTruthy();
    expect(mocked.signup).toHaveBeenCalledWith("ana@example.com", "a long pass phrase", "es");
  });

  it("after logging out, and the next login keeps it", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, language: "es" });
    renderApp();
    await screen.findByText("Ana R.");
    fireEvent.press(screen.getByRole("button", { name: "Settings" }));
    await screen.findByText("Settings");
    await toSpanish();
    fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }));
    await pressAndSettle((await screen.findAllByRole("button", { name: "Cerrar sesión" })).at(-1)!);
    // Logged out, still Spanish.
    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeTruthy();

    mocked.login.mockResolvedValue({ token: "tok-2", language: "es" });
    fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
    fireEvent.changeText(await screen.findByLabelText("Correo electrónico"), "ana@example.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "a long pass phrase");
    await pressAndSettle(screen.getAllByRole("button", { name: "Iniciar sesión" }).at(-1)!);
    expect(await screen.findByText("Te uniste el 7 oct")).toBeTruthy();
  });

  it("wins over the account's language at login, and is written to the account", async () => {
    mocked.login.mockResolvedValue({ token: "tok-2", language: "en" });
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    renderApp("/login");
    await screen.findByLabelText("Email");
    await toSpanish();
    fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "ana@example.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "a long pass phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByText("Te uniste el 7 oct")).toBeTruthy();
    expect(mocked.updateLanguage).toHaveBeenCalledWith("tok-2", "es");
  });

  it("follows the account's language at login when this phone only guessed", async () => {
    mocked.login.mockResolvedValue({ token: "tok-2", language: "es" });
    mocked.getMyProfile.mockResolvedValue({ ...HIGHLAND_PROFILE, language: "es" });
    renderApp("/login");
    fireEvent.changeText(await screen.findByLabelText("Email"), "ana@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "a long pass phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Te uniste el 7 oct")).toBeTruthy();
    expect(mocked.updateLanguage).not.toHaveBeenCalled();
    expect(await languageStore()).toMatchObject({ "app.language": "es", "app.language_source": "account" });
  });
});

describe("first launch", () => {
  it("starts in Spanish on a Spanish phone, and saves that right away", async () => {
    setDeviceLocale("es-MX");
    renderApp();
    expect(await screen.findByRole("button", { name: "Crear cuenta" })).toBeTruthy();
    expect(await languageStore()).toMatchObject({ "app.language": "es", "app.language_source": "device" });
  });

  it("ignores the phone's setting once a choice is saved", async () => {
    setDeviceLocale("es-US");
    const first = renderApp();
    await screen.findByRole("button", { name: "Crear cuenta" });
    await toEnglish();
    first.unmount();

    setDeviceLocale("es-ES");
    renderApp();
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
  });
});

describe("saving to the server", () => {
  it("sends a change made in Settings", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    renderApp("/settings");
    expect(await screen.findByText("Language / Idioma")).toBeTruthy();
    await toSpanish();
    expect(screen.getByText("Configuración")).toBeTruthy();
    expect(mocked.updateLanguage).toHaveBeenCalledWith("tok-123", "es");
  });

  it("keeps the new language when saving fails, and retries at the next start", async () => {
    loggedIn();
    mocked.getMyProfile.mockResolvedValue(HIGHLAND_PROFILE);
    mocked.updateLanguage.mockRejectedValueOnce(new ApiError("network"));
    const first = renderApp("/settings");
    await screen.findByText("Settings");
    await toSpanish();
    expect(screen.getByText("Configuración")).toBeTruthy(); // not undone
    await waitFor(async () => expect(await languageStore()).toMatchObject({ "app.language_unsynced": "1" }));

    first.unmount();
    renderApp();
    expect(await screen.findByText("Te uniste el 7 oct")).toBeTruthy();
    await waitFor(() => expect(mocked.updateLanguage).toHaveBeenCalledTimes(2));
    expect(mocked.updateLanguage).toHaveBeenLastCalledWith("tok-123", "es");
    await waitFor(async () => expect((await languageStore())["app.language_unsynced"]).toBeUndefined());
  });
});
