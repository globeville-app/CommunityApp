import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Wordmark } from "../components/brand/Wordmark";
import { Button, Intro, JoinHeader, Screen, styles } from "../ui";

export default function Welcome() {
  const { t } = useTranslation();
  return (
    <Screen>
      <JoinHeader />
      {/* Logo centered, with clear space around it (design/BRAND.md). */}
      <View style={[styles.flex, { justifyContent: "center", alignItems: "center", gap: 32 }]}>
        <Wordmark height={44} />
        <Intro>{t("welcome.tagline")}</Intro>
      </View>
      <Button title={t("welcome.sign_up")} onPress={() => router.push("/signup")} />
      <Button title={t("welcome.log_in")} variant="secondary" onPress={() => router.push("/login")} />
    </Screen>
  );
}
