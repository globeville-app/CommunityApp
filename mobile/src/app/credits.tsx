/**
 * Settings → Open-source credits. Lucide's ISC license asks for its notice
 * to ship with the app; the text comes from the package itself.
 */
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { LUCIDE_LICENSE, LUCIDE_VERSION } from "../components/badges/lucideData";
import { colors, type } from "../theme";
import { BackButton, Body, GlassCard, Screen, Section, Title } from "../ui";

// Names and license texts are as their authors wrote them, in English.
const LUCIDE_TITLE = `Lucide ${LUCIDE_VERSION}`;
const LUCIDE_SITE = "https://lucide.dev";

export default function Credits() {
  const { t } = useTranslation();
  return (
    <Screen>
      <BackButton />
      <Title>{t("credits.title")}</Title>
      <Body>{t("credits.intro")}</Body>
      <GlassCard>
        <Section>{LUCIDE_TITLE}</Section>
        <Body onGlass>{t("credits.lucide_use")}</Body>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{LUCIDE_SITE}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} testID="lucide-license">
          {LUCIDE_LICENSE}
        </Text>
      </GlassCard>
    </Screen>
  );
}
