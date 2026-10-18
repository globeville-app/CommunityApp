/**
 * See all badges: all 15, in Growth and Keepsakes. Earned ones show their
 * stage; unearned ones are a dimmed emblem with the description.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, BadgeData, getMyBadges } from "../../api";
import { useAuth } from "../../auth";
import { badgeName, stageName } from "../../badges";
import { Badge } from "../../components/badges/Badge";
import { errorMessage } from "../../i18n/errors";
import { colors, space, type } from "../../theme";
import { BackButton, Caption, ErrorMessage, GlassCard, Loading, Screen, Section, Title } from "../../ui";

const KINDS = ["growth", "keepsake"] as const;

export default function AllBadges() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [badges, setBadges] = useState<BadgeData[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getMyBadges(token)
        .then((data) => setBadges(data.badges))
        .catch((e) => setError(e as ApiError));
    }, [token]),
  );

  if (error) {
    return (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    );
  }
  if (!badges) return <Loading />;

  const section = (kind: "growth" | "keepsake") => (
    <GlassCard key={kind}>
      <Section>{kind === "growth" ? t("badges.growth_title") : t("badges.keepsakes_title")}</Section>
      {badges
        .filter((b) => b.kind === kind)
        .map((badge) => {
          const earned = badge.stage > 0;
          return (
            <Pressable
              key={badge.key}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/badges/[key]", params: { key: badge.key } })}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
              <Badge badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={120} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.section, { color: colors.textPrimary }]}>{badgeName(t, badge.key)}</Text>
                {earned ? (
                  <Text style={[type.label, { color: colors.glowTurquoise }]}>
                    {badge.kind === "growth" ? stageName(t, badge.stage) : t("badges.keepsake")}
                  </Text>
                ) : (
                  <Caption onGlass>{t(`badges.${badge.key}.description`)}</Caption>
                )}
              </View>
            </Pressable>
          );
        })}
    </GlassCard>
  );

  return (
    <Screen>
      <BackButton />
      <Title>{t("badges.all_title")}</Title>
      {KINDS.map(section)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 44 },
});
