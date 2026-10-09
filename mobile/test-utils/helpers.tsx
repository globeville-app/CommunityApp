/** Shared setup for screen tests. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { renderRouter } from "expo-router/testing-library";

import Address from "../src/app/address";
import ComingSoon from "../src/app/coming-soon";
import DeleteAccount from "../src/app/delete-account";
import Start from "../src/app/index";
import RootLayout from "../src/app/_layout";
import Login from "../src/app/login";
import Profile from "../src/app/profile";
import ProfileSetup from "../src/app/profile-setup";
import Report from "../src/app/report";
import Settings from "../src/app/settings";
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
      "profile-setup": ProfileSetup,
      profile: Profile,
      settings: Settings,
      report: Report,
      "coming-soon": ComingSoon,
      "delete-account": DeleteAccount,
    },
    { initialUrl },
  );
}

export const notFound = () => new ApiError("profile_not_found", 404);

/** Pretend the phone's language setting is `tag`, e.g. "es-US". */
export function setDeviceLocale(tag: string) {
  (Localization as unknown as { __setLocale: (tag: string) => void }).__setLocale(tag);
}

/** A fresh phone: no saved language, set to US English. */
export async function resetLanguage() {
  await AsyncStorage.clear();
  setDeviceLocale("en-US");
}

/** Everything in the language preference store, as {key: value}. */
export async function languageStore() {
  const keys = await AsyncStorage.getAllKeys();
  return Object.fromEntries(await AsyncStorage.multiGet(keys));
}

export const HIGHLAND_PROFILE: ProfileData = {
  display_name: "Ana R.",
  first_name: "Ana",
  last_initial: "R",
  photo_url: null,
  interests: ["block_parties", "gardening"],
  neighborhood: { id: 3, name: "Highland" },
  alias: "LoHi",
  language: "en",
  joined_at: "2026-10-07T12:00:00Z",
};
