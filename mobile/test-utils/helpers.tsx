/** Shared setup for screen tests. */
import * as SecureStore from "expo-secure-store";
import { renderRouter } from "expo-router/testing-library";

import Address from "../src/app/address";
import Start from "../src/app/index";
import RootLayout from "../src/app/_layout";
import Login from "../src/app/login";
import Match from "../src/app/match";
import Profile from "../src/app/profile";
import ProfileSetup from "../src/app/profile-setup";
import Signup from "../src/app/signup";
import Welcome from "../src/app/welcome";
import { ApiError, Profile as ProfileData } from "../src/api";

export const APP_NAME: string = require("../../shared/app_config.json").app_name;

export const fakeStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

export function renderApp(initialUrl = "/") {
  return renderRouter(
    {
      _layout: RootLayout,
      index: Start,
      welcome: Welcome,
      signup: Signup,
      login: Login,
      address: Address,
      match: Match,
      "profile-setup": ProfileSetup,
      profile: Profile,
    },
    { initialUrl },
  );
}

export const notFound = () => new ApiError("profile_not_found", "You haven't finished joining yet.", 404);

export const HIGHLAND_PROFILE: ProfileData = {
  display_name: "Ana R.",
  first_name: "Ana",
  last_initial: "R",
  photo_url: null,
  interests: ["Block parties", "Gardening"],
  neighborhood: { id: 3, name: "Highland" },
  alias: "LoHi",
  joined_at: "2026-10-07T12:00:00Z",
};
