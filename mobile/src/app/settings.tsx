/**
 * Settings (docs/SETTINGS.md): one glass list, in this order. Delete
 * account sits apart, in red. The app version is at the bottom.
 */
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Switch, View } from "react-native";

import { BadgeVisibility, getMyProfile, logout, updateProfileSettings } from "../api";
import { useAuth } from "../auth";
import { turnOffAutoCheckin } from "../checkin/autoCheckin";
import { LanguageToggle } from "../components/LanguageToggle";
import { APP_VERSION, BUILD_NUMBER, PRIVACY_URL, TERMS_URL } from "../config";
import { getRememberedMapApp } from "../maps/mapsPreference";
import { MapApp } from "../maps/openIn";
import { resetTo } from "../navigation";
import { colors } from "../theme";
import { BackButton, Caption, Choice, ConfirmDialog, Divider, GlassCard, ListRow, Screen, Title } from "../ui";

type LegalPage = "privacy" | "terms";

export default function Settings() {
  const { t } = useTranslation();
  const { token, signOut } = useAuth();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);
  const [autoCheckin, setAutoCheckin] = useState(false);
  const [visibility, setVisibility] = useState<BadgeVisibility | null>(null);
  const [mapApp, setMapApp] = useState<MapApp | null>(null);

  // Reload on return, e.g. after turning auto check-in on or picking a maps app.
  useFocusEffect(
    useCallback(() => {
      getRememberedMapApp().then(setMapApp);
      if (!token) return;
      getMyProfile(token)
        .then((profile) => {
          setAutoCheckin(profile.auto_checkin);
          setVisibility(profile.badge_visibility);
        })
        .catch(() => undefined);
    }, [token]),
  );

  async function onAutoCheckin(on: boolean) {
    if (!token) return;
    // On: the explanation screen first, then the phone's permission prompts.
    if (on) return router.push({ pathname: "/checkin-offer", params: { which: "settings" } });
    setAutoCheckin(false);
    await turnOffAutoCheckin(token).catch(() => setAutoCheckin(true));
  }

  async function onVisibility(next: BadgeVisibility) {
    if (!token) return;
    const before = visibility;
    setVisibility(next);
    await updateProfileSettings(token, { badge_visibility: next }).catch(() => setVisibility(before));
  }

  function openLegal(page: LegalPage) {
    const url = page === "privacy" ? PRIVACY_URL : TERMS_URL;
    // No page yet: show "Coming soon" instead of a broken link.
    if (!url) router.push({ pathname: "/coming-soon", params: { page } });
    else WebBrowser.openBrowserAsync(url);
  }

  async function onLogOut() {
    setConfirmingLogOut(false);
    // The server deletes the token. If it can't be reached, we still log
    // out on this phone. The language choice is kept (docs/LANGUAGE.md).
    if (token) await logout(token).catch(() => undefined);
    await signOut();
    resetTo("/welcome");
  }

  return (
    <Screen>
      <BackButton />
      <Title>{t("settings.title")}</Title>

      <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
        <ListRow label={t("settings.edit_profile")} chevron onPress={() => router.push("/profile-setup?edit=1")} />
        <Divider />
        <ListRow label={t("language.settings_row")}>
          <LanguageToggle />
        </ListRow>
        <Divider />
        <ListRow label={t("settings.auto_checkin")}>
          <Switch
            accessibilityLabel={t("settings.auto_checkin")}
            value={autoCheckin}
            onValueChange={onAutoCheckin}
            trackColor={{ true: colors.glowTurquoise, false: "rgba(255,255,255,0.2)" }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
        <Divider />
        <ListRow label={t("settings.show_badges_to")} />
        {visibility ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 12 }}>
            <Choice
              label={t("settings.badges_neighborhood")}
              selected={visibility === "neighborhood"}
              onPress={() => onVisibility("neighborhood")}
            />
            <Choice label={t("settings.badges_only_me")} selected={visibility === "private"} onPress={() => onVisibility("private")} />
          </View>
        ) : null}
        <Divider />
        <ListRow label={t("settings.maps_app")} chevron onPress={() => router.push("/maps-app")}>
          <Caption onGlass>{mapApp ? t(`maps.app_${mapApp}`) : t("maps.ask_every_time")}</Caption>
        </ListRow>
        <Divider />
        <ListRow
          label={t("settings.report_problem")}
          chevron
          onPress={() => router.push({ pathname: "/report", params: { from: "settings" } })}
        />
        <Divider />
        <ListRow label={t("settings.privacy_policy")} chevron onPress={() => openLegal("privacy")} />
        <Divider />
        <ListRow label={t("settings.terms_of_use")} chevron onPress={() => openLegal("terms")} />
        <Divider />
        <ListRow label={t("settings.credits")} chevron onPress={() => router.push("/credits")} />
        <Divider />
        <ListRow label={t("settings.log_out")} onPress={() => setConfirmingLogOut(true)} />
      </GlassCard>

      {/* Set apart from the rest, and the only row in color. */}
      <GlassCard style={{ gap: 0, paddingVertical: 6, marginTop: 16 }}>
        <ListRow label={t("settings.delete_account")} danger chevron onPress={() => router.push("/delete-account")} />
      </GlassCard>

      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <Caption>{t("settings.version", { version: APP_VERSION, build: BUILD_NUMBER })}</Caption>
      </View>

      <ConfirmDialog
        visible={confirmingLogOut}
        title={t("settings.log_out_confirm_title")}
        confirmLabel={t("settings.log_out")}
        cancelLabel={t("settings.cancel")}
        onConfirm={onLogOut}
        onCancel={() => setConfirmingLogOut(false)}
      />
    </Screen>
  );
}
