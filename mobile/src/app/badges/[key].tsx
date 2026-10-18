/**
 * Badge detail (docs/MILESTONE_3.md, Profile): the emblem, name, stage,
 * count ("5 cleanups"), description and Share for an earned badge.
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ApiError, BadgeData, getMyBadges } from "../../api";
import { useAuth } from "../../auth";
import { badgeName, countLine, stageName } from "../../badges";
import { Badge } from "../../components/badges/Badge";
import { errorMessage } from "../../i18n/errors";
import { colors, type } from "../../theme";
import { BackButton, Body, Button, ErrorMessage, GlassCard, Loading, Screen, Tag } from "../../ui";

export default function BadgeDetail() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getMyBadges(token)
        .then(({ badges }) => setBadge(badges.find((b) => b.key === key) ?? null))
        .catch((e) => setError(e as ApiError));
    }, [token, key]),
  );

  if (error) {
    return (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    );
  }
  if (!badge) return <Loading />;

  const earned = badge.stage > 0;
  return (
    <Screen>
      <BackButton />
      <View style={{ alignItems: "center", gap: 12 }}>
        <Badge badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={180} />
        <Text style={[type.title, { color: colors.textPrimary, textAlign: "center" }]} accessibilityRole="header">
          {badgeName(t, badge.key)}
        </Text>
        {earned && badge.kind === "growth" ? <Tag label={stageName(t, badge.stage)} /> : null}
        {earned && badge.kind === "keepsake" ? <Tag tone="yellow" label={t("badges.keepsake")} /> : null}
      </View>
      <GlassCard>
        {badge.kind === "growth" && badge.count > 0 ? (
          <Text style={[type.section, { color: colors.textPrimary }]}>{countLine(t, badge.key, badge.count)}</Text>
        ) : null}
        <Body onGlass>{t(`badges.${badge.key}.description`)}</Body>
        {badge.kind === "growth" && badge.next_threshold ? (
          <Body onGlass>
            {t("badges.more_to", {
              count: badge.next_threshold - badge.count,
              stage: stageName(t, badge.stage + 1),
            })}
          </Body>
        ) : null}
        {!earned ? <Body onGlass>{t("badges.not_earned_yet")}</Body> : null}
      </GlassCard>
      {earned ? (
        <Button title={t("badges.share")} onPress={() => router.push({ pathname: "/share/[key]", params: { key: badge.key } })} />
      ) : null}
    </Screen>
  );
}
