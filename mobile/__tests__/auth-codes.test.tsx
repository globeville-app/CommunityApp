/**
 * "Forgot password?" and confirming the email with a code, with the backend
 * API mocked (review P5 and D1).
 */
import { act, fireEvent, screen } from "expo-router/testing-library";

import * as api from "../src/api";
import { ApiError } from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { fakeStore, renderApp, resetLanguage } from "../test-utils/helpers";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  await resetLanguage();
  useDefaultReplies(mocked);
});

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe("forgot password", () => {
  it("emails a code, then saves the new password and logs in", async () => {
    mocked.requestPasswordReset.mockResolvedValue(undefined);
    mocked.confirmPasswordReset.mockResolvedValue({ token: "tok-new", language: "en", email_verified: true });
    renderApp("/login");

    await pressAndSettle(await screen.findByRole("link", { name: "Forgot password?" }));
    fireEvent.changeText(await screen.findByLabelText("Email"), " ana@example.com ");
    await pressAndSettle(screen.getByRole("button", { name: "Send code" }));
    expect(mocked.requestPasswordReset).toHaveBeenCalledWith("ana@example.com");

    expect(await screen.findByText(/If ana@example.com has an account/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    fireEvent.changeText(screen.getByLabelText("New password"), "another long phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Save new password" }));

    expect(mocked.confirmPasswordReset).toHaveBeenCalledWith("ana@example.com", "123456", "another long phrase");
    expect(fakeStore.get("auth_token")).toBe("tok-new");
    expect(await screen.findByText("Upcoming events")).toBeTruthy();
  });

  it("explains a wrong or expired code", async () => {
    mocked.confirmPasswordReset.mockRejectedValue(new ApiError("invalid_code", 400));
    renderApp("/reset-password?email=ana%40example.com");
    fireEvent.changeText(await screen.findByLabelText("6-digit code"), "000000");
    fireEvent.changeText(screen.getByLabelText("New password"), "another long phrase");
    await pressAndSettle(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByText(/That code isn't right or has expired/)).toBeTruthy();
    expect(fakeStore.has("auth_token")).toBe(false);
  });
});

describe("confirming the email", () => {
  beforeEach(() => {
    fakeStore.set("auth_token", "tok-123");
  });

  it("asks for the code when the server says the email isn't confirmed, then goes on to joining", async () => {
    mocked.getMyProfile
      .mockRejectedValueOnce(new ApiError("email_not_verified", 403))
      .mockRejectedValueOnce(new ApiError("profile_not_found", 404));
    mocked.verifyEmail.mockResolvedValue(undefined);
    renderApp();

    expect(await screen.findByText("Confirm your email")).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText("6-digit code"), "123456");
    await pressAndSettle(screen.getByRole("button", { name: "Confirm" }));
    expect(mocked.verifyEmail).toHaveBeenCalledWith("tok-123", "123456");
    expect(await screen.findByText("Where's home?")).toBeTruthy();
  });

  it("sends a new code, or lets them start again with another email", async () => {
    mocked.getMyProfile.mockRejectedValue(new ApiError("email_not_verified", 403));
    mocked.resendVerification.mockResolvedValue(undefined);
    mocked.logout.mockResolvedValue(undefined);
    renderApp();

    await pressAndSettle(await screen.findByRole("link", { name: "Send a new code" }));
    expect(mocked.resendVerification).toHaveBeenCalledWith("tok-123");
    expect(await screen.findByText("We sent a new code.")).toBeTruthy();

    await pressAndSettle(screen.getByRole("link", { name: "Use a different email" }));
    expect(fakeStore.has("auth_token")).toBe(false);
    expect(await screen.findByRole("button", { name: "Sign up" })).toBeTruthy();
  });
});
