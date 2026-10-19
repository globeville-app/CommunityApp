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
import { allowNotifications, openPhoneSettings, phonePermission, PhonePermission, pushTokenForThisPhone } from "../notifications/push";
import { resetTo } from "../navigation";
import { colors } from "../theme";
import { BackButton, Caption, Choice, ConfirmDialog, Divider, GlassCard, ListRow, Screen, Section, TextLink, Title } from "../ui";

type LegalPage = "privacy" | "terms";

export default function Settings() {
  const { t } = useTranslation();
  const { token, signOut } = useAuth();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);
  const [autoCheckin, setAutoCheckin] = useState(false);
  const [visibility, setVisibility] = useState<BadgeVisibility | null>(null);
  const [mapApp, setMapApp] = useState<MapApp | null>(null);
  const [reminders, setReminders] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [phone, setPhone] = useState<PhonePermission>("undetermined");

  // Reload on return, e.g. after turning auto check-in on or picking a maps app.
  useFocusEffect(
    useCallback(() => {
      getRememberedMapApp().then(setMapApp);
      phonePermission()
        .then(setPhone)
        .catch(() => undefined);
      if (!token) return;
      getMyProfile(token)
        .then((profile) => {
          setAutoCheckin(profile.auto_checkin);
          setVisibility(profile.badge_visibility);
          setReminders(profile.reminders_enabled);
          setAlerts(profile.cancellation_alerts_enabled);
        })
        .catch(() => undefined);
    }, [token]),
  );

  /** Event reminders or cancellation alerts. Turning one on asks the phone first, if needed. */
  async function onNotifications(field: "reminders_enabled" | "cancellation_alerts_enabled", on: boolean) {
    if (!token) return;
    const set = field === "reminders_enabled" ? setReminders : setAlerts;
    if (on && phone !== "granted") {
      const answer = await allowNotifications(token).catch(() => "denied" as const);
      setPhone(answer);
      if (answer !== "granted") return;
    }
    set(on);
    await updateProfileSettings(token, { [field]: on }).catch(() => set(!on));
  }

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
    // This phone also stops getting notifications for this account.
    if (token) await logout(token, await pushTokenForThisPhone()).catch(() => undefined);
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

      <GlassCard style={{ gap: 0, paddingVertical: 6, marginTop: 16 }}>
        <Section>{t("notifications.settings_title")}</Section>
        {phone === "denied" ? (
          <View style={{ paddingVertical: 8, gap: 4 }}>
            <Caption onGlass>{t("notifications.phone_off")}</Caption>
            <TextLink label={t("notifications.open_phone_settings")} onPress={openPhoneSettings} />
          </View>
        ) : null}
        <ListRow label={t("notifications.reminders")}>
          <Switch
            accessibilityLabel={t("notifications.reminders")}
            value={reminders && phone !== "denied"}
            disabled={phone === "denied"}
            onValueChange={(on) => onNotifications("reminders_enabled", on)}
            trackColor={{ true: colors.glowTurquoise, false: "rgba(255,255,255,0.2)" }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
        <Divider />
        <ListRow label={t("notifications.cancellations")}>
          <Switch
            accessibilityLabel={t("notifications.cancellations")}
            value={alerts && phone === "granted"}
            disabled={phone === "denied"}
            onValueChange={(on) => onNotifications("cancellation_alerts_enabled", on)}
            trackColor={{ true: colors.glowTurquoise, false: "rgba(255,255,255,0.2)" }}
            thumbColor="#FFFFFF"
          />
        </ListRow>
      </GlassCard>

      <GlassCard style={{ gap: 0, paddingVertical: 6, marginTop: 16 }}>
        <ListRow label={t("organizations.yours")} chevron onPress={() => router.push("/my-organizations")} />
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
