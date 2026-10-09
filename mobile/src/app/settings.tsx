/**
 * Settings (docs/SETTINGS.md): one glass list, in this order. Delete
 * account sits apart, in red. The app version is at the bottom.
 */
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { logout } from "../api";
import { useAuth } from "../auth";
import { LanguageToggle } from "../components/LanguageToggle";
import { APP_VERSION, BUILD_NUMBER, PRIVACY_URL, TERMS_URL } from "../config";
import { resetTo } from "../navigation";
import { BackButton, Caption, ConfirmDialog, Divider, GlassCard, ListRow, Screen, Title } from "../ui";

type LegalPage = "privacy" | "terms";

export default function Settings() {
  const { t } = useTranslation();
  const { token, signOut } = useAuth();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);

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
