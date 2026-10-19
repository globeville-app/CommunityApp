/** Shared setup for screen tests. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { renderRouter } from "expo-router/testing-library";

import Address from "../src/app/address";
import BadgeDetail from "../src/app/badges/[key]";
import AllBadges from "../src/app/badges/index";
import Celebrate from "../src/app/celebrate";
import CheckinOffer from "../src/app/checkin-offer";
import Credits from "../src/app/credits";
import MyImpact from "../src/app/impact";
import MapsApp from "../src/app/maps-app";
import Member from "../src/app/member/[id]";
import SharePreview from "../src/app/share/[key]";
import MyOrganizations from "../src/app/my-organizations";
import NotifOffer from "../src/app/notif-offer";
import OrganizationAdmins from "../src/app/organization-admins";
import OrganizationForm from "../src/app/organization-form";
import OrganizationImpact from "../src/app/organization-impact";
import OrganizationPage from "../src/app/organizations/[id]";
import Organizations from "../src/app/organizations/index";
import ComingSoon from "../src/app/coming-soon";
import DeleteAccount from "../src/app/delete-account";
import Start from "../src/app/index";
import RootLayout from "../src/app/_layout";
import Login from "../src/app/login";
import TabLayout from "../src/app/(tabs)/_layout";
import Events from "../src/app/(tabs)/events";
import Profile from "../src/app/(tabs)/profile";
import EventDetail from "../src/app/event/[id]";
import EventForm from "../src/app/event-form";
import Interests from "../src/app/interests";
import ProfileSetup from "../src/app/profile-setup";
import Report from "../src/app/report";
import Settings from "../src/app/settings";
import Signup from "../src/app/signup";
import Welcome from "../src/app/welcome";
import { ApiError } from "../src/api";

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
      "(tabs)/_layout": TabLayout,
      "(tabs)/events": Events,
      "(tabs)/profile": Profile,
      "event/[id]": EventDetail,
      "event-form": EventForm,
      interests: Interests,
      settings: Settings,
      report: Report,
      "coming-soon": ComingSoon,
      "delete-account": DeleteAccount,
      impact: MyImpact,
      "badges/index": AllBadges,
      "badges/[key]": BadgeDetail,
      "member/[id]": Member,
      "checkin-offer": CheckinOffer,
      celebrate: Celebrate,
      "share/[key]": SharePreview,
      "maps-app": MapsApp,
      credits: Credits,
      "notif-offer": NotifOffer,
      "my-organizations": MyOrganizations,
      "organization-form": OrganizationForm,
      "organization-admins": OrganizationAdmins,
      "organization-impact": OrganizationImpact,
      "organizations/index": Organizations,
      "organizations/[id]": OrganizationPage,
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

export { CATALOG, CONFIG, HIGHLAND_PROFILE, myBadges, sampleEvent } from "./data";
