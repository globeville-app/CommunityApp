/** Stands in for the privacy policy or terms until the real pages exist. */
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { BackButton, GlassCard, Intro, Screen, Section, Title } from "../ui";

export default function ComingSoon() {
  const { t } = useTranslation();
  const { page } = useLocalSearchParams<{ page?: string }>();
  return (
    <Screen>
      <BackButton />
      <Title>{page === "terms" ? t("settings.terms_of_use") : t("settings.privacy_policy")}</Title>
      <GlassCard>
        <Section>{t("coming_soon.title")}</Section>
        <Intro>{t("coming_soon.body")}</Intro>
      </GlassCard>
    </Screen>
  );
}
