/**
 * The auto check-in explanation (docs/MILESTONE_3.md, step 2), in plain
 * words, before any location permission is asked for.
 *   ?which=first     the one offer on the first "I'm going" (never again)
 *   ?which=settings  turning it on from Settings
 *   &then=notifications  the notification ask comes right after (Milestone 4)
 * "Turn on" leads to the phone's prompts, ending with "Always". Declining at
 * any point leaves it off.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { markCheckinOfferSeen } from "../api";
import { useAuth } from "../auth";
import { turnOnAutoCheckin } from "../checkin/autoCheckin";
import { colors } from "../theme";
import { Body, Button, Caption, GlassCard, Notice, Screen, Title } from "../ui";

export default function CheckinOffer() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { which, then } = useLocalSearchParams<{ which?: string; then?: string }>();
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Seeing it once is enough: the first offer never shows again.
  useEffect(() => {
    if (token && which === "first") markCheckinOfferSeen(token, "first").catch(() => undefined);
  }, [token, which]);

  // Leaving: straight on to the notification ask when it's due.
  function leave() {
    if (then === "notifications") router.replace("/notif-offer");
    else router.back();
  }

  async function onTurnOn() {
    if (!token) return;
    setBusy(true);
    const result = await turnOnAutoCheckin(token).catch(() => "denied" as const);
    setBusy(false);
    if (result === "granted") leave();
    else setDeclined(true);
  }

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingTop: 24 }}>
        <Ionicons name="location-outline" size={56} color={colors.glowTurquoise} />
      </View>
      <Title>{t("checkin.title")}</Title>
      <GlassCard>
        <Body onGlass>{t("checkin.what_it_does")}</Body>
        <Body onGlass>{t("checkin.what_it_never_does")}</Body>
        <Caption onGlass>{t("checkin.permission_note")}</Caption>
      </GlassCard>
      {declined ? <Notice message={t("checkin.stays_off")} /> : null}
      <Button title={t("checkin.turn_on")} onPress={onTurnOn} busy={busy} />
      <Button title={t("checkin.not_now")} variant="secondary" onPress={leave} />
    </Screen>
  );
}
