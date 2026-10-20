/** Block this member, from their page, and unblock from Settings (review P6). */
import { act, fireEvent, screen } from "expo-router/testing-library";

import * as api from "../src/api";
import { useDefaultReplies } from "../test-utils/apiMock";
import { fakeStore, renderApp, resetLanguage } from "../test-utils/helpers";

jest.mock("../src/api", () => require("../test-utils/apiMock").fakeApi());

const mocked = api as jest.Mocked<typeof api>;

const BEN = {
  id: 52,
  display_name: "Ben R.",
  photo_url: null,
  neighborhood: { id: 3, name: "Highland" },
  alias: null,
  member_since: "2026-03-14",
  badges: [],
  is_own: false,
  is_blocked: false,
};

beforeEach(async () => {
  jest.clearAllMocks();
  fakeStore.clear();
  await resetLanguage();
  useDefaultReplies(mocked);
  fakeStore.set("auth_token", "tok-123");
});

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

it("blocks a neighbor from their page after asking, and can undo it", async () => {
  mocked.getMember.mockResolvedValue(BEN);
  mocked.setBlocked.mockImplementation(async (_token, _id, blocked) => ({ is_blocked: blocked }));
  renderApp("/member/52");

  await pressAndSettle(await screen.findByRole("link", { name: "Block Ben R." }));
  expect(screen.getByText("Block Ben R.? You won't see their events. They won't be told.")).toBeTruthy();
  await pressAndSettle(screen.getByRole("button", { name: "Block Ben R." }));
  expect(mocked.setBlocked).toHaveBeenCalledWith("tok-123", 52, true);
  expect(await screen.findByText("You've blocked Ben R. and don't see their events.")).toBeTruthy();

  await pressAndSettle(screen.getByRole("link", { name: "Unblock Ben R." }));
  expect(mocked.setBlocked).toHaveBeenLastCalledWith("tok-123", 52, false);
});

it("doesn't offer Block on your own page", async () => {
  mocked.getMember.mockResolvedValue({ ...BEN, is_own: true });
  renderApp("/member/52");
  expect(await screen.findByText(/Member since/)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Block Ben R." })).toBeNull();
});

it("lists blocked members in Settings and unblocks them", async () => {
  mocked.getBlockedMembers.mockResolvedValue({ members: [{ id: 52, display_name: "Ben R." }] });
  mocked.setBlocked.mockResolvedValue({ is_blocked: false });
  renderApp("/blocked-members");
  expect(await screen.findByText("Ben R.")).toBeTruthy();
  await pressAndSettle(screen.getByRole("link", { name: "Unblock" }));
  expect(mocked.setBlocked).toHaveBeenCalledWith("tok-123", 52, false);
  expect(await screen.findByText("You haven't blocked anyone.")).toBeTruthy();
});
