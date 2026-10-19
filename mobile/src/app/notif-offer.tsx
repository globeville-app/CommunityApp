/**
 * The one-time notification ask (docs/MILESTONE_4.md, step 1). Shown once,
 * on the first "I'm going" after Milestone 4, right after the auto check-in
 * offer if that one shows too. "Turn on" leads to the phone's own prompt.
 * Settings can change it later.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { markNotifOfferSeen, updateProfileSettings } from "../api";
import { useAuth } from "../auth";
import { allowNotifications } from "../notifications/push";
import { colors } from "../theme";
import { Body, Button, GlassCard, Notice, Screen, Title } from "../ui";

export default function NotifOffer() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Seeing it once is enough: it's never shown again.
  useEffect(() => {
    if (token) markNotifOfferSeen(token).catch(() => undefined);
  }, [token]);

  async function onTurnOn() {
    if (!token) return;
    setBusy(true);
    const answer = await allowNotifications(token).catch(() => "denied" as const);
    if (answer === "granted") {
      await updateProfileSettings(token, { reminders_enabled: true, cancellation_alerts_enabled: true }).catch(
        () => undefined,
      );
      setBusy(false);
      router.back();
    } else {
      setBusy(false);
      setDeclined(true);
    }
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 24 }}>
        <Ionicons name="notifications-outline" size={56} color={colors.glowYellow} />
      </View>
      <Title>{t("notifications.offer_title")}</Title>
      <GlassCard>
        <Body onGlass>{t("notifications.offer_body")}</Body>
      </GlassCard>
      {declined ? <Notice message={t("notifications.stays_off")} /> : null}
      <Button title={t("checkin.turn_on")} onPress={onTurnOn} busy={busy} />
      <Button title={t("checkin.not_now")} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
